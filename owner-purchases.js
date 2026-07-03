import api from './owner-api.js';

export default function initOwnerPurchases(rootId='ownerPurchasesPanel'){
  const container = document.getElementById(rootId) || document.getElementById('ownerDashboard');
  if (!container) return;
  const wrap = document.createElement('div');
  wrap.className = 'owner-purchases-wrap';
  wrap.innerHTML = `
    <h3>Pending Purchase Approvals</h3>
    <table class="purchase-table"><thead><tr><th>Request ID</th><th>Customer</th><th>Product</th><th>Qty</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody id="ownerPurchasesBody"></tbody></table>`;
  container.appendChild(wrap);

  const body = document.getElementById('ownerPurchasesBody');

  async function loadPurchases(){
    body.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
    try{
      const res = await api.getPurchases({ status: 'pending' });
      const purchases = res.purchases || [];
      body.innerHTML = purchases.map(p=> `<tr><td>${escapeHtml(p.requestId)}</td><td>${escapeHtml(p.submitterName||p.submitterEmail||p.submitterMobile)}</td><td>${escapeHtml(p.productName)}</td><td>${escapeHtml(p.quantity)}</td><td>${escapeHtml(p.amount)}</td><td>${escapeHtml(p.status)}</td><td><button class="approve-purchase" data-id="${encodeURIComponent(p.requestId)}">Approve</button><button class="reject-purchase" data-id="${encodeURIComponent(p.requestId)}">Reject</button></td></tr>`).join('');
      attachHandlers();
    }catch(err){ body.innerHTML = `<tr><td colspan="7">Error: ${escapeHtml(err.message||String(err))}</td></tr>`; }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]+/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function attachHandlers(){
    body.querySelectorAll('.approve-purchase').forEach(btn => btn.addEventListener('click', ()=>{
      const id = decodeURIComponent(btn.dataset.id);
      if(!confirm('Approve purchase '+id+'?')) return;
      api.approvePurchase(id).then(()=> { loadPurchases(); alert('Approved'); }).catch(e=> alert('Approve failed: '+e.message));
    }));
    body.querySelectorAll('.reject-purchase').forEach(btn => btn.addEventListener('click', ()=>{
      const id = decodeURIComponent(btn.dataset.id);
      const remark = prompt('Reason for rejection (optional)');
      api.rejectPurchase(id, remark||'').then(()=> { loadPurchases(); alert('Rejected'); }).catch(e=> alert('Reject failed: '+e.message));
    }));
  }

  loadPurchases();
}
