const API = '';
const CAT_COLORS = { 'CRM': '#00d4ff', 'Messaging': '#8b5cf6', 'Calendar': '#22c55e', 'Automation': '#f59e0b', 'Sites': '#3b82f6', 'Settings': '#64748b', 'Analytics': '#6366f1' };

const MODULES = [
    { id: 'contacts', n: 'Contacts', icon: '👥', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'opportunities', n: 'Opportunities', icon: '🎯', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'pipelines', n: 'Pipelines', icon: '🔗', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'tasks', n: 'Tasks', icon: '✅', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'tags', n: 'Tags', icon: '🏷', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'custom_fields', n: 'Custom Fields', icon: '🗂', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'custom_values', n: 'Custom Values', icon: '🔣', cat: 'CRM', bg: 'rgba(0,212,255,.1)', dd: true },
    { id: 'conversations', n: 'Conversations', icon: '💬', cat: 'Messaging', bg: 'rgba(139,92,246,.1)', dd: true },
    { id: 'email_templates', n: 'Email Templates', icon: '📧', cat: 'Messaging', bg: 'rgba(139,92,246,.1)', dd: true },
    { id: 'calendars', n: 'Calendars', icon: '📅', cat: 'Calendar', bg: 'rgba(34,197,94,.1)', dd: true },
    { id: 'appointments', n: 'Appointments', icon: '🗓', cat: 'Calendar', bg: 'rgba(34,197,94,.1)', dd: false },
    { id: 'workflows', n: 'Workflows', icon: '⚙️', cat: 'Automation', bg: 'rgba(245,158,11,.1)', dd: true },
    { id: 'forms', n: 'Forms', icon: '📋', cat: 'Sites', bg: 'rgba(59,130,246,.1)', dd: true },
    { id: 'surveys', n: 'Surveys', icon: '📊', cat: 'Sites', bg: 'rgba(59,130,246,.1)', dd: true },
    { id: 'media', n: 'Media Library', icon: '🖼', cat: 'Settings', bg: 'rgba(100,116,139,.15)', dd: false },
    { id: 'reporting', n: 'Reporting', icon: '📈', cat: 'Analytics', bg: 'rgba(99,102,241,.1)', dd: true },
];
const MC = MODULES.length;

const S = {};
MODULES.forEach(m => initState(m.id));
function initState(id) { S[id] = { status: 'idle', expanded: false, error: null, filterItems: null, filterLoading: false, selected: [], selectAll: false, exportCount: 0, exportData: null }; }
function today() { return new Date().toISOString().split('T')[0]; }

// ── AUTH ──
function doSignin() {
    const e = document.getElementById('si-email').value.trim(), p = document.getElementById('si-pass').value;
    if (e === 'admin@kinetic.com' && p === 'kinetic123') {
        document.getElementById('signin-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        toast('Welcome back, Admin!', 't-green');
        fetch(API + '/api/test-connection').then(r => r.json()).then(d => {
            if (d.success) toast('GHL connected — ' + d.locationId, 't-green');
            else toast('GHL error: ' + (d.error || 'unknown'), 't-red');
        }).catch(() => toast('Backend not reachable', 't-red'));
    } else { const err = document.getElementById('si-err'); err.style.display = 'block'; setTimeout(() => err.style.display = 'none', 4000); }
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.getElementById('signin-screen').style.display !== 'none') doSignin(); });
function doLogout() { document.getElementById('app').style.display = 'none'; document.getElementById('signin-screen').style.display = 'flex'; MODULES.forEach(m => initState(m.id)); buildTable(); updateSummary(); }

// ── SIDEBAR ──
let sC = false;
function toggleSidebar() { sC = !sC; document.getElementById('sidebar').classList.toggle('collapsed', sC); document.getElementById('collapseBtn').textContent = sC ? '▶' : '◀'; document.querySelectorAll('.sb-sec-label,.lbl,.arr,.lt,.lb,#sb-user-info,.logout-btn').forEach(el => el.style.opacity = sC ? '0' : '1'); }
function navToggle(el) { const sub = el.nextElementSibling; if (sub?.classList.contains('sub')) { el.classList.toggle('open'); sub.classList.toggle('open'); } }

