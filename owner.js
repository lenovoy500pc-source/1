// owner.js - Owner portal module
let H = null; // helpers

function q(id) { return document.getElementById(id); }

function safeGetPurchaseRequests() {
    return (H && typeof H.getPurchaseRequests === 'function') ? H.getPurchaseRequests() : [];
}

function safeSetPurchaseRequests(v) {
    if (H && typeof H.setPurchaseRequests === 'function') H.setPurchaseRequests(v);
}

function initOwnerModule(helpers = {}) {
    H = helpers || {};
    // verify session and roles (owner/admin) via server; if unauthorized redirect to login
    try {
        const token = (H && typeof H.getSessionToken === 'function') ? H.getSessionToken() : null;
        if (!token || typeof H.validateSessionWithServer !== 'function') {
            // cannot validate; redirect to login
            window.location.href = './index.html';
            return;
        }
        H.validateSessionWithServer(token).then(res => {
            if (!res || !res.user || !(res.isOwner || res.isAdmin)) {
                window.location.href = './index.html';
            }
        }).catch(() => { window.location.href = './index.html'; });
    } catch (e) { window.location.href = './index.html'; }
    // attach remarks modal listeners
    const submitRemarksBtn = q('submitRemarksBtn');
    const closeRemarksModal = q('closeRemarksModal');
    const cancelRemarksBtn = q('cancelRemarksBtn');
    if (closeRemarksModal) closeRemarksModal.addEventListener('click', () => closeRemarksModalFn());
    if (cancelRemarksBtn) cancelRemarksBtn.addEventListener('click', () => closeRemarksModalFn());
    if (submitRemarksBtn) submitRemarksBtn.addEventListener('click', () => {
        // delegate to module process
        if (pendingApprovalRequest) {
            const remark = (q('remarksText') && q('remarksText').value || '').trim();
            processPurchaseApproval(pendingApprovalRequest.requestId, pendingApprovalRequest.approved, remark);
            closeRemarksModalFn();
        }
    });
    // Initialize submodules (UI, users, products, purchases)
    import('./owner-ui.js').then(m => { if (m && typeof m.initOwnerUI === 'function') m.initOwnerUI(); }).catch(() => {});
    import('./owner-users.js').then(m => { if (m && typeof m.default === 'function') m.default(); }).catch(() => {});
    import('./owner-products.js').then(m => { if (m && typeof m.default === 'function') m.default(); }).catch(() => {});
    import('./owner-purchases.js').then(m => { if (m && typeof m.default === 'function') m.default(); }).catch(() => {});
}

// expose helper to get current user if available
function getCurrentUser() { return (H && H.loadSession) ? H.loadSession().user : (H && H.getCurrentUser ? H.getCurrentUser() : null); }

// provide getCurrentUser to helpers
Object.defineProperty(window, 'ownerHelpers', { get() { return { getCurrentUser }; } });

function renderOwnerUsers() {
    const container = q('ownerRecentRegistrations');
    if (!container) return;
    container.innerHTML = '<li>Loading users...</li>';
    const localUsers = (H && H.loadLocalUsers) ? H.loadLocalUsers() : [];
    (H && H.loadUsersFromServer ? H.loadUsersFromServer() : Promise.resolve([])).then(serverUsersRaw => {
        const serverUsers = (H && H.normalizeCredentialList) ? H.normalizeCredentialList(serverUsersRaw || []) : (serverUsersRaw || []);
        const merged = [...serverUsers, ...localUsers];
        const dedup = merged.filter((u, i, arr) => i === arr.findIndex(v => (v.email || v.mobile) === (u.email || u.mobile)));
        if (!dedup.length) {
            container.innerHTML = '<li>No users found</li>';
            return;
        }
        container.innerHTML = '';
        dedup.slice(0, 50).forEach(user => {
            const li = document.createElement('li');
            const name = encodeHtml(user.name || user.email || user.mobile || 'Unknown');
            const cat = encodeHtml(user.category || '');
            const approved = user.approved ? ' (Approved)' : '';
            li.innerHTML = `${name} - ${cat} ${approved} <button class="btn-secondary approve-user-btn" data-user="${encodeURIComponent(user.email||user.mobile||user.name)}">Approve</button> <button class="btn-secondary reject-user-btn" data-user="${encodeURIComponent(user.email||user.mobile||user.name)}">Reject</button>`;
            container.appendChild(li);
        });
        attachOwnerControls();
    }).catch(err => {
        container.innerHTML = '<li>Error loading users</li>';
        console.warn('Error loading owner users:', err);
    });
}

