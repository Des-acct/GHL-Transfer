import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import config from './src/config.js';
import { ghlFetch, ghlFetchAll, testConnection } from './src/ghl-client.js';
import { getSessionRequestCount } from './src/rate-limiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;
const EXPORT_DIR = IS_VERCEL ? '/tmp/exports' : resolve(__dirname, 'exports');

app.use(cors());
app.use(express.json());
app.use(express.static(resolve(__dirname, 'public')));
mkdirSync(EXPORT_DIR, { recursive: true });

const ALL_MODULES = ['contacts', 'opportunities', 'pipelines', 'tasks', 'tags', 'custom_fields', 'custom_values', 'conversations', 'email_templates', 'calendars', 'appointments', 'workflows', 'forms', 'surveys', 'media', 'reporting'];

function saveExport(moduleId, data) {
    const fp = resolve(EXPORT_DIR, `${moduleId}.json`);
    writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
    const mp = resolve(EXPORT_DIR, '_manifest.json');
    let manifest = {};
    if (existsSync(mp)) try { manifest = JSON.parse(readFileSync(mp, 'utf-8')); } catch { }
    const count = Array.isArray(data) ? data.length : (data.opportunities?.length ?? Object.keys(data).length);
    manifest[moduleId] = { count, exportedAt: new Date().toISOString() };
    writeFileSync(mp, JSON.stringify(manifest, null, 2), 'utf-8');
    return { filePath: fp, count };
}

app.get('/api/test-connection', async (req, res) => {
    try { res.json({ success: await testConnection(), locationId: config.locationId }); }
    catch (err) { res.json({ success: false, error: err.message }); }
});

app.get('/api/rate-limit', (req, res) => res.json({ sessionRequests: getSessionRequestCount() }));

// ── FILTERS ──
app.get('/api/filters/:moduleId', async (req, res) => {
    const loc = config.locationId;
    try {
        let items = [];
        switch (req.params.moduleId) {
            case 'opportunities': {
                const r = await ghlFetch('/opportunities/pipelines', { locationId: loc });
                (r.pipelines || []).forEach(p => {
                    items.push({ id: `pipeline:${p.id}`, label: p.name, group: 'Pipelines' });
                    (p.stages || []).forEach(s => items.push({ id: `stage:${p.id}:${s.id}`, label: s.name, group: `${p.name} — Stages` }));
                }); break;
            }
            case 'pipelines': {
                const r = await ghlFetch('/opportunities/pipelines', { locationId: loc });
                items = (r.pipelines || []).map(p => ({ id: p.id, label: p.name })); break;
            }
            case 'tasks':
                items = [{ id: 'completed', label: 'Completed' }, { id: 'pending', label: 'Pending' }]; break;
            case 'tags': {
                const r = await ghlFetch(`/locations/${loc}/tags`);
                items = (r.tags || []).map(t => ({ id: t.id || t.name, label: t.name })); break;
            }
            case 'custom_fields': {
                const r = await ghlFetch(`/locations/${loc}/customFields`);
                items = (r.customFields || []).map(f => ({ id: f.id, label: f.name, group: f.dataType || 'General' })); break;
            }
            case 'custom_values': {
                const r = await ghlFetch(`/locations/${loc}/customValues`);
                items = (r.customValues || []).map(v => ({ id: v.id, label: v.name })); break;
            }
            case 'conversations':
                items = [{ id: 'TYPE_EMAIL', label: 'Email' }, { id: 'TYPE_SMS', label: 'SMS' }]; break;
            case 'email_templates':
                try {
                    const r = await ghlFetch('/emails/templates', { locationId: loc });
                    items = (r.templates || r.data || []).map(t => ({ id: t.id, label: t.name, group: t.folder || 'Default' }));
                } catch { items = [{ id: 'all', label: 'All Templates' }]; }
                break;
            case 'calendars': {
                const r = await ghlFetch('/calendars/', { locationId: loc });
                items = (r.calendars || []).map(c => ({ id: c.id, label: c.name })); break;
            }
            case 'workflows': {
                const r = await ghlFetch('/workflows/', { locationId: loc });
                items = (r.workflows || []).map(w => ({ id: w.id, label: w.name, group: w.folder || 'Default' })); break;
            }
            case 'forms': {
                const r = await ghlFetch('/forms/', { locationId: loc });
                items = (r.forms || []).map(f => ({ id: f.id, label: f.name, group: f.folder || 'Default' })); break;
            }
            case 'surveys':
                try {
                    const r = await ghlFetch('/surveys/', { locationId: loc });
                    items = (r.surveys || []).map(s => ({ id: s.id, label: s.name, group: s.folder || 'Default' }));
                } catch { items = []; }
                break;
            case 'reporting':
                try {
                    const r = await ghlFetch('/reporting/', { locationId: loc });
                    items = (r.dashboards || r.data || []).map(d => ({ id: d.id, label: d.name }));
                } catch { items = [{ id: 'default', label: 'Default Dashboard' }]; }
                break;
        }
        res.json({ success: true, items, selectAll: ['tags', 'custom_fields', 'custom_values'].includes(req.params.moduleId) });
    } catch (err) { res.json({ success: false, items: [], error: err.message }); }
});