// ── NAVIGATION ──
function showView(view) {
    document.getElementById('view-transfer').style.display = view === 'transfer' ? 'block' : 'none';
    document.getElementById('view-workflows').style.display = view === 'workflows' ? 'block' : 'none';

    document.getElementById('nav-transfer').classList.toggle('active', view === 'transfer');
    document.getElementById('nav-workflows').classList.toggle('active', view === 'workflows');

    if (view === 'workflows') fetchWorkflowExports();
}

// ── TABLE ──
function buildTable() {
    const defFrom = '2024-01-01', defTo = today(), tb = document.getElementById('tableBody');
    tb.innerHTML = '';
    MODULES.forEach(m => {
        const cc = CAT_COLORS[m.cat] || '#9196b8', s = S[m.id];
        const mainTr = document.createElement('tr'); mainTr.className = 'mod-row'; mainTr.id = 'mrow-' + m.id;
        const expandCell = m.dd ? `<span class="expand-arr" id="earr-${m.id}">▸</span>` : '';
        const clickFn = m.dd ? `onclick="toggleDropdown('${m.id}')"` : '';
        mainTr.innerHTML = `
      <td><div class="mod-cell" ${clickFn}>
        <div class="mod-icon-bg" style="background:${m.bg}">${m.icon}</div>
        <div><div class="mod-name">${m.n}</div><div class="mod-meta" id="mmeta-${m.id}">${m.dd ? 'Click to load filters' : 'Date range filter only'}</div></div>
        ${expandCell}
      </div></td>
      <td style="padding:10px 16px"><span class="cat-badge" style="background:${cc}18;color:${cc};border:1px solid ${cc}30">${m.cat}</span></td>
      <td class="date-cell"><div class="date-row"><input type="date" id="from-${m.id}" value="${defFrom}"><span class="d-arr">→</span><input type="date" id="to-${m.id}" value="${defTo}"></div></td>
      <td class="act-cell">
        <button class="icon-btn ib-export" id="bex-${m.id}" onclick="doExport('${m.id}')" title="Export from GHL"><div class="exported-badge">✓</div><span class="ib-icon" id="iex-${m.id}">⬇</span><span class="ib-lbl" id="lbex-${m.id}">Export</span></button>
        <button class="icon-btn ib-import" id="bim-${m.id}" onclick="doImport('${m.id}')" title="Import to new site" disabled><div class="imported-badge">✓</div><span class="ib-icon" id="iim-${m.id}">⬆</span><span class="ib-lbl">Import</span></button>
      </td>
      <td class="status-cell" id="exst-${m.id}"><div class="status-mini"><div class="st-row"><span class="s-dot d-idle"></span><span class="s-idle-txt">Not started</span></div></div></td>
      <td class="status-cell" id="imst-${m.id}"><div class="status-mini"><div class="st-row"><span class="s-dot d-idle"></span><span class="s-idle-txt">Awaiting export</span></div></div></td>`;
        tb.appendChild(mainTr);
        if (m.dd) {
            const dpTr = document.createElement('tr'); dpTr.className = 'dropdown-row'; dpTr.id = 'drow-' + m.id;
            dpTr.innerHTML = `<td class="dropdown-td" colspan="6"><div class="dp-header"><span class="dp-title">Filter — ${m.n}</span><div class="dp-actions"><span class="dp-count" id="dc-${m.id}">Loading…</span><span class="dp-sep">·</span><button class="dp-link" onclick="selAll('${m.id}',true)">Select all</button><span class="dp-sep">·</span><button class="dp-link" onclick="selAll('${m.id}',false)">Deselect all</button></div></div><div class="items-grid" id="igrid-${m.id}"><div style="padding:20px;color:var(--text3);font-size:12px">Click to load filters from GHL…</div></div></td>`;
            tb.appendChild(dpTr);
        }
    });
}

// ── DYNAMIC FILTER LOADING ──
async function loadFilters(id) {
    const s = S[id]; if (s.filterItems || s.filterLoading) return;
    s.filterLoading = true;
    const grid = document.getElementById('igrid-' + id);
    grid.innerHTML = '<div style="padding:20px;color:var(--cyan);font-size:12px">⏳ Loading from GHL API…</div>';
    try {
        const r = await fetch(API + '/api/filters/' + id).then(x => x.json());
        if (!r.success) throw new Error(r.error || 'Failed');
        s.filterItems = r.items || [];
        s.selectAll = !!r.selectAll;
        s.selected = s.selectAll ? s.filterItems.map(i => i.id) : [];
        renderFilters(id);
    } catch (err) {
        grid.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">❌ ${err.message}</div>`;
    }
    s.filterLoading = false;
}