function attachOwnerControls() {
    const ownerHeader = q('ownerDashboard') ? q('ownerDashboard').querySelector('.owner-header') : null;
    if (ownerHeader && !q('ownerUserSearch')) {
        const search = document.createElement('input');
        search.id = 'ownerUserSearch';
        search.placeholder = 'Search users by name/email/mobile';
        search.className = 'owner-search';
        search.addEventListener('input', () => filterOwnerUsers(search.value));
        ownerHeader.appendChild(search);
    }
    if (ownerHeader && !q('ownerExportBtn')) {
        const btn = document.createElement('button');
        btn.id = 'ownerExportBtn';
        btn.className = 'btn-secondary';
        btn.textContent = 'Export Users CSV';
        btn.addEventListener('click', exportUsersCsv);
        ownerHeader.appendChild(btn);
    }
    const container = q('ownerRecentRegistrations');
    if (!container) return;
    container.querySelectorAll('.approve-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = decodeURIComponent(btn.getAttribute('data-user'));
            approveUserByKey(key);
        });
    });
    container.querySelectorAll('.reject-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = decodeURIComponent(btn.getAttribute('data-user'));
            rejectUserByKey(key);
        });
    });
}

function filterOwnerUsers(query) {
    const qstr = (query || '').toString().trim().toLowerCase();
    const container = q('ownerRecentRegistrations');
    if (!container) return;
    const items = Array.from(container.querySelectorAll('li'));
    items.forEach(li => {
        const text = li.textContent.toLowerCase();
        li.style.display = qstr && !text.includes(qstr) ? 'none' : '';
    });
}

function approveUserByKey(key) {
    const norm = key.toString().trim().toLowerCase();
    const users = (H && H.loadLocalUsers) ? H.loadLocalUsers() : [];
    let updated = false;
    for (const u of users) {
        if ((u.email||u.mobile||u.name||'').toString().toLowerCase() === norm) {
            u.approved = true;
            updated = true;
        }
    }
    if (updated) {
        if (H && H.persistLocalUsers) H.persistLocalUsers(users);
        if (H && H.showMessage) H.showMessage('User approved locally.', 'success');
        renderOwnerUsers();
    } else {
        if (H && H.showMessage) H.showMessage('User not found locally. Consider syncing with server.', 'error');
    }
}

function rejectUserByKey(key) {
    const norm = key.toString().trim().toLowerCase();
    let users = (H && H.loadLocalUsers) ? H.loadLocalUsers() : [];
    const before = users.length;
    users = users.filter(u => (u.email||u.mobile||u.name||'').toString().toLowerCase() !== norm);
    if (users.length !== before) {
        if (H && H.persistLocalUsers) H.persistLocalUsers(users);
        if (H && H.showMessage) H.showMessage('User removed locally.', 'success');
        renderOwnerUsers();
    } else {
        if (H && H.showMessage) H.showMessage('User not found locally.', 'error');
    }
}