// ── EXTRACT MODULE ──
async function extractModule(moduleId, selectedFilters) {
    const loc = config.locationId;
    switch (moduleId) {
        case 'contacts': return await ghlFetchAll('/contacts/', { locationId: loc }, { dataKey: 'contacts', limit: 100 });
        case 'opportunities': {
            const pRes = await ghlFetch('/opportunities/pipelines', { locationId: loc });
            const pipelines = pRes.pipelines || [];
            let allOpps = [];
            for (const p of pipelines) {
                try {
                    const opps = await ghlFetchAll('/opportunities/search', { location_id: loc, pipeline_id: p.id }, { dataKey: 'opportunities', limit: 100 });
                    allOpps.push(...opps.map(o => ({ ...o, pipelineName: p.name })));
                } catch { }
            }
            return { pipelines, opportunities: allOpps };
        }
        case 'pipelines': {
            const r = await ghlFetch('/opportunities/pipelines', { locationId: loc });
            return r.pipelines || [];
        }
        case 'tasks':
            try { return await ghlFetchAll('/contacts/tasks', { locationId: loc }, { dataKey: 'tasks', limit: 100 }); }
            catch { return []; }
        case 'tags': { const r = await ghlFetch(`/locations/${loc}/tags`); return r.tags || []; }
        case 'custom_fields': { const r = await ghlFetch(`/locations/${loc}/customFields`); return r.customFields || []; }
        case 'custom_values': { const r = await ghlFetch(`/locations/${loc}/customValues`); return r.customValues || []; }
        case 'conversations': {
            let data = await ghlFetchAll('/conversations/search', { locationId: loc }, { dataKey: 'conversations', limit: 100 });
            if (selectedFilters?.length) data = data.filter(c => selectedFilters.includes(c.type));
            return data;
        }
        case 'email_templates':
            try { const r = await ghlFetch('/emails/templates', { locationId: loc }); return r.templates || r.data || []; }
            catch { return []; }
        case 'calendars': { const r = await ghlFetch('/calendars/', { locationId: loc }); return r.calendars || []; }
        case 'appointments': {
            const cRes = await ghlFetch('/calendars/', { locationId: loc });
            let all = [];
            for (const cal of (cRes.calendars || [])) {
                try {
                    const ev = await ghlFetchAll('/calendars/events', { locationId: loc, calendarId: cal.id }, { dataKey: 'events', limit: 100 });
                    all.push(...ev.map(e => ({ ...e, calendarName: cal.name })));
                } catch { }
            }
            return all;
        }
        case 'workflows': { const r = await ghlFetch('/workflows/', { locationId: loc }); return r.workflows || []; }
        case 'forms': { const r = await ghlFetch('/forms/', { locationId: loc }); return r.forms || []; }
        case 'surveys':
            try { const r = await ghlFetch('/surveys/', { locationId: loc }); return r.surveys || []; }
            catch { return []; }
        case 'media':
            try { const r = await ghlFetch('/medias/', { locationId: loc }); return r.medias || r.data || []; }
            catch { return []; }
        case 'reporting':
            try { const r = await ghlFetch(`/locations/${loc}`); return { locationSummary: r.location || r }; }
            catch { return {}; }
        default: throw new Error(`Unknown module: ${moduleId}`);
    }
}

// ── EXPORT SINGLE ──
app.post('/api/export/:moduleId', async (req, res) => {
    try {
        const data = await extractModule(req.params.moduleId, req.body?.selectedFilters);
        const { filePath, count } = saveExport(req.params.moduleId, data);
        res.json({ success: true, moduleId: req.params.moduleId, count, data: Array.isArray(data) ? data.slice(0, 200) : data, exportedAt: new Date().toISOString(), sessionRequests: getSessionRequestCount() });
    } catch (err) {
        res.status(500).json({ success: false, moduleId: req.params.moduleId, error: err.message, sessionRequests: getSessionRequestCount() });
    }
});

// ── EXPORT ALL ──
app.post('/api/export-all', async (req, res) => {
    const ids = req.body?.modules || ALL_MODULES;
    const results = [];
    for (const id of ids) {
        try {
            const data = await extractModule(id);
            const { count } = saveExport(id, data);
            results.push({ moduleId: id, success: true, count });
        } catch (err) { results.push({ moduleId: id, success: false, error: err.message }); }
    }
    res.json({ success: true, results, sessionRequests: getSessionRequestCount() });
});

// ── DATA & DOWNLOAD ──
app.get('/api/export-data/:moduleId', (req, res) => {
    const fp = resolve(EXPORT_DIR, `${req.params.moduleId}.json`);
    if (!existsSync(fp)) return res.json({ success: false, data: null });
    try {
        const data = JSON.parse(readFileSync(fp, 'utf-8'));
        const count = Array.isArray(data) ? data.length : Object.keys(data).length;
        res.json({ success: true, data: Array.isArray(data) ? data.slice(0, 200) : data, count });
    } catch { res.json({ success: false, data: null }); }
});

app.get('/api/download/:moduleId', (req, res) => {
    const fp = resolve(EXPORT_DIR, `${req.params.moduleId}.json`);
    if (!existsSync(fp)) return res.status(404).json({ error: 'Not exported yet' });
    res.download(fp, `${req.params.moduleId}.json`);
});

app.get('/api/manifest', (req, res) => {
    const mp = resolve(EXPORT_DIR, '_manifest.json');
    if (!existsSync(mp)) return res.json({});
    try { res.json(JSON.parse(readFileSync(mp, 'utf-8'))); } catch { res.json({}); }
});

app.get('/', (req, res) => res.sendFile(resolve(__dirname, 'public', 'index.html')));

// Vercel: export the app as a serverless function
export default app;

// Local: listen on PORT
if (!IS_VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n  ⚡ KissHub GHL Data Transfer Console`);
        console.log(`  🌐 http://localhost:${PORT}`);
        console.log(`  📡 Location: ${config.locationId}`);
        console.log(`  📁 Exports: ${EXPORT_DIR}\n`);
    });
}
