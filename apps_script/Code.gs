/**
 * Apps Script backend for Loyalty app
 * Handles authentication, registration, token issuance/validation and protected sheet operations.
 * - Deploy this as a Web App (Execute as: Me, Who has access: Anyone).
 * - Protects endpoints by validating issued tokens stored in Script Properties.
 */

const REG_SHEET_NAME = 'Registrations';
const PURCHASE_SHEET_NAME = 'Purchases';
const SESSIONS_PREFIX = 'session_';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OWNER_EMAIL = 'owner@example.com'; // update to real owner email in deployment

// Logging helper
function logEvent(tag, obj) {
  try { Logger.log(JSON.stringify({ t: tag, d: obj || {}, at: new Date().toISOString() })); } catch (e) { /* ignore */ }
}

// Basic payload validator - returns array of missing fields
function validatePayload(payload, required) {
  const missing = [];
  required = required || [];
  for (let k of required) {
    if (!payload || payload[k] === undefined || payload[k] === null || String(payload[k]).toString().trim() === '') missing.push(k);
  }
  return missing;
}

// Prevent spreadsheet formula injection by prefixing dangerous leading characters
function sanitizeForSheet(value) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.type === 'application/json' ? JSON.parse(e.postData.contents) : JSON.parse(e.postData.contents || '{}');
    logEvent('doPost', { ip: e && e.postData ? 'received' : 'no-postData', action: (body||{}).action });
    if (!body || !body.action) return jsonResponse(400, { error: 'Missing action' });

    switch (body.action) {
      case 'authenticate':
        return handleAuthenticate(body);
      case 'validate':
        return handleValidate(body);
      case 'users':
        return handleUsers(body);
      case 'dashboardStats':
        return handleDashboardStats(body);
      case 'getUsers':
        return handleGetUsers(body);
      case 'updateUser':
        return handleUpdateUser(body);
      case 'getProducts':
        return handleGetProducts(body);
      case 'addProduct':
        return handleAddProduct(body);
      case 'updateProduct':
        return handleUpdateProduct(body);
      case 'deleteProduct':
        return handleDeleteProduct(body);
      case 'getPurchases':
        return handleGetPurchases(body);
      case 'getReports':
        return handleGetReports(body);
      case 'getSettings':
        return handleGetSettings(body);
      case 'updateSettings':
        return handleUpdateSettings(body);
      case 'register':
        return handleRegister(body);
      case 'logout':
        return handleLogout(body);
      case 'approveUser':
        return handleApproveUser(body);
      case 'logPurchase':
        return handleLogPurchase(body);
      case 'verifyPurchase':
        return handleVerifyPurchase(body);
      case 'approvePurchase':
        return handleApprovePurchase(body);
      default:
        return jsonResponse(400, { error: 'Unknown action' });
    }
  } catch (err) {
    logEvent('doPostError', { error: String(err && err.message ? err.message : err) });
    return jsonResponse(500, { error: 'Server error' });
  }
}

function doGet(e) {
  // Provide limited GET endpoints: health and public product lookup (no sensitive fields)
  try {
    const action = (e.parameter && e.parameter.action) || '';
    if (action === 'health') return jsonResponse(200, { ok: true });
    if (action === 'product') {
      const pid = String((e.parameter && e.parameter.productId) || '').trim();
      if (!pid) return jsonResponse(400, { error: 'Missing productId' });
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('Products');
      if (!sheet) return jsonResponse(200, { product: null });
      const rows = readSheetAsObjects(sheet);
      const rec = rows.find(r => String(r.productid||r.productId||'').toString().trim() === pid);
      if (!rec) return jsonResponse(200, { product: null });
      // Public view - exclude prices, stock and internal ids
      const publicRec = {
        productId: rec.productid || rec.productId || '',
        productName: rec.productname || rec.productName || rec.product || '',
        packSize: rec.packsize || rec.packSize || '',
        status: rec.status || 'active',
        imageUrl: rec.imageurl || rec.imageUrl || ''
      };
      return jsonResponse(200, { product: publicRec });
    }
    return jsonResponse(400, { error: 'Use POST with JSON body' });
  } catch (err) {
    logEvent('doGetError', { error: String(err && err.message ? err.message : err) });
    return jsonResponse(500, { error: 'Server error' });
  }
}