function exportUsersCsv() {
    const users = (H && H.loadLocalUsers) ? H.loadLocalUsers() : [];
    if (!users.length) {
        if (H && H.showMessage) H.showMessage('No users to export.', 'error');
        return;
    }
    const headers = ['name','email','mobile','category','city','firmName'];
    const rows = users.map(u => headers.map(h => `"${(u[h]||'').toString().replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function computeOwnerSummary() {
    try {
        const users = (H && H.normalizeCredentialList) ? H.normalizeCredentialList((H && H.loadLocalUsers) ? H.loadLocalUsers() : []) : [];
        const totalRetailers = users.filter(u => (u.category || '').toString().toLowerCase() === 'retailer').length;
        const activeMechanics = users.filter(u => (u.category || '').toString().toLowerCase() === 'mechanic').length;
        const requests = safeGetPurchaseRequests();
        const pointsIssued = (requests || []).reduce((sum, r) => sum + (r.pointsAwarded || 0), 0);
        const elTotal = q('ownerTotalRetailers');
        const elActive = q('ownerActiveMechanics');
        const elPoints = q('ownerPointsIssued');
        if (elTotal) elTotal.textContent = String(totalRetailers || elTotal.textContent);
        if (elActive) elActive.textContent = String(activeMechanics || elActive.textContent);
        if (elPoints) elPoints.textContent = String(pointsIssued || elPoints.textContent);
    } catch (err) {
        console.warn('Could not compute owner summary:', err);
    }
}

function renderOwnerPendingRequests() {
    const ownerPendingRequestsBody = q('ownerPendingRequestsBody');
    if (!ownerPendingRequestsBody) return;
    const requests = safeGetPurchaseRequests() || [];
    const rows = requests.map(request => {
                const statusText = String(request.status || '').toLowerCase();
                const isPending = statusText.includes('pending');
                const actionButtons = isPending
                        ? `<button class="btn-secondary approve-request-btn" data-request-id="${encodeURIComponent(request.requestId)}" data-action="approve">Approve</button>
                             <button class="btn-secondary reject-request-btn" data-request-id="${encodeURIComponent(request.requestId)}" data-action="reject">Reject</button>`
                        : '<span class="status-label">No action</span>';
                const submitter = encodeHtml(request.submitterName || request.submitterEmail || request.submitterMobile || 'Customer');
                const product = encodeHtml(request.productName || request.productId || 'Unknown');
                const pack = encodeHtml(request.packSize || '-');
                const qty = Number(request.quantity || 0);
                const amt = request.amount && request.amount.toFixed ? request.amount.toFixed(2) : request.amount;
                const status = encodeHtml(request.status || '');
                return `
                    <tr>
                        <td>${submitter}</td>
                        <td>${product}</td>
                        <td>${pack}</td>
                        <td>${qty}</td>
                        <td>${amt}</td>
                        <td>${status}</td>
                        <td>${actionButtons}</td>
                    </tr>`;
    }).join('');
    ownerPendingRequestsBody.innerHTML = rows;
    ownerPendingRequestsBody.querySelectorAll('.approve-request-btn').forEach(button => {
        button.addEventListener('click', () => {
            const requestId = button.getAttribute('data-request-id');
            showApprovalRemarks(requestId, true);
        });
    });
    ownerPendingRequestsBody.querySelectorAll('.reject-request-btn').forEach(button => {
        button.addEventListener('click', () => {
            const requestId = button.getAttribute('data-request-id');
            showApprovalRemarks(requestId, false);
        });
    });
}

function encodeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

let pendingApprovalRequest = null;

function showApprovalRemarks(requestId, approved) {
    pendingApprovalRequest = { requestId, approved };
    const remarksText = q('remarksText');
    const remarksTitle = q('remarksTitle');
    const remarksModal = q('remarksModal');
    if (remarksText) remarksText.value = '';
    const actionText = approved ? 'Approve' : 'Reject';
    if (remarksTitle) remarksTitle.textContent = actionText + ' Request - Add Remark';
    if (remarksModal) remarksModal.style.display = 'flex';
}

function closeRemarksModalFn() {
    const remarksModal = q('remarksModal');
    const remarksText = q('remarksText');
    if (remarksModal) remarksModal.style.display = 'none';
    if (remarksText) remarksText.value = '';
    pendingApprovalRequest = null;
}

function processPurchaseApproval(requestId, approved, remark = '') {
    const requests = safeGetPurchaseRequests() || [];
    const requestIndex = (requests || []).findIndex(r => r.requestId === requestId);
    if (requestIndex < 0) return;
    const request = requests[requestIndex];
    // Attempt to submit approval to server first
    const attemptServerApproval = () => {
        import('./owner-api.js').then(api => {
            if (!api) throw new Error('owner-api missing');
            const method = approved ? api.approvePurchase : api.rejectPurchase;
            return method(requestId, remark || '');
        }).then(res => {
            // server approved/rejected successfully
            request.status = approved ? 'Approved by Owner' : 'Rejected by Owner';
            request.actionBy = (H && H.getCurrentUser && H.getCurrentUser().name) || 'Owner';
            request.actionAt = new Date().toISOString();
            request.remark = remark || '';
            if (approved && !request.pointsAwarded) {
                request.pointsAwarded = Math.max(10, Math.round((request.amount || 0) / 10));
            }
            requests[requestIndex] = request;
            safeSetPurchaseRequests(requests);
            if (H && H.savePurchaseRequests) H.savePurchaseRequests();
            if (H && H.logPurchaseApproval) H.logPurchaseApproval(request, approved);
            renderOwnerPendingRequests();
        }).catch(err => {
            // Handle duplicate / already-processed errors gracefully
            const msg = err && err.message ? err.message : String(err);
            if (msg.includes('already processed') || msg.includes('409')) {
                if (H && H.showMessage) H.showMessage('This request was already processed on the server.', 'warning');
                // Refresh local state to reflect server truth by marking processed locally
                request.status = 'Processed on Server';
                requests[requestIndex] = request;
                safeSetPurchaseRequests(requests);
                if (H && H.savePurchaseRequests) H.savePurchaseRequests();
                renderOwnerPendingRequests();
                return;
            }
            if (H && H.showMessage) H.showMessage('Server approval failed: ' + msg, 'error');
        });
    };

    // If we have a session token, prefer server-side approval; otherwise update local only
    try {
        const token = (H && H.getSessionToken) ? H.getSessionToken() : null;
        if (token) {
            attemptServerApproval();
        } else {
            // fall back to local-only update
            request.status = approved ? 'Approved by Owner (local)' : 'Rejected by Owner (local)';
            request.actionBy = (H && H.getCurrentUser && H.getCurrentUser().name) || 'Owner';
            request.actionAt = new Date().toISOString();
            request.remark = remark || '';
            if (approved && !request.pointsAwarded) {
                request.pointsAwarded = Math.max(10, Math.round((request.amount || 0) / 10));
            }
            requests[requestIndex] = request;
            safeSetPurchaseRequests(requests);
            if (H && H.savePurchaseRequests) H.savePurchaseRequests();
            if (H && H.logPurchaseApproval) H.logPurchaseApproval(request, approved);
            renderOwnerPendingRequests();
        }
    } catch (e) {
        if (H && H.showMessage) H.showMessage('Approval failed: ' + (e && e.message ? e.message : e), 'error');
    }
}

export { initOwnerModule, renderOwnerUsers, attachOwnerControls, renderOwnerPendingRequests, computeOwnerSummary, closeRemarksModalFn, processPurchaseApproval };
