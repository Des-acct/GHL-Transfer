import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import config from './src/config.js';
import { ghlFetch, ghlFetchAll, testConnection } from './src/ghl-client.js';
import { getSessionRequestCount } from './src/rate-limiter.js';
import { saveToSupabase, readFromSupabase, getManifestFromSupabase } from './src/supabase.js';

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

async function saveExport(moduleId, data, description) {
    const count = Array.isArray(data) ? data.length : (data.opportunities?.length ?? Object.keys(data).length);
    // Save to local filesystem
    try {
        const fp = resolve(EXPORT_DIR, `${moduleId}.json`);
        writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
        const mp = resolve(EXPORT_DIR, '_manifest.json');
        let manifest = {};
        if (existsSync(mp)) try { manifest = JSON.parse(readFileSync(mp, 'utf-8')); } catch { }
        manifest[moduleId] = { count, exportedAt: new Date().toISOString(), description };
        writeFileSync(mp, JSON.stringify(manifest, null, 2), 'utf-8');
    } catch (e) { console.log('   ⚠  Filesystem save skipped:', e.message); }
    // Save to Supabase
    try {
        await saveToSupabase(moduleId, data, config.locationId, description);
    } catch (e) { console.log('   ⚠  Supabase save skipped:', e.message); }
    return { count };
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
            case 'contacts': {
                const r = await ghlFetchAll('/contacts/', { locationId: loc }, { dataKey: 'contacts', limit: 50 });
                items = (r || []).map(c => ({ id: c.id, label: `${c.firstName || ''} ${c.lastName || ''} (${c.email || 'no email'})`.trim() })); break;
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
// Filter helper: only return items whose id matches the selected checkboxes
function applyFilter(data, selectedFilters) {
    if (!selectedFilters?.length || !Array.isArray(data)) return data;
    return data.filter(item => selectedFilters.includes(item.id));
}

export async function extractModule(moduleId, selectedFilters) {
    const loc = config.locationId;
    switch (moduleId) {
        case 'contacts': {
            if (selectedFilters?.length) {
                const results = [];
                for (const id of selectedFilters) {
                    try {
                        const r = await ghlFetch(`/contacts/${id}`);
                        if (r.contact) results.push(r.contact);
                    } catch { }
                }
                return results;
            }
            return await ghlFetchAll('/contacts/', { locationId: loc }, { dataKey: 'contacts', limit: 100 });
        }
        case 'opportunities': {
            const pRes = await ghlFetch('/opportunities/pipelines', { locationId: loc });
            const pipelines = pRes.pipelines || [];
            // If filters selected, only fetch matching pipelines/stages
            const wantedPipelines = selectedFilters?.filter(f => f.startsWith('pipeline:')).map(f => f.split(':')[1]) || [];
            const wantedStages = selectedFilters?.filter(f => f.startsWith('stage:')).map(f => { const parts = f.split(':'); return { pipelineId: parts[1], stageId: parts[2] }; }) || [];
            let allOpps = [];
            for (const p of pipelines) {
                if (wantedPipelines.length && !wantedPipelines.includes(p.id)) continue;
                try {
                    const opps = await ghlFetchAll('/opportunities/search', { location_id: loc, pipeline_id: p.id }, { dataKey: 'opportunities', limit: 100 });
                    let filtered = opps.map(o => ({ ...o, pipelineName: p.name }));
                    if (wantedStages.length) {
                        const stageIds = wantedStages.filter(s => s.pipelineId === p.id).map(s => s.stageId);
                        if (stageIds.length) filtered = filtered.filter(o => stageIds.includes(o.pipelineStageId));
                    }
                    allOpps.push(...filtered);
                } catch { }
            }
            return { pipelines: wantedPipelines.length ? pipelines.filter(p => wantedPipelines.includes(p.id)) : pipelines, opportunities: allOpps };
        }
        case 'pipelines': {
            const r = await ghlFetch('/opportunities/pipelines', { locationId: loc });
            return applyFilter(r.pipelines || [], selectedFilters);
        }
        case 'tasks':
            try {
                let tasks = await ghlFetchAll('/contacts/tasks', { locationId: loc }, { dataKey: 'tasks', limit: 100 });
                if (selectedFilters?.length) {
                    tasks = tasks.filter(t => {
                        const isCompleted = t.status === 'completed' || t.completed;
                        if (selectedFilters.includes('completed') && isCompleted) return true;
                        if (selectedFilters.includes('pending') && !isCompleted) return true;
                        return false;
                    });
                }
                return tasks;
            }
            catch { return []; }
        case 'tags': { const r = await ghlFetch(`/locations/${loc}/tags`); return applyFilter(r.tags || [], selectedFilters); }
        case 'custom_fields': { const r = await ghlFetch(`/locations/${loc}/customFields`); return applyFilter(r.customFields || [], selectedFilters); }
        case 'custom_values': { const r = await ghlFetch(`/locations/${loc}/customValues`); return applyFilter(r.customValues || [], selectedFilters); }
        case 'conversations': {
            let data = await ghlFetchAll('/conversations/search', { locationId: loc }, { dataKey: 'conversations', limit: 100 });
            if (selectedFilters?.length) data = data.filter(c => selectedFilters.includes(c.type));
            return data;
        }
        case 'email_templates':
            try { const r = await ghlFetch('/emails/templates', { locationId: loc }); return applyFilter(r.templates || r.data || [], selectedFilters); }
            catch { return []; }
        case 'calendars': { const r = await ghlFetch('/calendars/', { locationId: loc }); return applyFilter(r.calendars || [], selectedFilters); }
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
        case 'workflows': { const r = await ghlFetch('/workflows/', { locationId: loc }); return applyFilter(r.workflows || [], selectedFilters); }
        case 'forms': { const r = await ghlFetch('/forms/', { locationId: loc }); return applyFilter(r.forms || [], selectedFilters); }
        case 'surveys':
            try { const r = await ghlFetch('/surveys/', { locationId: loc }); return applyFilter(r.surveys || [], selectedFilters); }
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

        // Derive record description (e.g. "Contact: John Doe")
        let description = req.params.moduleId;
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            const name = first.name || first.label || first.firstName || first.title || first.subject || first.id;
            description = `${req.params.moduleId}: ${name}${data.length > 1 ? ` (+${data.length - 1} more)` : ''}`;
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
            // Special cases like opportunities/reporting that might return objects
            if (data.opportunities?.length) {
                const first = data.opportunities[0];
                description = `Opportunities: ${first.name || first.contactName}${data.opportunities.length > 1 ? ` (+${data.opportunities.length - 1} more)` : ''}`;
            }
        }

        const { count } = await saveExport(req.params.moduleId, data, description);
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
app.get('/api/export-data/:moduleId', async (req, res) => {
    // Try Supabase first, fall back to filesystem
    try {
        const sbData = await readFromSupabase(req.params.moduleId, config.locationId);
        if (sbData) {
            const d = sbData.data;
            const count = Array.isArray(d) ? d.length : Object.keys(d).length;
            return res.json({ success: true, data: Array.isArray(d) ? d.slice(0, 200) : d, count, source: 'supabase' });
        }
    } catch { }
    // Filesystem fallback
    const fp = resolve(EXPORT_DIR, `${req.params.moduleId}.json`);
    if (!existsSync(fp)) return res.json({ success: false, data: null });
    try {
        const data = JSON.parse(readFileSync(fp, 'utf-8'));
        const count = Array.isArray(data) ? data.length : Object.keys(data).length;
        res.json({ success: true, data: Array.isArray(data) ? data.slice(0, 200) : data, count, source: 'filesystem' });
    } catch { res.json({ success: false, data: null }); }
});

app.get('/api/download/:moduleId', async (req, res) => {
    // Try Supabase first
    try {
        const sbData = await readFromSupabase(req.params.moduleId, config.locationId);
        if (sbData) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.moduleId}.json"`);
            return res.send(JSON.stringify(sbData.data, null, 2));
        }
    } catch { }
    // Filesystem fallback
    const fp = resolve(EXPORT_DIR, `${req.params.moduleId}.json`);
    if (!existsSync(fp)) return res.status(404).json({ error: 'Not exported yet' });
    res.download(fp, `${req.params.moduleId}.json`);
});

app.get('/api/manifest', async (req, res) => {
    // Try Supabase first
    try {
        const sbManifest = await getManifestFromSupabase(config.locationId);
        if (sbManifest && Object.keys(sbManifest).length) return res.json(sbManifest);
    } catch { }
    // Filesystem fallback
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