/* ---------------------- Handlers ---------------------- */

function handleAuthenticate(body) {
  const identifier = String(body.identifier || body.email || body.mobile || '').trim();
  const password = String(body.password || '').trim();
  if (!identifier || !password) return jsonResponse(400, { error: 'Missing credentials' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Registration sheet missing on server' });

  const users = readSheetAsObjects(sheet);
  const match = users.find(u => (String(u.email || '').trim().toLowerCase() === identifier.toLowerCase()) || (String(u.mobile || '').replace(/[^0-9]/g,'') === identifier.replace(/[^0-9]/g,'')));
  if (!match) return jsonResponse(401, { error: 'Invalid credentials' });
  if (String(match.password || '') !== password) return jsonResponse(401, { error: 'Invalid credentials' });
  if (!isApproved(match)) return jsonResponse(403, { error: 'User not approved yet' });

  const safeUser = sanitizeUser(match);
  const token = createSessionToken(safeUser.email || safeUser.mobile);
  return jsonResponse(200, { success: true, user: safeUser, token });
}

function handleValidate(body) {
  const token = String(body.token || '').trim();
  if (!token) return jsonResponse(400, { valid: false, error: 'Missing token' });
  const session = getSession(token);
  if (!session) return jsonResponse(200, { valid: false });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Registration sheet missing on server' });
  const users = readSheetAsObjects(sheet);
  const user = users.find(u => (u.email && normalize(u.email) === normalize(session.userEmail)) || (u.mobile && normalizeDigits(u.mobile) === normalizeDigits(session.userEmail)));
  const sanitized = sanitizeUser(user || {});
  const role = String(sanitized.role || '').toLowerCase();
  return jsonResponse(200, { valid: true, user: sanitized, isOwner: isOwnerEmail(sanitized.email), isAdmin: role === 'admin' });
}

function handleUsers(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token);
  // For owner, return full list; otherwise return limited view
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) throw new Error('Registration sheet missing');
  const users = readSheetAsObjects(sheet);
  const requesterRole = String(requester.role || '').toLowerCase();
  if (isOwnerEmail(requester.email) || requesterRole === 'admin') return jsonResponse(200, users.map(sanitizeUser));
  // non-owner: return only non-sensitive public fields
  return jsonResponse(200, users.map(u => ({ name: u.name, email: u.email, mobile: u.mobile, category: u.category, city: u.city, firmName: u.firmName, approved: Boolean(u.approved) })));
}

function handleRegister(body) {
  const payload = body.payload || body;
  const required = ['name','email','mobile','password'];
  const missing = validatePayload(payload, required);
  if (missing.length) return jsonResponse(400, { error: 'Missing fields: ' + missing.join(', ') });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Registration sheet missing' });

  const users = readSheetAsObjects(sheet);
  const dup = users.find(u => (u.email && normalize(u.email) === normalize(payload.email)) || (u.mobile && normalizeDigits(u.mobile) === normalizeDigits(payload.mobile)));
  if (dup) return jsonResponse(409, { error: 'User already registered' });

  const row = [sanitizeForSheet(payload.name || ''), sanitizeForSheet(payload.firmName || ''), sanitizeForSheet(payload.email || ''), sanitizeForSheet(payload.mobile || ''), sanitizeForSheet(payload.password || ''), sanitizeForSheet(payload.category || ''), sanitizeForSheet(payload.city || ''), false, new Date().toISOString()];
  sheet.appendRow(row);
  return jsonResponse(200, { success: true });
}

function handleLogout(body) {
  const token = String(body.token || '').trim();
  if (!token) return jsonResponse(400, { error: 'Missing token' });
  invalidateSession(token);
  return jsonResponse(200, { success: true });
}

