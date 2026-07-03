import config from './config.js';

const API_URL = config.API_URL;
const SESSION_KEY = config.SESSION_STORAGE_KEY || 'loyalty_session_v1';

function getSessionToken() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (!s) return null;
    const obj = JSON.parse(s);
    return obj && obj.token ? obj.token : null;
  } catch (e) { return null; }
}

async function apiRequest(action, body = {}, opts = {}) {
  const token = getSessionToken();
  const payload = Object.assign({}, body, { action });
  if (token) payload.token = token;
  const res = await fetch(API_URL, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { error: 'Invalid JSON response' }; }
  if (!res.ok) throw new Error(json && json.error ? json.error : `HTTP ${res.status}`);
  return json;
}

// Admin endpoints
export async function getDashboardStats() { return apiRequest('dashboardStats', {}); }
export async function getUsers(params = {}) { return apiRequest('getUsers', params); }
export async function updateUser(action, identifier, payload = {}) { return apiRequest('updateUser', Object.assign({ updateAction: action, identifier }, payload)); }
export async function getProducts(params = {}) { return apiRequest('getProducts', params); }
export async function addProduct(product) { return apiRequest('addProduct', { product }); }
export async function updateProduct(productId, product) { return apiRequest('updateProduct', { productId, product }); }
export async function deleteProduct(productId) { return apiRequest('deleteProduct', { productId }); }
export async function getPurchases(params = {}) { return apiRequest('getPurchases', params); }
export async function approvePurchase(requestId, remark = '') { return apiRequest('approvePurchase', { requestId, approved: true, remark }); }
export async function rejectPurchase(requestId, remark = '') { return apiRequest('approvePurchase', { requestId, approved: false, remark }); }
export async function verifyPurchase(requestId, remark = '') { return apiRequest('verifyPurchase', { requestId, remark }); }
export async function getReports(params = {}) { return apiRequest('getReports', params); }
export async function getSettings() { return apiRequest('getSettings', {}); }
export async function updateSettings(settings) { return apiRequest('updateSettings', { settings }); }

export default { getDashboardStats, getUsers, updateUser, getProducts, addProduct, updateProduct, deleteProduct, getPurchases, approvePurchase, rejectPurchase, getReports, getSettings, updateSettings };