function renderFilters(id) {
    const s = S[id], grid = document.getElementById('igrid-' + id);
    if (!s.filterItems || !grid) return;
    const cnt = s.selected.length;
    const dc = document.getElementById('dc-' + id);
    if (dc) dc.textContent = `${cnt} / ${s.filterItems.length} selected`;
    document.getElementById('mmeta-' + id).textContent = `${cnt} of ${s.filterItems.length} selected`;
    let lastGroup = '';
    grid.innerHTML = s.filterItems.map((item, i) => {
        const checked = s.selected.includes(item.id);
        let groupHdr = '';
        if (item.group && item.group !== lastGroup) { lastGroup = item.group; groupHdr = `<div style="grid-column:1/-1;padding:8px 20px 2px;font-size:9px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;font-weight:600">${item.group}</div>`; }
        return groupHdr + `<div class="item-row ${checked ? 'checked' : ''}" onclick="toggleFilter('${id}','${item.id}')">
      <div class="item-check"><span class="item-check-icon">✓</span></div>
      <span class="item-label">${item.label}</span></div>`;
    }).join('');
}

function toggleFilter(id, filterId) {
    const s = S[id], idx = s.selected.indexOf(filterId);
    if (idx >= 0) s.selected.splice(idx, 1); else s.selected.push(filterId);
    renderFilters(id);
}
function selAll(id, val) {
    const s = S[id]; if (!s.filterItems) return;
    s.selected = val ? s.filterItems.map(i => i.id) : [];
    renderFilters(id);
}

function toggleDropdown(id) {
    const s = S[id]; s.expanded = !s.expanded;
    const dr = document.getElementById('drow-' + id);
    if (dr) { dr.classList.toggle('open', s.expanded); }
    const arr = document.getElementById('earr-' + id);
    if (arr) arr.textContent = s.expanded ? '▾' : '▸';
    document.getElementById('mrow-' + id).classList.toggle('expanded', s.expanded);
    if (s.expanded) loadFilters(id);
}

function applyGlobal() {
    const f = document.getElementById('g-from').value, t = document.getElementById('g-to').value;
    if (!f || !t) return;
    MODULES.forEach(m => { document.getElementById('from-' + m.id).value = f; document.getElementById('to-' + m.id).value = t; });
    toast('Date range applied to all modules');
}

// ── STATUS ──
function setExportStatus(id, phase) {
    const s = S[id], el = document.getElementById('exst-' + id);
    if (phase === 'running') el.innerHTML = `<div class="status-mini"><div class="st-row"><span class="s-dot d-run"></span><span class="s-cnt" style="color:var(--orange)">…</span><span class="s-lbl">Exporting</span></div></div>`;
    else if (phase === 'done') {
        const visualBtn = id === 'workflows' ? `<div style="margin-top:4px"><button onclick="openWorkflowViewer()" style="background:var(--cyan);color:#000;border:none;border-radius:4px;padding:3px 8px;font-size:9px;font-weight:700;cursor:pointer">👁 Open Visualizer</button></div>` : '';
        el.innerHTML = `<div class="status-mini"><div class="st-row click" onclick="openModal('${id}')"><span class="s-dot d-ok"></span><span class="s-cnt">${s.exportCount.toLocaleString()}</span><span class="s-lbl">Exported</span></div><div style="margin-top:4px"><a href="/api/download/${id}" style="font-size:9px;color:var(--cyan);text-decoration:none">⬇ Download JSON</a></div>${visualBtn}<div class="prog"><div class="prog-f pf-g" style="width:100%"></div></div></div>`;
    } else if (phase === 'failed') el.innerHTML = `<div class="status-mini"><div class="st-row"><span class="s-dot d-fail"></span><span class="s-cnt" style="color:var(--red)">✕</span><span class="s-lbl">Failed</span></div><div style="font-size:9px;color:var(--red);margin-top:3px;line-height:1.3;max-width:140px;word-break:break-word">${s.error || 'Unknown error'}</div></div>`;
}
function setImportStatus(id, phase) {
    const el = document.getElementById('imst-' + id);
    if (phase === 'idle') el.innerHTML = `<div class="status-mini"><div class="st-row"><span class="s-dot d-idle"></span><span class="s-idle-txt">Awaiting export</span></div></div>`;
    else if (phase === 'ready') el.innerHTML = `<div class="status-mini"><div class="st-row"><span class="s-dot d-idle"></span><span class="s-idle-txt">Ready to import</span></div></div>`;
    else if (phase === 'done') el.innerHTML = `<div class="status-mini"><div class="st-row"><span class="s-dot d-ok"></span><span class="s-cnt">${S[id].exportCount}</span><span class="s-lbl">Imported</span></div><div class="prog"><div class="prog-f pf-c" style="width:100%"></div></div></div>`;
}