function handleApproveUser(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const targetEmail = String(body.email || body.identifier || '').trim();
  if (!targetEmail) return jsonResponse(400, { error: 'Missing user identifier' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Registration sheet missing' });
  const rows = readSheetAsObjects(sheet);
  const idx = rows.findIndex(r => (r.email && normalize(r.email) === normalize(targetEmail)) || (r.mobile && normalizeDigits(r.mobile) === normalizeDigits(targetEmail)));
  if (idx < 0) return jsonResponse(404, { error: 'User not found' });
  // update Approved column (assumes header has 'approved')
  const header = getHeaderMap(sheet);
  const approvedCol = header['approved'];
  if (!approvedCol) return jsonResponse(500, { error: 'Registration sheet missing approved column' });
  sheet.getRange(idx + 2, approvedCol).setValue(true);
  return jsonResponse(200, { success: true });
}

function handleLogPurchase(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token);
  const payload = body.payload || body;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASE_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Purchase sheet missing' });
  const header = getHeaderMap(sheet);
  // Prevent duplicate writes: if requestId provided and exists, reject
  if (payload.requestId) {
    const rows = readSheetAsObjects(sheet);
    const exists = rows.find(r => String(r.requestId||'').trim() === String(payload.requestId||'').trim());
    if (exists) return jsonResponse(409, { error: 'Duplicate requestId' });
  } else {
    // Also avoid duplicate pending requests for same submitter+product
    const rows = readSheetAsObjects(sheet);
    const dup = rows.find(r => ((r.submitteremail||'').toString().trim() === (payload.submitterEmail||requester.email||'').toString().trim()) && ((r.productid||r.productid||r.productId||'').toString().trim() === (payload.productId||'').toString().trim()) && String((r.status||'').toLowerCase()).includes('pending'));
    if (dup) return jsonResponse(409, { error: 'Duplicate pending request for same product' });
  }
  const row = [sanitizeForSheet(payload.requestId || Utilities.getUuid()), sanitizeForSheet(payload.submitterName || requester.name || ''), sanitizeForSheet(payload.submitterEmail || requester.email || ''), sanitizeForSheet(payload.submitterMobile || requester.mobile || ''), sanitizeForSheet(payload.productId || ''), sanitizeForSheet(payload.productName || ''), sanitizeForSheet(payload.packSize || ''), Number(payload.quantity || 1), Number(payload.amount || 0), 'pending', sanitizeForSheet(payload.remark || ''), new Date().toISOString()];
  sheet.appendRow(row);
  logEvent('logPurchase', { requestId: row[0], by: requester.email || requester.mobile });
  return jsonResponse(200, { success: true, requestId: row[0] });
}

function handleApprovePurchase(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const requestId = String(body.requestId || '').trim();
  const approved = !!body.approved;
  const remark = String(body.remark || '').trim();
  if (!requestId) return jsonResponse(400, { error: 'Missing requestId' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASE_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Purchase sheet missing' });
  const rows = readSheetAsObjects(sheet);
  const idx = rows.findIndex(r => String(r.requestId || '').trim() === requestId);
  if (idx < 0) return jsonResponse(404, { error: 'Purchase request not found' });
  const header = getHeaderMap(sheet);
  const statusCol = header['status'];
  const remarkCol = header['remark'] || header['remarks'] || header['actionremark'];
  if (!statusCol) return jsonResponse(500, { error: 'Purchase sheet missing status column' });
  const currentStatus = String(rows[idx].status || '').toLowerCase();
  if (currentStatus.includes('approved') || currentStatus.includes('rejected')) {
    return jsonResponse(409, { error: 'Purchase request already processed' });
  }
  const newStatus = approved ? 'Approved by Owner' : 'Rejected by Owner';
  sheet.getRange(idx + 2, statusCol).setValue(newStatus);
  if (remarkCol) sheet.getRange(idx + 2, remarkCol).setValue(remark);
  logEvent('approvePurchase', { requestId: requestId, by: requester.email || requester.mobile, approved: approved });

  // If approved, record points in PointsLedger and update user's total points if possible
  if (approved) {
    const points = Number(rows[idx].pointsAwarded || rows[idx].pointsawarded || rows[idx].points || Math.max(10, Math.round((Number(rows[idx].amount||0)/10))));
    const ledgerSheetName = 'PointsLedger';
    let ledger = ss.getSheetByName(ledgerSheetName);
    if (!ledger) {
      ledger = ss.insertSheet(ledgerSheetName);
      ledger.appendRow(['requestId','userEmail','userName','points','reason','createdAt']);
    }
    ledger.appendRow([requestId, rows[idx].submitterEmail || rows[idx].submitterMobile || '', rows[idx].submitterName || '', points, remark || 'Purchase approved', new Date().toISOString()]);

    // Write back awarded points into the purchase row if column exists
    const pointsCols = ['pointsawarded','points_awarded','points awarded','points'];
    for (const key of pointsCols) {
      const col = header[key];
      if (col) {
        sheet.getRange(idx + 2, col).setValue(points);
        break;
      }
    }

    // Update product inventory (reduce stock by quantity) if Products sheet has stock
    try {
      const prodSheet = ss.getSheetByName('Products');
      if (prodSheet) {
        const prodRows = readSheetAsObjects(prodSheet);
        const prodHeader = getHeaderMap(prodSheet);
        const pid = String(rows[idx].productId || rows[idx].productid || rows[idx].product || '').trim();
        const pIdx = prodRows.findIndex(p => String(p.productid || p.productId || p.product || '').trim() === pid);
        if (pIdx >= 0) {
          const stockCol = prodHeader['stock'];
          if (stockCol) {
            const existingStock = Number(prodRows[pIdx].stock || 0);
            const qty = Number(rows[idx].quantity || 0);
            const newStock = Math.max(0, existingStock - qty);
            prodSheet.getRange(pIdx + 2, stockCol).setValue(newStock);
          }
        }
      }
    } catch (e) {
      // non-fatal if inventory update fails
      console.warn('Inventory update failed for request', requestId, e);
    }
    // Update registration total points column if present
    const regSheet = ss.getSheetByName(REG_SHEET_NAME);
    if (regSheet) {
      const regRows = readSheetAsObjects(regSheet);
      const userKey = (rows[idx].submitterEmail || rows[idx].submitterMobile || '').toString();
      const userIdx = regRows.findIndex(r => (r.email && normalize(r.email) === normalize(userKey)) || (r.mobile && normalizeDigits(r.mobile) === normalizeDigits(userKey)));
      if (userIdx >= 0) {
        const regHeader = getHeaderMap(regSheet);
        const pointsCol = regHeader['totalpoints'] || regHeader['points'];
        if (pointsCol) {
          const existing = Number(regRows[userIdx].totalpoints || regRows[userIdx].points || 0);
          regSheet.getRange(userIdx + 2, pointsCol).setValue(existing + points);
        }
      }
    }
  }
  return jsonResponse(200, { success: true });
}

function handleVerifyPurchase(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token);
  const role = String(requester.role || requester.category || '').toLowerCase();
  // only distributor, admin or owner can verify
  if (!['distributor','admin','owner'].includes(role)) throw new Error('Distributor privileges required to verify purchases');
  const requestId = String(body.requestId || '').trim();
  const remark = String(body.remark || '').trim();
  if (!requestId) return jsonResponse(400, { error: 'Missing requestId' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASE_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Purchase sheet missing' });
  const rows = readSheetAsObjects(sheet);
  const idx = rows.findIndex(r => String(r.requestId || '').trim() === requestId);
  if (idx < 0) return jsonResponse(404, { error: 'Purchase request not found' });
  const header = getHeaderMap(sheet);
  const statusCol = header['status'];
  const remarkCol = header['remark'] || header['remarks'] || header['actionremark'];
  if (!statusCol) return jsonResponse(500, { error: 'Purchase sheet missing status column' });
  const currentStatus = String(rows[idx].status || '').toLowerCase();
  if (currentStatus.includes('verified') || currentStatus.includes('approved') || currentStatus.includes('rejected')) {
    return jsonResponse(409, { error: 'Purchase request already processed' });
  }
  const newStatus = 'Verified by Distributor';
  sheet.getRange(idx + 2, statusCol).setValue(newStatus);
  if (remarkCol) sheet.getRange(idx + 2, remarkCol).setValue(remark || ('Verified by ' + (requester.name || requester.email || 'distributor')));
  return jsonResponse(200, { success: true });
}

/* ---------------------- Session Helpers ---------------------- */

function createSessionToken(userEmail) {
  const token = Utilities.getUuid();
  const key = SESSIONS_PREFIX + token;
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = { userEmail: String(userEmail || ''), expiresAt: expiry };
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, JSON.stringify(payload));
  return token;
}

function getSession(token) {
  if (!token) return null;
  const props = PropertiesService.getScriptProperties();
  const data = props.getProperty(SESSIONS_PREFIX + token);
  if (!data) return null;
  try {
    const session = JSON.parse(data);
    if (!session.expiresAt || Number(session.expiresAt) < Date.now()) {
      props.deleteProperty(SESSIONS_PREFIX + token);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function invalidateSession(token) {
  if (!token) return false;
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(SESSIONS_PREFIX + token);
  return true;
}

function requireValidToken(token, requireOwner) {
  const session = getSession(token);
  if (!session) throw new Error('Invalid or expired token');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  const users = sheet ? readSheetAsObjects(sheet) : [];
  const user = users.find(u => (u.email && normalize(u.email) === normalize(session.userEmail)) || (u.mobile && normalizeDigits(u.mobile) === normalizeDigits(session.userEmail)));
  if (!user) throw new Error('User not found');
  if (requireOwner) {
    const role = String(user.role || '').toLowerCase();
    if (!isOwnerEmail(user.email) && role !== 'admin') throw new Error('Owner/Admin privileges required');
  }
  if (!isApproved(user)) throw new Error('User not approved');
  return sanitizeUser(user);
}

/* ---------------------- Sheet Utilities ---------------------- */

function readSheetAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];
  const headers = data[0].map(h => (h || '').toString().trim().toLowerCase());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function getHeaderMap(sheet) {
  const headerRow = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0] || [];
  const map = {};
  headerRow.forEach((h, idx) => { if (h) map[String(h).toString().trim().toLowerCase()] = idx + 1; });
  return map;
}

function sanitizeUser(u) {
  if (!u) return {};
  return {
    name: String(u.name || '').trim(),
    email: String(u.email || '').trim(),
    mobile: String(u.mobile || '').trim(),
    category: String(u.category || '').trim(),
    city: String(u.city || '').trim(),
    firmName: String(u.firmname || u.firmName || '').trim(),
    role: String(u.role || u.userrole || '').trim(),
    approved: isApproved(u),
    registeredAt: String(u.registeredat || u.createdat || '')
  };
}

function isApproved(u) {
  if (!u) return false;
  const v = u.approved;
  if (typeof v === 'boolean') return v;
  const s = String(v || '').toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === String(OWNER_EMAIL || '').trim().toLowerCase();
}

function normalize(s) { return String(s || '').trim().toLowerCase(); }
function normalizeDigits(s) { return String(s || '').replace(/[^0-9]/g,''); }

/* ---------------------- Response Helper ---------------------- */

function jsonResponse(status, payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------- Admin Handlers ---------------------- */

function handleDashboardStats(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(REG_SHEET_NAME);
  const prod = ss.getSheetByName('Products');
  const purchases = ss.getSheetByName(PURCHASE_SHEET_NAME);
  const users = reg ? readSheetAsObjects(reg) : [];
  const products = prod ? readSheetAsObjects(prod) : [];
  const purchaseRows = purchases ? readSheetAsObjects(purchases) : [];
  const stats = {
    totalUsers: users.length,
    pendingApprovals: users.filter(u=>!isApproved(u)).length,
    approvedUsers: users.filter(u=>isApproved(u)).length,
    rejectedUsers: users.filter(u=>{ const a = u.approved; return a===false || String(a||'').toLowerCase()==='rejected'; }).length,
    totalProducts: products.length,
    activeProducts: products.filter(p => (p.status || '').toString().toLowerCase() !== 'inactive').length,
    purchaseRequests: purchaseRows.length,
    approvedPurchases: purchaseRows.filter(r=> (r.status||'').toLowerCase().includes('approved')).length,
    totalPoints: purchaseRows.reduce((s,r)=> s + (Number(r.pointsAwarded||r.pointsawarded||0)),0),
    todaysPurchases: (function(){
      const today = new Date();
      const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
      return purchaseRows.filter(r => {
        const dt = new Date(r.createdat || r.createdAt || r.created || new Date());
        return dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d;
      }).length;
    })(),
    monthlyPurchases: (function(){
      const today = new Date();
      const y = today.getFullYear(), m = today.getMonth();
      return purchaseRows.filter(r => {
        const dt = new Date(r.createdat || r.createdAt || r.created || new Date());
        return dt.getFullYear()===y && dt.getMonth()===m;
      }).length;
    })()
  };
  return jsonResponse(200, stats);
}

function handleGetUsers(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const page = Math.max(1, Number(body.page||1));
  const pageSize = Math.max(1, Math.min(100, Number(body.pageSize||25)));
  const query = String(body.query||'').toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) return jsonResponse(200, { users: [], total: 0 });
  const all = readSheetAsObjects(sheet).map(sanitizeUser);
  const filtered = all.filter(u => {
    if (!query) return true;
    return (u.name||'').toLowerCase().includes(query) || (u.email||'').toLowerCase().includes(query) || (u.mobile||'').toLowerCase().includes(query) || (u.firmName||'').toLowerCase().includes(query);
  });
  const total = filtered.length;
  const start = (page-1)*pageSize;
  const users = filtered.slice(start, start+pageSize);
  return jsonResponse(200, { users, total });
}

function handleUpdateUser(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const action = String(body.updateAction || '').trim().toLowerCase();
  const identifier = String(body.identifier || '').trim();
  if (!identifier) return jsonResponse(400, { error: 'Missing identifier' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REG_SHEET_NAME);
  if (!sheet) return jsonResponse(500, { error: 'Registration sheet missing' });
  const rows = readSheetAsObjects(sheet);
  const idx = rows.findIndex(r => (r.email && normalize(r.email)===normalize(identifier)) || (r.mobile && normalizeDigits(r.mobile)===normalizeDigits(identifier)));
  if (idx<0) return jsonResponse(404, { error: 'User not found' });
  const header = getHeaderMap(sheet);
  if (action === 'approve') {
    const col = header['approved']; if (!col) return jsonResponse(500,{ error:'approved column missing' });
    sheet.getRange(idx+2, col).setValue(true);
    return jsonResponse(200, { success:true });
  } else if (action === 'reject') {
    const col = header['approved']; if (!col) return jsonResponse(500,{ error:'approved column missing' });
    sheet.getRange(idx+2, col).setValue('rejected');
    return jsonResponse(200, { success:true });
  } else if (action === 'suspend' || action === 'activate' || action === 'delete') {
    const statusCol = header['status'] || header['account_status'];
    if (!statusCol && action !== 'delete') return jsonResponse(500, { error:'status column missing' });
    if (action === 'delete') {
      sheet.deleteRow(idx+2);
      return jsonResponse(200, { success:true });
    }
    const v = action === 'suspend' ? 'suspended' : 'active';
    sheet.getRange(idx+2, statusCol).setValue(v);
    return jsonResponse(200,{ success:true });
  }
  return jsonResponse(400, { error: 'Unknown update action' });
}

function handleGetProducts(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  if (!sheet) return jsonResponse(200, { products: [] });
  const all = readSheetAsObjects(sheet);
  return jsonResponse(200, { products: all });
}

function handleAddProduct(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const product = body.product || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Products');
  if (!sheet) {
    sheet = ss.insertSheet('Products');
    sheet.appendRow(['productId','productName','brand','category','description','mrp','distributorPrice','retailerPrice','mechanicPrice','retailerPoints','mechanicPoints','packSize','stock','imageUrl','qrCode','status','createdAt']);
  }
  const row = [sanitizeForSheet(product.productId||Utilities.getUuid()), sanitizeForSheet(product.productName||''), sanitizeForSheet(product.brand||''), sanitizeForSheet(product.category||''), sanitizeForSheet(product.description||''), sanitizeForSheet(product.mrp||''), sanitizeForSheet(product.distributorPrice||''), sanitizeForSheet(product.retailerPrice||''), sanitizeForSheet(product.mechanicPrice||''), sanitizeForSheet(product.retailerPoints||''), sanitizeForSheet(product.mechanicPoints||''), sanitizeForSheet(product.packSize||''), Number(product.stock||0), sanitizeForSheet(product.imageUrl||''), sanitizeForSheet(product.qrCode||''), sanitizeForSheet(product.status||'active'), new Date().toISOString()];
  sheet.appendRow(row);
  return jsonResponse(200, { success:true });
}

function handleUpdateProduct(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const productId = String(body.productId || '').trim();
  const product = body.product || {};
  if (!productId) return jsonResponse(400, { error: 'Missing productId' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  if (!sheet) return jsonResponse(500, { error: 'Products sheet missing' });
  const rows = readSheetAsObjects(sheet);
  const idx = rows.findIndex(r => String(r.productid||'').trim() === productId);
  if (idx < 0) return jsonResponse(404, { error: 'Product not found' });
  const header = getHeaderMap(sheet);
  Object.keys(product).forEach(k=>{ const col = header[k.toString().toLowerCase()]; if (col) sheet.getRange(idx+2, col).setValue(product[k]); });
  return jsonResponse(200, { success:true });
}

function handleDeleteProduct(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const productId = String(body.productId || '').trim();
  if (!productId) return jsonResponse(400, { error: 'Missing productId' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  if (!sheet) return jsonResponse(500, { error: 'Products sheet missing' });
  const rows = readSheetAsObjects(sheet);
  const idx = rows.findIndex(r => String(r.productid||'').trim() === productId);
  if (idx < 0) return jsonResponse(404, { error: 'Product not found' });
  sheet.deleteRow(idx+2);
  return jsonResponse(200, { success:true });
}

function handleGetPurchases(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASE_SHEET_NAME);
  if (!sheet) return jsonResponse(200, { purchases: [] });
  const rows = readSheetAsObjects(sheet);
  const status = (body.status || '').toString().toLowerCase();
  const filtered = status ? rows.filter(r => (r.status||'').toString().toLowerCase().includes(status)) : rows;
  return jsonResponse(200, { purchases: filtered });
}

function handleGetReports(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const type = String(body.type || '').trim();
  // Basic report generation: monthly counts by reading sheets
  if (type === 'monthlyRegistrations') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(REG_SHEET_NAME);
    const rows = sheet ? readSheetAsObjects(sheet) : [];
    const counts = {};
    rows.forEach(r => { const d = new Date(r.registeredat || r.createdat || new Date()); const key = `${d.getFullYear()}-${d.getMonth()+1}`; counts[key] = (counts[key]||0)+1; });
    const labels = Object.keys(counts).sort();
    const data = labels.map(l=>counts[l]||0);
    return jsonResponse(200, { labels, data });
  }
  if (type === 'monthlyPurchases') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PURCHASE_SHEET_NAME);
    const rows = sheet ? readSheetAsObjects(sheet) : [];
    const counts = {}; rows.forEach(r => { const d = new Date(r.createdat || new Date()); const key = `${d.getFullYear()}-${d.getMonth()+1}`; counts[key]=(counts[key]||0)+1; });
    const labels = Object.keys(counts).sort(); const data = labels.map(l=>counts[l]||0);
    return jsonResponse(200, { labels, data });
  }
  if (type === 'monthlyPoints') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PURCHASE_SHEET_NAME);
    const rows = sheet ? readSheetAsObjects(sheet) : [];
    const sums = {}; rows.forEach(r => { const d = new Date(r.createdat || new Date()); const key = `${d.getFullYear()}-${d.getMonth()+1}`; sums[key] = (sums[key]||0) + Number(r.pointsawarded||0); });
    const labels = Object.keys(sums).sort(); const data = labels.map(l=>sums[l]||0);
    return jsonResponse(200, { labels, data });
  }
  return jsonResponse(200, { labels: [], data: [] });
}

function handleGetSettings(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const props = PropertiesService.getScriptProperties();
  const settings = props.getProperty('app_settings');
  try { return jsonResponse(200, { settings: settings ? JSON.parse(settings) : {} }); } catch (e) { return jsonResponse(200, { settings: {} }); }
}

function handleUpdateSettings(body) {
  const token = String(body.token || '').trim();
  const requester = requireValidToken(token, true);
  const settings = body.settings || {};
  const props = PropertiesService.getScriptProperties();
  props.setProperty('app_settings', JSON.stringify(settings));
  return jsonResponse(200, { success: true });
}
