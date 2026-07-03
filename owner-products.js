import api from './owner-api.js';

export default function initOwnerProducts(rootId='ownerProductsPanel'){
  const container = document.getElementById(rootId) || document.getElementById('ownerDashboard');
  if (!container) return;
  const wrap = document.createElement('div');
  wrap.className = 'owner-products-wrap';
  wrap.innerHTML = `
    <div class="owner-products-actions">
      <button id="ownerAddProduct" class="btn-primary">Add Product</button>
      <input id="ownerProductSearch" placeholder="Search products" />
      <input type="file" id="ownerProductsBulk" accept=".csv,.xlsx" />
    </div>
    <div id="ownerProductsTable"><table><thead><tr><th>Product ID</th><th>Name</th><th>Brand</th><th>Category</th><th>MRP</th><th>Stock</th><th>Actions</th></tr></thead><tbody id="ownerProductsBody"></tbody></table></div>`;
  container.appendChild(wrap);

  const body = document.getElementById('ownerProductsBody');
  const search = document.getElementById('ownerProductSearch');
  const bulk = document.getElementById('ownerProductsBulk');

  async function loadProducts(q=''){
    body.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
    try {
      const res = await api.getProducts({ query: q });
      const products = res.products || [];
      body.innerHTML = products.map(p=> `<tr><td>${escapeHtml(p.productId)}</td><td>${escapeHtml(p.productName)}</td><td>${escapeHtml(p.brand)}</td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.mrp)}</td><td>${escapeHtml(p.stock||0)}</td><td><button class="edit-product" data-id="${encodeURIComponent(p.productId)}">Edit</button><button class="delete-product" data-id="${encodeURIComponent(p.productId)}">Delete</button></td></tr>`).join('');
      attachHandlers();
    } catch (err){ body.innerHTML = `<tr><td colspan="7">Error: ${escapeHtml(err.message||String(err))}</td></tr>`; }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]+/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function attachHandlers(){
    body.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', ()=> { const id = decodeURIComponent(btn.dataset.id); alert('Edit product '+id); }));
    body.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', ()=> { const id = decodeURIComponent(btn.dataset.id); if(confirm('Delete product?')) api.deleteProduct(id).then(()=> loadProducts(search.value)).catch(e=> alert('Delete failed: '+e.message)); }));
  }

  search.addEventListener('input', ()=> loadProducts(search.value.trim()));
  bulk.addEventListener('change', (e)=> { alert('Bulk upload not yet supported in UI; please use CSV import endpoint.'); });

  document.getElementById('ownerAddProduct').addEventListener('click', ()=> { alert('Open add product modal'); });

  loadProducts();
}