// ── EXPORT (REAL API) ──
async function doExport(id) {
    const s = S[id]; if (s.status === 'exporting') return;
    const m = MODULES.find(x => x.id === id);
    s.status = 'exporting'; s.error = null;
    const bex = document.getElementById('bex-' + id), bim = document.getElementById('bim-' + id);
    const iex = document.getElementById('iex-' + id), lbex = document.getElementById('lbex-' + id);
    bex.disabled = true; bex.classList.add('running'); bim.disabled = true;
    iex.innerHTML = '<span class="spin">↻</span>'; lbex.textContent = '…';
    setExportStatus(id, 'running');
    try {
        const body = { selectedFilters: s.selected.length ? s.selected : undefined };
        const res = await fetch(API + '/api/export/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Export failed');
        s.status = 'exported'; s.exportData = data.data; s.exportCount = data.count;
        bex.disabled = false; bex.classList.remove('running'); bex.classList.add('exported');
        iex.innerHTML = '✓'; lbex.textContent = 'Exported';
        bim.classList.add('visible'); bim.disabled = false;
        setExportStatus(id, 'done'); setImportStatus(id, 'ready'); updateSummary();
        toast(m.n + ': ' + data.count + ' records exported', 't-green');
    } catch (err) {
        s.status = 'failed'; s.error = err.message;
        bex.disabled = false; bex.classList.remove('running');
        iex.innerHTML = '⬇'; lbex.textContent = 'Retry';
        setExportStatus(id, 'failed'); updateSummary();
        toast(m.n + ': ' + err.message, 't-red');
    }
}

// ── IMPORT (REAL API) ──
async function doImport(id) {
    const s = S[id]; if (s.status !== 'exported') return;
    s.status = 'importing';
    const bim = document.getElementById('bim-' + id), bex = document.getElementById('bex-' + id), iim = document.getElementById('iim-' + id);
    bim.disabled = true; bim.classList.add('running'); bex.disabled = true;
    iim.innerHTML = '<span class="spin">↻</span>';
    setImportStatus(id, 'running');

    try {
        const res = await fetch(API + '/api/import/' + id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: s.exportData })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Import failed');

        s.status = 'done';
        bim.disabled = false; bim.classList.remove('running'); bim.classList.add('imported'); iim.innerHTML = '✓'; bex.disabled = false;
        setImportStatus(id, 'done'); updateSummary();
        toast(MODULES.find(x => x.id === id).n + ' imported to target site', 't-green');
    } catch (err) {
        s.status = 'exported'; // Allow retry
        bim.disabled = false; bim.classList.remove('running'); iim.innerHTML = '⬆'; bex.disabled = false;
        setImportStatus(id, 'ready');
        toast('Import failed: ' + err.message, 't-red');
    }
}

function exportAll() { let d = 0; MODULES.forEach(m => { if (S[m.id].status === 'idle' || S[m.id].status === 'failed') { setTimeout(() => doExport(m.id), d); d += 2000; } }); }
function importAll() { MODULES.forEach((m, i) => { if (S[m.id].status === 'exported') setTimeout(() => doImport(m.id), i * 300); }); }
function resetAll() { MODULES.forEach(m => initState(m.id)); buildTable(); updateSummary(); toast('All modules reset'); }

function updateSummary() {
    let done = 0, exp = 0, ok = 0, fail = 0;
    MODULES.forEach(m => { const s = S[m.id]; if (s.status === 'exported' || s.status === 'done') exp++; if (s.status === 'done') done++; ok += s.exportCount || 0; if (s.status === 'failed') fail++; });
    document.getElementById('s-done').textContent = done + ' / ' + MC;
    document.getElementById('s-ok').textContent = ok.toLocaleString();
    document.getElementById('s-err').textContent = '0';
    document.getElementById('s-fail').textContent = fail;
    document.getElementById('sc-exp').textContent = exp;
    document.getElementById('sc-imp').textContent = done;
    document.getElementById('sc-fail').textContent = fail;
}

