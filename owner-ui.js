import api from './owner-api.js';

// Render dashboard cards into existing ownerDashboard DOM
function createCard(id, title, value = '—') {
  const card = document.createElement('div');
  card.className = 'owner-card admin-card';
  card.id = id;
  const span = document.createElement('span');
  span.textContent = title;
  const strong = document.createElement('strong');
  strong.textContent = value;
  card.appendChild(span);
  card.appendChild(strong);
  return card;
}

async function renderDashboardCards(container) {
  try {
    const stats = (await api.getDashboardStats()) || {};
    const grid = container.querySelector('.owner-summary-grid') || container.querySelector('.owner-summary-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const cards = [
      ['totalUsers','Total Registered Users', stats.totalUsers || 0],
      ['pendingApprovals','Pending User Approvals', stats.pendingApprovals || 0],
      ['approvedUsers','Approved Users', stats.approvedUsers || 0],
      ['pendingPurchases','Pending Purchase Requests', stats.purchaseRequests || 0],
      ['approvedPurchases','Approved Purchases', stats.approvedPurchases || 0],
      ['totalProducts','Total Products', stats.totalProducts || 0],
      ['activeProducts','Active Products', stats.activeProducts || 0],
      ['totalPoints','Total Reward Points Issued', stats.totalPoints || 0],
      ['todaysPurchases','Today\'s Purchases', stats.todaysPurchases || 0],
      ['monthlyPurchases','Monthly Purchases', stats.monthlyPurchases || 0]
    ];
    cards.forEach(c => grid.appendChild(createCard(...c)));
  } catch (err) {
    console.warn('renderDashboardCards error', err);
  }
}
async function renderCharts(container) {
  // charts placeholders: monthly registrations, purchases, points
  const chartsWrap = container.querySelector('.owner-insights') || container;
  if (!chartsWrap) return;
  chartsWrap.innerHTML = `
    <div class="owner-chart-grid">
      <canvas id="chartRegistrations" width="400" height="160"></canvas>
      <canvas id="chartPurchases" width="400" height="160"></canvas>
      <canvas id="chartPoints" width="400" height="160"></canvas>
    </div>`;
  // Load Chart.js dynamically if not present and then render
  try {
    if (!window.Chart) {
      // dynamic loader
      await new Promise((resolve, reject) => {
        if (document.querySelector('script[data-src="https://cdn.jsdelivr.net/npm/chart.js"]')) return resolve();
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        s.async = true;
        s.setAttribute('data-src', 'https://cdn.jsdelivr.net/npm/chart.js');
        s.onload = resolve; s.onerror = () => reject(new Error('Failed to load Chart.js'));
        document.body.appendChild(s);
      });
    }
    const [r1, r2, r3] = await Promise.all([api.getReports({ type: 'monthlyRegistrations' }), api.getReports({ type: 'monthlyPurchases' }), api.getReports({ type: 'monthlyPoints' })]);
    try { renderLineChart('chartRegistrations', r1.labels || [], r1.data || [], 'Registrations'); } catch (e) {}
    try { renderLineChart('chartPurchases', r2.labels || [], r2.data || [], 'Purchases'); } catch (e) {}
    try { renderLineChart('chartPoints', r3.labels || [], r3.data || [], 'Points'); } catch (e) {}
  } catch (err) {
    console.warn('chart load/render error', err);
  }
}

function renderLineChart(canvasId, labels, data, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label, data, borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.1)' }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

export async function initOwnerUI() {
  const container = document.getElementById('ownerDashboard');
  if (!container) return;
  await renderDashboardCards(container);
  renderCharts(container);
}

export default { initOwnerUI };
