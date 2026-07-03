import api from './owner-api.js';

function loadScript(src, opts = {}) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`) || document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; if (opts.async) s.async = true; if (opts.defer) s.defer = true; s.setAttribute('data-src', src); s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src)); document.body.appendChild(s);
  });
}

async function ensureXLSX() {
  if (window.XLSX) return;
  await loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js', { defer: true });
}

const PAGE_SIZE = 25;

function createTableRow(u) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${escapeHtml(u.email||u.mobile||'')}</td>
    <td>${escapeHtml(u.name||'')}</td>
    <td>${escapeHtml(u.role||'')}</td>
    <td>${escapeHtml(u.firmName||'')}</td>
    <td>${escapeHtml(u.email||'')}</td>
    <td>${escapeHtml(u.mobile||'')}</td>
    <td>${escapeHtml(String(u.approved))}</td>
    <td>${escapeHtml(u.status||'')}</td>
    <td>${escapeHtml(String(u.totalPoints||0))}</td>
    <td>${escapeHtml(u.registeredAt||'')}</td>
    <td>
      <button class="btn-secondary btn-sm view-user" data-id="${encodeURIComponent(u.email||u.mobile||u.name)}">View</button>
      <button class="btn-secondary btn-sm approve-user" data-id="${encodeURIComponent(u.email||u.mobile||u.name)}">Approve</button>
      <button class="btn-secondary btn-sm reject-user" data-id="${encodeURIComponent(u.email||u.mobile||u.name)}">Reject</button>
      <button class="btn-secondary btn-sm suspend-user" data-id="${encodeURIComponent(u.email||u.mobile||u.name)}">Suspend</button>
      <button class="btn-secondary btn-sm activate-user" data-id="${encodeURIComponent(u.email||u.mobile||u.name)}">Activate</button>
      <button class="btn-danger btn-sm delete-user" data-id="${encodeURIComponent(u.email||u.mobile||u.name)}">Delete</button>
    </td>
  `;
  return tr;
}

function escapeHtml(s) { return String(s||'').replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export default function initOwnerUsers(rootId = 'ownerUsersPanel') {
  const container = document.getElementById(rootId) || document.getElementById('ownerDashboard');
  if (!container) return;
  // build controls
  const controls = document.createElement('div');
  controls.className = 'owner-users-controls';
  controls.innerHTML = `
    <input id="ownerUserSearchBox" placeholder="Search users..." />
    <button id="ownerUsersExportCsv" class="btn-secondary">Export CSV</button>
  `;
  container.appendChild(controls);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'owner-users-table-wrap';
  tableWrap.innerHTML = `
    <table class="owner-users-table"><thead><tr><th>User ID</th><th>Name</th><th>Role</th><th>Firm</th><th>Email</th><th>Mobile</th><th>Approved</th><th>Account Status</th><th>Points</th><th>Registered</th><th>Actions</th></tr></thead><tbody id="ownerUsersTableBody"></tbody></table>
    <div class="owner-users-pager" id="ownerUsersPager"></div>
  `;
  container.appendChild(tableWrap);

  const searchBox = document.getElementById('ownerUserSearchBox');
  const exportBtn = document.getElementById('ownerUsersExportCsv');
  const tbody = document.getElementById('ownerUsersTableBody');
  const pager = document.getElementById('ownerUsersPager');

  let currentPage = 1;
  let lastQuery = '';

  async function loadPage(page = 1, query = '') {
    currentPage = page;
    lastQuery = query;
    tbody.innerHTML = '<tr><td colspan="11">Loading...</td></tr>';
    try {
      const res = await api.getUsers({ page, pageSize: PAGE_SIZE, query });
      const users = res.users || [];
      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="11">No users found</td></tr>';
      } else {
        tbody.innerHTML = users.map(u => createTableRow(u).outerHTML).join('');
      }
      attachRowHandlers();
      renderPager(res.total || users.length, page);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="11">Error loading users: ${escapeHtml(err.message||String(err))}</td></tr>`;
    }
  }

  function renderPager(total, page) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pager.innerHTML = '';
    for (let p=1;p<=pages;p++){
      const b = document.createElement('button');
      b.textContent = p;
      b.className = p===page? 'active' : '';
      b.addEventListener('click', ()=> loadPage(p, lastQuery));
      pager.appendChild(b);
    }
  }

  function attachRowHandlers(){
    // Delegate clicks to tbody to reduce number of listeners
    tbody.removeEventListener('click', tbody._delegatedHandler);
    const handler = async (e) => {
      const btn = e.target.closest('button');
      if (!btn || !tbody.contains(btn)) return;
      const id = decodeURIComponent(btn.getAttribute('data-id') || '');
      if (btn.classList.contains('approve-user')) {
        if (!confirm('Approve user '+id+'?')) return;
        btn.disabled = true;
        try { await api.updateUser('approve', id); await loadPage(currentPage,lastQuery); } catch (err) { alert('Approve failed: '+err.message); } finally { btn.disabled = false; }
      } else if (btn.classList.contains('reject-user')) {
        if (!confirm('Reject user '+id+'?')) return;
        btn.disabled = true;
        try { await api.updateUser('reject', id); await loadPage(currentPage,lastQuery); } catch (err) { alert('Reject failed: '+err.message); } finally { btn.disabled = false; }
      } else if (btn.classList.contains('suspend-user')) {
        if (!confirm('Suspend user '+id+'?')) return;
        btn.disabled = true;
        try { await api.updateUser('suspend', id); await loadPage(currentPage,lastQuery); } catch (err) { alert('Suspend failed: '+err.message); } finally { btn.disabled = false; }
      } else if (btn.classList.contains('activate-user')) {
        if (!confirm('Activate user '+id+'?')) return;
        btn.disabled = true;
        try { await api.updateUser('activate', id); await loadPage(currentPage,lastQuery); } catch (err) { alert('Activate failed: '+err.message); } finally { btn.disabled = false; }
      } else if (btn.classList.contains('delete-user')) {
        if (!confirm('Delete user '+id+'? This is irreversible.')) return;
        btn.disabled = true;
        try { await api.updateUser('delete', id); await loadPage(currentPage,lastQuery); } catch (err) { alert('Delete failed: '+err.message); } finally { btn.disabled = false; }
      } else if (btn.classList.contains('view-user')) {
        alert('View user: '+id);
      }
    };
    tbody.addEventListener('click', handler);
    tbody._delegatedHandler = handler;
  }

  exportBtn.addEventListener('click', async () => {
    try {
      const res = await api.getUsers({ page:1, pageSize: 10000, query: lastQuery });
      const users = res.users || [];
      if (!users.length) return alert('No users to export');
      const headers = ['userId','name','role','firmName','email','mobile','approved','status','totalPoints','registeredAt'];
      const rows = users.map(u => headers.map(h => u[h]||''));
      await ensureXLSX();
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Users');
      const wbout = window.XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const blob = new Blob([wbout], {type:'application/octet-stream'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'users.xlsx'; document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { alert('Export failed: '+err.message); }
  });

  searchBox.addEventListener('input', () => { loadPage(1, searchBox.value.trim()); });

  loadPage(1,'');
}