// ── MODAL ──
function openModal(id) { renderModal(id); document.getElementById('modalOverlay').classList.add('open'); }
function closeModal(e) { if (e.target === document.getElementById('modalOverlay')) closeModalDirect(); }
function closeModalDirect() { document.getElementById('modalOverlay').classList.remove('open'); }

async function renderModal(id) {
    const m = MODULES.find(x => x.id === id);
    document.getElementById('m-title').innerHTML = `<span style="font-size:18px">${m.icon}</span> ${m.n} <span style="font-size:11px;color:var(--text3);font-weight:400">EXPORT DATA</span>`;
    document.getElementById('m-tabs').innerHTML = `<div class="m-tab active">ALL RECORDS</div>`;
    document.getElementById('m-filter').textContent = 'Loading…';
    const body = document.getElementById('m-body');
    body.innerHTML = '<div class="modal-empty">Loading data…</div>';
    try {
        const r = await fetch(API + '/api/export-data/' + id).then(x => x.json());
        if (!r.success || !r.data) { body.innerHTML = '<div class="modal-empty">No data available.</div>'; return; }
        const data = Array.isArray(r.data) ? r.data : Object.entries(r.data).map(([k, v]) => ({ key: k, value: v }));
        document.getElementById('m-filter').textContent = `Showing ${Math.min(data.length, 200)} of ${r.count} records · Download: /api/download/${id}`;
        if (!data.length) { body.innerHTML = '<div class="modal-empty">0 records.</div>'; return; }
        body.innerHTML = data.slice(0, 200).map((rec, i) => {
            const name = rec.contactName || rec.name || rec.firstName || rec.email || rec.label || rec.title || rec.key || ('Record #' + (i + 1));
            const meta = [rec.id || rec._id, rec.email, rec.phone, rec.dateAdded || rec.createdAt].filter(Boolean).join(' · ');
            return `<div class="rec-item"><div class="rec-av av-ok">${String(name).slice(0, 2).toUpperCase()}</div><div><div class="rec-name">${name}</div><div class="rec-meta">${meta || m.n}</div><span class="rec-tag t-ok">✓ EXPORTED</span></div></div>`;
        }).join('');
    } catch (e) { body.innerHTML = `<div class="modal-empty">Error: ${e.message}</div>`; }
}

// ── WORKFLOW VISUALIZER ──
function openWfModal(e) { if (e.target === document.getElementById('wfModalOverlay')) closeWfModalDirect(); }
function closeWfModalDirect() { document.getElementById('wfModalOverlay').classList.remove('open'); }
function closeWfModal(e) { if (e.target === document.getElementById('wfModalOverlay')) closeWfModalDirect(); }

async function fetchWorkflowExports() {
    const body = document.getElementById('workflowListBody');
    body.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--cyan)">⏳ Loading historical exports…</td></tr>';
    try {
        const r = await fetch(API + '/api/exports-list/workflows').then(x => x.json());
        if (!r.success || !r.exports.length) {
            body.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--text3)">No workflows exported yet.</td></tr>';
            return;
        }

        body.innerHTML = r.exports.map(exp => {
            const date = new Date(exp.exported_at).toLocaleString();
            const isReal = !!(exp.data?.definition || exp.data?.nodes);
            return `
                <tr class="mod-row">
                    <td style="padding:14px 20px">
                        <div style="display:flex;align-items:center;gap:10px">
                            <div style="font-weight:600;color:var(--text)">${exp.description}</div>
                            ${isReal ? '<span style="background:var(--cyan);color:#000;font-size:8px;padding:2px 6px;border-radius:10px;font-weight:700">REAL LOGIC</span>' : ''}
                        </div>
                        <div style="font-size:10px;color:var(--text3)">Ref: ${exp.id.slice(0, 8)}...</div>
                    </td>
                    <td style="padding:14px 20px">${exp.record_count} workflows</td>
                    <td style="padding:14px 20px;color:var(--text2)">${date}</td>
                    <td style="padding:14px 20px">
                        <button class="tb-btn" style="font-size:10px;padding:5px 12px;background:var(--purple);color:#fff" onclick='renderWfFromData(${JSON.stringify(exp.data)})'>👁 View Logic Tree</button>
                        <button class="tb-btn" style="font-size:10px;padding:5px 12px;background:var(--cyan);color:#000;margin-left:5px" onclick="triggerWfSync('${exp.id}')">🔄 Sync Real Logic</button>
                    </td>
                    <td style="padding:14px 20px">
                        <a href="/api/export-data/workflows?exportId=${exp.id}" target="_blank" class="dp-link" style="color:var(--cyan)">Download JSON</a>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        body.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--red)">Error: ${e.message}</td></tr>`;
    }
}

let syncExportId = null;
function triggerWfSync(id) {
    syncExportId = id;
    document.getElementById('wfSyncInput').click();
}

async function handleWfSync(event) {
    const file = event.target.files[0];
    if (!file || !syncExportId) return;

    try {
        const text = await file.text();
        const realData = JSON.parse(text);

        const res = await fetch(`${API}/api/sync-workflow-logic/${syncExportId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ realData })
        }).then(r => r.json());

        if (res.success) {
            alert('Workflow logic synced successfully! Refreshing list...');
            fetchWorkflowExports();
        } else {
            alert('Sync failed: ' + res.error);
        }
    } catch (e) {
        alert('Invalid JSON file: ' + e.message);
    } finally {
        event.target.value = ''; // Reset input
    }
}

function renderWfFromData(data) {
    const overlay = document.getElementById('wfModalOverlay');
    const flow = document.getElementById('wf-flow');
    overlay.classList.add('open');
    flow.innerHTML = '';

    const workflows = Array.isArray(data) ? data : [data];

    workflows.forEach(w => {
        let trigger = { type: 'Start', label: 'Workflow' };
        let actions = [];
        let isReal = !!(w.definition || w.nodes);

        if (w.reconstructedDefinition) {
            trigger = w.reconstructedDefinition.trigger;
            actions = w.reconstructedDefinition.actions;
        } else if (w.definition) {
            // Native GHL Export Format
            const d = w.definition;
            if (d.triggers && d.triggers[0]) {
                const t = d.triggers[0];
                trigger = { type: t.type, label: t.label || t.name || t.type };
            }
            if (d.actions) {
                actions = d.actions.map(a => ({ type: a.type, label: a.label || a.name || a.type }));
            }
        } else if (w.nodes) {
            // Alternative GHL Export Format
            const triggerNode = w.nodes.find(n => n.type === 'trigger' || n.triggerType);
            if (triggerNode) {
                trigger = { type: triggerNode.type, label: triggerNode.label || triggerNode.name };
            }
            actions = w.nodes.filter(n => n !== triggerNode).map(n => ({ type: n.type, label: n.label || n.name || n.type }));
        }

        const group = document.createElement('div');
        group.className = 'wf-flow-group';
        group.style.width = '100%';
        group.style.display = 'flex';
        group.style.flexDirection = 'column';
        group.style.alignItems = 'center';
        group.style.gap = '40px';
        group.style.marginBottom = '80px';

        group.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:-20px">
                <div style="color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:700">Workflow: ${w.name}</div>
                ${isReal ? '<span style="background:var(--cyan);color:#000;font-size:8px;padding:2px 6px;border-radius:10px;font-weight:700">REAL LOGIC</span>' : '<span style="background:var(--purple);color:#fff;font-size:8px;padding:2px 6px;border-radius:10px;font-weight:700">RECONSTRUCTED</span>'}
            </div>
        `;

        // Trigger
        group.innerHTML += `
            <div class="wf-node trigger">
                <div class="wf-type">${trigger.type || 'Trigger'}</div>
                <div class="wf-label">${trigger.label}</div>
            </div>
        `;

        // Actions
        actions.slice(0, 15).forEach(act => { // Cap to 15 for visual clarity
            group.innerHTML += `
                <div class="wf-node ${act.type?.toLowerCase() === 'placeholder' ? 'placeholder' : ''}">
                    <div class="wf-type">${act.type}</div>
                    <div class="wf-label">${act.label}</div>
                </div>
            `;
        });

        if (actions.length > 15) {
            group.innerHTML += `<div style="color:var(--text3);font-size:11px">... and ${actions.length - 15} more nodes</div>`;
        }

        flow.appendChild(group);
    });
}

async function openWorkflowViewer() {
    // Legacy support for the button in the main table
    showView('workflows');
}

// ── TOAST ──
function toast(msg, cls = '') { const s = document.getElementById('toastStack'), t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg; s.appendChild(t); setTimeout(() => t.remove(), 4000); }

// ── INIT ──
document.getElementById('g-to').value = today();
buildTable(); updateSummary();
