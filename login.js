import config from './config.js';

const API_URL = config.API_URL;
const WORKSPACE_SHEET_NAMES = config.WORKSPACE_SHEET_NAMES;
const API_ACTIONS = config.API_ACTIONS || {
    users: 'users',
    metrics: 'metrics',
    products: 'products',
    authenticate: 'authenticate',
    register: 'register'
};
const API_ENDPOINTS = config.API_ENDPOINTS || { points: 'points' };
const SHEET_LOGIN_EVENT_URL = config.SHEET_LOGIN_EVENT_URL || '';
const SHEET_PURCHASE_URL = config.SHEET_PURCHASE_URL || '';
const DEFAULT_OTP_TIMEOUT = config.DEFAULT_OTP_TIMEOUT || 60;
const STORAGE_KEYS = config.STORAGE_KEYS || {
    users: 'loyalty_users_v1',
    productPrices: 'productPrices',
    purchaseRequestsPrefix: 'purchase_requests'
};
const SESSION_STORAGE_KEY = config.SESSION_STORAGE_KEY || 'loyalty_session_v1';

let otpTimer = DEFAULT_OTP_TIMEOUT;
let timerInterval = null;
let userEmail = '';
let currentUser = null;
let allowedUsers = [];
let usersLoaded = false;
let isLoginInProgress = false;
let isOtpProcessing = false;
let otpSession = null;

const loginForm = document.getElementById('loginForm');
const otpForm = document.getElementById('otpForm');
const messageDiv = document.getElementById('message');
const loginSubmitButton = loginForm?.querySelector('button[type="submit"]');
const otpSubmitButton = otpForm?.querySelector('button[type="submit"]');
const otpDigits = document.querySelectorAll('.otp-digit');
const resendBtn = document.getElementById('resendBtn');
const backBtn = document.getElementById('backBtn');
const timerSpan = document.getElementById('timer');
const loginCard = document.getElementById('loginCard') || document.querySelector('.login-card');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const registrationForm = document.getElementById('registrationForm');
const dashboard = document.getElementById('dashboard');
const ownerDashboard = document.getElementById('ownerDashboard');
const customerNameSpan = document.getElementById('customerName');
const pointsBalance = document.getElementById('pointsBalance');
const activityList = document.getElementById('activityList');
const profileName = document.getElementById('profileName');
const profileCategory = document.getElementById('profileCategory');
const profileFirm = document.getElementById('profileFirm');
const profileEmail = document.getElementById('profileEmail');
const profileMobile = document.getElementById('profileMobile');
const profileCity = document.getElementById('profileCity');
const notificationsList = document.getElementById('notificationsList');
const productListBody = document.getElementById('productListBody');
const productSearchInput = document.getElementById('productSearchInput');
const priceHeader = document.getElementById('priceHeader');
const pointsHeader = document.getElementById('pointsHeader');
const logoutBtn = document.getElementById('logoutBtn');
const ownerLogoutBtn = document.getElementById('logoutBtnOwner');
const btnViewSales = document.getElementById('btnViewSales');
const redeemBtn = document.getElementById('redeemBtn');
const exploreOffersBtn = document.getElementById('exploreOffersBtn');
const nextReward = document.getElementById('nextReward');
const activeOffers = document.getElementById('activeOffers');
const nextRewardCard = document.getElementById('nextRewardCard');
const activeOffersCard = document.getElementById('activeOffersCard');
const rewardsSection = document.getElementById('rewardsSection');
const accountStatus = document.getElementById('accountStatus');
const recentPoints = document.getElementById('recentPoints');
const scanQrBtn = document.getElementById('scanQrBtn');
const manualQrBtn = document.getElementById('manualQrBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const qrScanner = document.getElementById('qrScanner');
const qrVideo = document.getElementById('qrVideo');
const qrCodeInput = document.getElementById('qrCodeInput');
const uploadQrInput = document.getElementById('uploadQrInput'); 

const purchaseProductId = document.getElementById('purchaseProductId');
const purchaseProductName = document.getElementById('purchaseProductName');
const purchasePackSize = document.getElementById('purchasePackSize');
const purchaseQuantity = document.getElementById('purchaseQuantity');
const submitPurchaseBtn = document.getElementById('submitPurchaseBtn');
const purchaseStatusMessage = document.getElementById('purchaseStatusMessage');
const purchaseHistoryBody = document.getElementById('purchaseHistoryBody');
const ownerTotalRetailers = document.getElementById('ownerTotalRetailers');
const ownerActiveMechanics = document.getElementById('ownerActiveMechanics');
const ownerPointsIssued = document.getElementById('ownerPointsIssued');
const ownerGrowth = document.getElementById('ownerGrowth');
const ownerNewVisits = document.getElementById('ownerNewVisits');
const ownerNewAccounts = document.getElementById('ownerNewAccounts');
const ownerEngagementRate = document.getElementById('ownerEngagementRate');
const ownerTopPerformers = document.getElementById('ownerTopPerformers');
const ownerRecentRegistrations = document.getElementById('ownerRecentRegistrations');
const ownerPendingRequestsBody = document.getElementById('ownerPendingRequestsBody');

// Modal Elements
const remarksModal = document.getElementById('remarksModal');
const remarksText = document.getElementById('remarksText');
const submitRemarksBtn = document.getElementById('submitRemarksBtn');
const closeRemarksModal = document.getElementById('closeRemarksModal');
const cancelRemarksBtn = document.getElementById('cancelRemarksBtn');
const remarksTitle = document.getElementById('remarksTitle');

// Pricing Elements
const priceModal = document.getElementById('priceModal');
const btnAddPrice = document.getElementById('btnAddPrice');
const btnUploadPrices = document.getElementById('btnUploadPrices');
const submitPriceBtn = document.getElementById('submitPriceBtn');
const closePriceModal = document.getElementById('closePriceModal');
const cancelPriceBtn = document.getElementById('cancelPriceBtn');
const pricingTableBody = document.getElementById('pricingTableBody');
const pricingMessage = document.getElementById('pricingMessage');
const priceProductId = document.getElementById('priceProductId');
const priceProductName = document.getElementById('priceProductName');
const pricePackSize = document.getElementById('pricePackSize');
const priceRetailer = document.getElementById('priceRetailer');
const priceMechanic = document.getElementById('priceMechanic');

// Upload Price Modal Elements
const uploadPriceModal = document.getElementById('uploadPriceModal');
const priceListFile = document.getElementById('priceListFile');
const submitUploadPriceBtn = document.getElementById('submitUploadPriceBtn');
const closeUploadPriceModal = document.getElementById('closeUploadPriceModal');
const cancelUploadPriceBtn = document.getElementById('cancelUploadPriceBtn');
const uploadPreview = document.getElementById('uploadPreview');
const uploadPreviewBody = document.getElementById('uploadPreviewBody');

let loginSheetHeaders = [];
let loginSheetRecords = [];
let metricsSheetHeaders = [];
let metricsSheetRecords = [];
let productSheetHeaders = [];
let productSheetRecords = [];
let pricingSheetHeaders = [];
let pricingSheetRecords = [];
let priceSyncInterval = null;
let qrStream = null;
let barcodeDetector = null;
// Track scanned QR codes in the current purchase form to prevent duplicates
let scannedQrSet = new Set();
let productPrices = [];
let pendingApprovalRequest = null;
let priceListToUpload = [];
let purchaseRequests = [];
// Simple in-memory cache for API responses
const __apiCache = {};
const CACHE_TTL = (config.CACHE_TTL_SECONDS || 60) * 1000;

function cacheGet(key) {
    const rec = __apiCache[key];
    if (!rec) return null;
    if (Date.now() - rec.ts > rec.ttl) { delete __apiCache[key]; return null; }
    return rec.val;
}

function cacheSet(key, val, ttl = CACHE_TTL) { __apiCache[key] = { val, ts: Date.now(), ttl }; }

// Load external script dynamically
function loadScript(src, opts = {}) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[data-src="${src}"]`) || document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        if (opts.async) s.async = true;
        if (opts.defer) s.defer = true;
        s.setAttribute('data-src', src);
        s.onload = () => resolve();
        s.onerror = (e) => reject(new Error('Failed to load ' + src));
        document.body.appendChild(s);
    });
}

async function ensureJsQR() {
    if (window.jsQR) return;
    await loadScript('https://cdn.jsdelivr.net/npm/jsqr/dist/jsQR.js', { defer: true });
}

async function ensureXLSX() {
    if (window.XLSX) return;
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js', { defer: true });
}

async function ensureChart() {
    if (window.Chart) return;
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js', { defer: true });
}

// Debounce helper
function debounce(fn, wait = 200) {
    let t = null;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Cacheable wrapper for sheet POST reads
const CACHEABLE_ACTIONS = new Set([API_ACTIONS.products, API_ACTIONS.metrics, API_ACTIONS.users, 'pricing']);

const OWNER_CREDENTIALS = {
    email: config.OWNER_EMAIL || 'owner@vikasautomobiles.com',
    mobile: config.OWNER_MOBILE || '9827003016',
    password: config.OWNER_PASSWORD || '',
    name: 'Owner',
    category: 'owner',
    city: 'Mumbai',
    firmName: 'Vikas Automobiles'
};

function normalizeCredentialList(users) {
    // Normalize user list but never include passwords when persisting or exposing locally
    return (users || []).map(user => ({
        email: normalizeText(user.email || ''),
        mobile: normalizeMobile(user.mobile || ''),
        name: (user.name || '').toString().trim(),
        category: (user.category || '').toString().trim(),
        city: (user.city || '').toString().trim(),
        firmName: (user.firmName || '').toString().trim()
    })).filter(user => (user.email || user.mobile));
}

function loadLocalUsers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.users);
        if (!raw) return [];
        const data = JSON.parse(raw);
        // Sanitize any stored entries (strip password if present)
        if (!Array.isArray(data)) return [];
        return data.map(u => ({ email: normalizeText(u.email||''), mobile: normalizeMobile(u.mobile||''), name: (u.name||'').toString().trim(), category: (u.category||'').toString().trim(), city: (u.city||'').toString().trim(), firmName: (u.firmName||u.firmname||'').toString().trim(), registeredAt: u.registeredAt || u.registeredat || '' }));
    } catch (error) {
        console.warn('Could not load local users from storage:', error);
        return [];
    }
}

function persistLocalUsers(users) {
    try {
        // Persist only non-sensitive fields to localStorage
        const safe = (users || []).map(u => ({ email: normalizeText(u.email||''), mobile: normalizeMobile(u.mobile||''), name: (u.name||'').toString().trim(), category: (u.category||'').toString().trim(), city: (u.city||'').toString().trim(), firmName: (u.firmName||u.firmname||'').toString().trim(), registeredAt: u.registeredAt || u.registeredat || '' }));
        localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(safe));
    } catch (error) {
        console.warn('Could not persist local users to storage:', error);
    }
}

function sanitizeUserForSession(user) {
    if (!user) return null;
    const { email, mobile, name, category, city, firmName } = user;
    return {
        email: normalizeText(email || ''),
        mobile: normalizeMobile(mobile || ''),
        name: (name || '').toString().trim(),
        category: (category || '').toString().trim(),
        city: (city || '').toString().trim(),
        firmName: (firmName || '').toString().trim(),
        lastLogin: new Date().toISOString()
    };
}

function saveSession(user) {
    try {
        const safeUser = sanitizeUserForSession(user);
        if (safeUser) {
            // default session expiry 24 hours
            const sessionObj = {
                user: safeUser,
                token: null,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000
            };
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionObj));
        }
    } catch (error) {
        console.warn('Could not save session:', error);
    }
}

function persistSession(user, token = null, hours = 24) {
    try {
        const safeUser = sanitizeUserForSession(user);
        if (!safeUser) return;
        const sessionObj = {
            user: safeUser,
            token: token || null,
            expiresAt: Date.now() + (hours * 60 * 60 * 1000)
        };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionObj));
        currentUser = safeUser;
    } catch (err) {
        console.warn('Could not persist session:', err);
    }
}

function getSessionToken() {
    try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj && obj.token ? obj.token : null;
    } catch (e) {
        return null;
    }
}

function loadSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.warn('Could not restore session:', error);
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    currentUser = null;
    otpSession = null;
    isLoginInProgress = false;
    isOtpProcessing = false;
}

function setButtonLoading(button, isLoading, loadingLabel = 'Loading...') {
    if (!button) return;
    if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = button.textContent;
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingLabel : button.dataset.originalLabel;
}

function validateLoginIdentifier(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return { valid: false, message: 'Please enter an email or mobile number.' };
    }
    const numeric = trimmed.replace(/\D/g, '');
    if (trimmed.includes('@')) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(trimmed)) {
            return { valid: false, message: 'Please enter a valid email address.' };
        }
        return { valid: true, normalized: normalizeText(trimmed) };
    }
    if (numeric.length === 10 && /^[0-9]+$/.test(numeric)) {
        return { valid: true, normalized: numeric };
    }
    return { valid: false, message: 'Please enter a valid 10-digit mobile number or email.' };
}

function createOtpSession(user) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    return {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
        identifier: normalizeText(user.email || user.mobile || '')
    };
}

function initializeSession() {
    const sessionObj = loadSession();
    if (!sessionObj) return;
    if (sessionObj.expiresAt && Date.now() > sessionObj.expiresAt) {
        clearSession();
        return;
    }
    // If token exists, validate with server
    const token = sessionObj.token;
    if (token && API_URL) {
        validateSessionWithServer(token).then(res => {
            if (res && res.user) {
                currentUser = res.user;
                showDashboard(currentUser);
                showMessage('Session restored. Welcome back.', 'success');
            } else {
                clearSession();
            }
        }).catch(() => clearSession());
    } else {
        currentUser = sessionObj.user;
        showDashboard(currentUser);
        showMessage('Session restored. Welcome back.', 'success');
    }
}

async function authenticateCredentials(identifier, password) {
    if (!usersLoaded) {
        await bootstrapFallbackCredentials();
    }

    const normalizedPassword = (password || '').toString().trim();
    const isPasswordValid = normalizedPassword.length >= 6;
    if (!isPasswordValid) {
        showMessage('Password must be at least 6 characters.', 'error');
        return null;
    }

    const localMatch = allowedUsers.find(item => {
        const emailMatch = item.email && normalizeText(item.email) === identifier;
        const mobileMatch = item.mobile && normalizeMobile(item.mobile) === identifier;
        return (emailMatch || mobileMatch) && item.password === normalizedPassword;
    });
    // Require server authentication for credential verification (do not fall back to local password storage)
    if (!API_URL) {
        showMessage('Server authentication is not configured. Please set the API endpoint.', 'error');
        return null;
    }
    if (API_URL) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: API_ACTIONS.authenticate, email: identifier, password: normalizedPassword, mobile: identifier })
            });

            if (!response.ok) {
                showMessage('Unable to authenticate. Please try again later.', 'error');
                return null;
            }

            const result = await response.json();
            if (result && result.success && result.user) {
                const normalizedUser = normalizeCredentialList([result.user])[0];
                if (normalizedUser) {
                    const combinedUsers = [...allowedUsers.filter(item => (item.email || item.mobile) !== (normalizedUser.email || normalizedUser.mobile)), normalizedUser];
                    allowedUsers = combinedUsers;
                    usersLoaded = true;
                    persistLocalUsers(allowedUsers);
                    return { user: normalizedUser, token: result.token || null };
                }
            }
        } catch (error) {
            console.warn('Server login failed:', error);
            showMessage('Network error during login. Please check your connection and try again.', 'error');
            return null;
        }
    }

    // No local fallback for passwords; require server-side authentication

    return null;
}

async function loadUsersFromServer() {
    if (!API_URL) {
        return [];
    }
    try {
        const token = (loadSession() && loadSession().token) ? encodeURIComponent(loadSession().token) : '';
        const tokenParam = token ? `&token=${token}` : '';
        const response = await fetch(`${API_URL}?action=${encodeURIComponent(API_ACTIONS.users)}${tokenParam}`, { cache: 'no-store' });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Could not load users from server:', error);
        return [];
    }
}

async function validateSessionWithServer(token) {
    if (!API_URL || !token) return null;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: API_ACTIONS.validate, token })
        });
        if (!response.ok) return null;
        const result = await response.json();
        if (result && result.valid && result.user) {
            const user = normalizeCredentialList([result.user])[0];
            return { user, isOwner: !!result.isOwner, isAdmin: !!result.isAdmin || (result.user && String(result.user.role||'').toLowerCase()==='admin') };
        }
    } catch (err) {
        console.warn('Session validation failed:', err);
    }
    return null;
}

function clearLoginFields() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
}

function resetOtpTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    resendBtn.disabled = true;
    if (timerSpan) {
        timerSpan.textContent = '60';
    }
}

function resetLoginState() {
    resetOtpTimer();
    clearLoginFields();
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }
    currentUser = null;
}

function ensureOwnerCredentialExists() {
    const localUsers = loadLocalUsers();
    const existing = localUsers.find(user => normalizeText(user.email || '') === normalizeText(OWNER_CREDENTIALS.email) || normalizeMobile(user.mobile || '') === normalizeMobile(OWNER_CREDENTIALS.mobile));
    if (existing) return localUsers;

    const ownerUser = {
        email: OWNER_CREDENTIALS.email,
        mobile: OWNER_CREDENTIALS.mobile,
        password: OWNER_CREDENTIALS.password,
        name: OWNER_CREDENTIALS.name,
        category: OWNER_CREDENTIALS.category,
        city: OWNER_CREDENTIALS.city,
        firmName: OWNER_CREDENTIALS.firmName
    };

    const updatedUsers = [...localUsers, ownerUser];
    persistLocalUsers(updatedUsers);
    return updatedUsers;
}

async function bootstrapFallbackCredentials() {
    ensureOwnerCredentialExists();
    const serverUsers = normalizeCredentialList(await loadUsersFromServer());
    const localUsers = normalizeCredentialList(loadLocalUsers());
    const mergedUsers = [...serverUsers, ...localUsers];
    const dedupedUsers = mergedUsers.filter((user, index, self) => index === self.findIndex(candidate => (candidate.email || candidate.mobile) === (user.email || user.mobile)));
    allowedUsers = dedupedUsers;
    usersLoaded = allowedUsers.length > 0;
    if (allowedUsers.length) {
        persistLocalUsers(allowedUsers);
    }
}

function normalizeSheetUrl(url) {
    if (url.includes('/edit')) {
        return url.replace(/\/edit.*$/, '/gviz/tq?tqx=out:json');
    }
    return url;
}

function normalizeText(value) {
    return (value || '').toString().trim().toLowerCase();
}

function normalizeMobile(value) {
    return (value || '').toString().replace(/\D/g, '').trim();
}

function getSheetHeader(preferredLabels, headers) {
    if (!Array.isArray(headers)) return '';
    return headers.find(header => preferredLabels.includes(header));
}

function getSheetField(record, preferredLabels, headers) {
    const header = getSheetHeader(preferredLabels, headers);
    if (!header || !record) return '';
    return record[header] ?? '';
}

function parseSheetNumber(value) {
    if (value === undefined || value === null) return 0;
    const normalized = value.toString().trim().replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    return parseFloat(normalized) || 0;
}

function parseSheetDate(value) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

function firstSheetValue(preferredLabels, headers, records) {
    const header = getSheetHeader(preferredLabels, headers);
    if (!header || !Array.isArray(records) || records.length === 0) return '';
    return records[0][header] === undefined ? '' : records[0][header].toString().trim();
}

function findSheetValueByRowKey(preferredLabels, valueHeaders, headers, records) {
    if (!Array.isArray(headers) || !Array.isArray(records) || records.length === 0) return '';
    const keyHeader = getSheetHeader(['metric', 'name', 'label', 'key', 'field'], headers);
    const valueHeader = getSheetHeader(valueHeaders, headers);
    if (!keyHeader || !valueHeader) return '';

    const normalizedKeys = preferredLabels.map(label => normalizeText(label));
    for (const record of records) {
        const keyValue = normalizeText(record[keyHeader]);
        if (normalizedKeys.includes(keyValue)) {
            return record[valueHeader] === undefined ? '' : record[valueHeader].toString().trim();
        }
    }
    return '';
}

function getSheetValue(preferredLabels, headers, records) {
    const headerValue = firstSheetValue(preferredLabels, headers, records);
    if (headerValue) return headerValue;
    return findSheetValueByRowKey(preferredLabels, ['value', 'amount', 'count', 'metric value', 'metric_value'], headers, records);
}

function countCategoryRecords(category, headers, records) {
    const categoryHeader = getSheetHeader(['category', 'user type', 'type'], headers);
    if (!categoryHeader || !Array.isArray(records)) return 0;
    return records.filter(record => normalizeText(record[categoryHeader]) === category).length;
}

function sumSheetField(preferredLabels, headers, records) {
    const header = getSheetHeader(preferredLabels, headers);
    if (!header || !Array.isArray(records)) return 0;
    return records.reduce((sum, record) => sum + parseSheetNumber(record[header]), 0);
}

function computeMonthlyGrowth() {
    const currentValue = parseSheetNumber(firstSheetValue(['current month', 'current_month', 'current month users', 'current month accounts'], metricsSheetHeaders, metricsSheetRecords));
    const previousValue = parseSheetNumber(firstSheetValue(['previous month', 'previous_month', 'previous month users', 'previous month accounts'], metricsSheetHeaders, metricsSheetRecords));
    if (previousValue === 0) return '';
    return `${((currentValue - previousValue) / previousValue * 100).toFixed(1)}%`;
}

function countRecentAccounts(days = 7, headers = metricsSheetHeaders, records = metricsSheetRecords) {
    const dateHeader = getSheetHeader(['registration date', 'registered', 'signup date', 'date'], headers);
    if (!dateHeader || !Array.isArray(records)) return 0;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return records.reduce((count, record) => {
        const date = parseSheetDate(record[dateHeader]);
        return date && date >= cutoff ? count + 1 : count;
    }, 0);
}

// removed legacy commented duplicate logging functions

async function logLoginEvent(user, loginInputValue) {
    if (!user) return;

    const normalizedLoginInput = normalizeMobile(loginInputValue || '');
    const loginByMobile = normalizedLoginInput && normalizedLoginInput === normalizeMobile(user.mobile || '');
    const emailValue = loginByMobile ? '' : (user.email || '');

    const params = new URLSearchParams({
        timestamp: new Date().toISOString(),
        loginInput: loginInputValue || '',
        loginMethod: loginByMobile ? 'mobile' : 'email',
        email: emailValue,
        mobile: user.mobile || '',
        name: user.name || '',
        category: user.category || '',
        city: user.city || '',
        firmName: user.firmName || '',
        status: 'login_successful',
        sourceUrl: window.location.href,
        userAgent: navigator.userAgent || ''
    });

    const sheetUrl = SHEET_LOGIN_EVENT_URL;
    if (!sheetUrl) {
        console.warn('No sheetLoginUrl configured; login event not sent.');
        return;
    }

    const url = `${sheetUrl}?${params.toString()}`;
    try {
        await fetch(url, { method: 'GET' });
        console.log('Login event sent to Google Sheet.');
    } catch (error) {
        console.error('Failed to send login event to Google Sheet:', error);
    }
}


async function logPurchaseRequest(request) {
    if (!request) return;

    const params = new URLSearchParams({
        type: 'purchase_request',
        sheetName: WORKSPACE_SHEET_NAMES.sales,
        requestId: request.requestId || '',
        productId: request.productId || '',
        productName: request.productName || '',
        packSize: request.packSize || '',
        quantity: request.quantity || '',
        amount: request.amount || '',
        submitterName: request.submitterName || '',
        submitterEmail: request.submitterEmail || '',
        submitterMobile: request.submitterMobile || '',
        status: request.status || '',
        submittedAt: request.submittedAt || new Date().toISOString(),
        sourceUrl: window.location.href
    });

    const sheetUrl = SHEET_PURCHASE_URL;
    if (!sheetUrl) {
        console.warn('No sheetPurchaseUrl configured; purchase request not sent to Google Sheet.');
        return;
    }

    const url = `${sheetUrl}?${params.toString()}`;
    try {
        await fetch(url, { method: 'GET' });
        console.log('Purchase request sent to Google Sheet.');
    } catch (error) {
        console.error('Failed to send purchase request to Google Sheet:', error);
    }
}

async function logPurchaseApproval(request, approved) {
    if (!request) return;

    const params = new URLSearchParams({
        type: 'purchase_approval',
        sheetName: WORKSPACE_SHEET_NAMES.sales,
        requestId: request.requestId || '',
        productId: request.productId || '',
        productName: request.productName || '',
        packSize: request.packSize || '',
        quantity: request.quantity || '',
        amount: request.amount || '',
        submitterName: request.submitterName || '',
        submitterEmail: request.submitterEmail || '',
        submitterMobile: request.submitterMobile || '',
        actionType: approved ? 'Approved' : 'Rejected',
        actionBy: request.actionBy || '',
        actionAt: request.actionAt || new Date().toISOString(),
        status: request.status || '',
        pointsAwarded: request.pointsAwarded || 0,
        remark: request.remark || '',
        sourceUrl: window.location.href
    });

    const sheetUrl = SHEET_PURCHASE_URL;
    if (!sheetUrl) {
        console.warn('No sheetPurchaseUrl configured; approval not sent to Google Sheet.');
        return;
    }

    const url = `${sheetUrl}?${params.toString()}`;
    try {
        await fetch(url, { method: 'GET' });
        console.log('Purchase approval sent to Google Sheet.');
    } catch (error) {
        console.error('Failed to send purchase approval to Google Sheet:', error);
    }
}

function parseGoogleSheetData(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return { headers: [], records: [] };
    }

    const trimmed = text.trim();
    const candidates = [trimmed];
    const wrappedStart = trimmed.indexOf('(');
    const wrappedEnd = trimmed.lastIndexOf(')');
    if (wrappedStart >= 0 && wrappedEnd > wrappedStart) {
        candidates.push(trimmed.slice(wrappedStart + 1, wrappedEnd));
    }

    let data = null;
    for (const candidate of candidates) {
        try {
            data = JSON.parse(candidate);
            break;
        } catch (error) {
            continue;
        }
    }

    if (!data) {
        console.warn('Unable to parse sheet response payload.', trimmed.slice(0, 200));
        return { headers: [], records: [] };
    }

    if (Array.isArray(data)) {
        return { headers: [], records: data };
    }

    if (Array.isArray(data.records)) {
        const headers = Array.isArray(data.headers)
            ? data.headers
            : Object.keys(data.records[0] || {});
        const normalizedHeaders = headers.map(header => header.toString().trim().toLowerCase());
        const records = data.records.map(record => {
            if (record && typeof record === 'object' && !Array.isArray(record)) {
                return Object.keys(record).reduce((accumulator, key) => {
                    accumulator[key.toString().trim().toLowerCase()] = record[key];
                    return accumulator;
                }, {});
            }
            return normalizedHeaders.reduce((accumulator, header, index) => {
                accumulator[header] = record?.[index] ?? '';
                return accumulator;
            }, {});
        });
        return { headers: normalizedHeaders, records };
    }

    if (data.table && Array.isArray(data.table.cols) && Array.isArray(data.table.rows)) {
        const headers = data.table.cols.map(col => (col.label || '').toString().trim().toLowerCase());
        const records = data.table.rows.map(row => {
            const cells = row.c || [];
            return headers.reduce((record, label, index) => {
                record[label] = cells[index]?.v ?? '';
                return record;
            }, {});
        });
        return { headers, records };
    }

    if (Array.isArray(data.headers) || Array.isArray(data.columns)) {
        const headers = Array.isArray(data.headers) ? data.headers : data.columns;
        const rows = Array.isArray(data.rows) ? data.rows : [];
        const normalizedHeaders = headers.map(header => header.toString().trim().toLowerCase());
        const records = rows.map(row => {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                return Object.keys(row).reduce((accumulator, key) => {
                    accumulator[key.toString().trim().toLowerCase()] = row[key];
                    return accumulator;
                }, {});
            }
            return normalizedHeaders.reduce((accumulator, header, index) => {
                accumulator[header] = row?.[index] ?? '';
                return accumulator;
            }, {});
        });
        return { headers: normalizedHeaders, records };
    }

    return { headers: [], records: [] };
}

async function fetchSheetData(action, sheetName = '') {
    try {
        if (!API_URL) {
            return { headers: [], records: [] };
        }

        // Try cache for read-like actions
        const cacheKey = `sheet:${action}:${sheetName || ''}`;
        if (CACHEABLE_ACTIONS.has(action)) {
            const cached = cacheGet(cacheKey);
            if (cached) return cached;
        }

        const payload = { action };
        if (sheetName) {
            payload.sheetName = sheetName;
        }
        const token = getSessionToken();
        if (token) payload.token = token;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Sheet request failed with status ${response.status}`);
        }

        const text = await response.text();
        const parsed = parseGoogleSheetData(text);
        const out = {
            headers: parsed.headers || [],
            records: parsed.records || []
        };
        if (CACHEABLE_ACTIONS.has(action)) cacheSet(cacheKey, out);
        return {
            headers: out.headers,
            records: out.records
        };
    } catch (error) {
        console.warn(`Unable to load ${action} data from the workspace sheet:`, error);
        return { headers: [], records: [] };
    }
}

async function fetchLoginSheetUsers() {
    try {
        ensureOwnerCredentialExists();

        const serverUsers = normalizeCredentialList(await loadUsersFromServer());
        const localUsers = normalizeCredentialList(loadLocalUsers());
        const { headers, records } = await fetchSheetData(API_ACTIONS.users, WORKSPACE_SHEET_NAMES.users);
        loginSheetHeaders = headers;
        loginSheetRecords = records;

        const sheetUsers = loginSheetRecords.map(record => ({
            email: normalizeText(getSheetField(record, ['email', 'email address'], loginSheetHeaders)),
            mobile: normalizeMobile(getSheetField(record, ['mobile', 'mobile no', 'mobile number', 'phone', 'phone number'], loginSheetHeaders)),
            password: (getSheetField(record, ['password', 'pass'], loginSheetHeaders) || '').toString().trim(),
            name: getSheetField(record, ['name', 'full name', 'username'], loginSheetHeaders)?.toString().trim() || '',
            category: getSheetField(record, ['category'], loginSheetHeaders)?.toString().trim() || '',
            city: getSheetField(record, ['city', 'town'], loginSheetHeaders)?.toString().trim() || '',
            firmName: getSheetField(record, ['firm name', 'company', 'business name'], loginSheetHeaders)?.toString().trim() || ''
        })).filter(item => (item.email || item.mobile) && item.password);

        const mergedUsers = [...serverUsers, ...localUsers, ...sheetUsers];
        const dedupedUsers = mergedUsers.filter((user, index, self) => index === self.findIndex(candidate => (candidate.email || candidate.mobile) === (user.email || user.mobile)));
        allowedUsers = dedupedUsers;
        usersLoaded = allowedUsers.length > 0;
        if (allowedUsers.length) {
            persistLocalUsers(allowedUsers);
        }
        if (!usersLoaded) {
            showMessage('No credentials were loaded from the sheet. Check your sheet columns and API endpoint.', 'error');
        }
    } catch (error) {
        console.warn('Falling back to local/server credentials because the sheet could not be loaded:', error);
        const serverUsers = normalizeCredentialList(await loadUsersFromServer());
        const localUsers = normalizeCredentialList(loadLocalUsers());
        const mergedUsers = [...serverUsers, ...localUsers];
        const dedupedUsers = mergedUsers.filter((user, index, self) => index === self.findIndex(candidate => (candidate.email || candidate.mobile) === (user.email || user.mobile)));
        allowedUsers = dedupedUsers;
        usersLoaded = allowedUsers.length > 0;
        if (allowedUsers.length) {
            persistLocalUsers(allowedUsers);
        }
    }
}

async function fetchMetricsSheetData() {
    try {
        const { headers, records } = await fetchSheetData(API_ACTIONS.metrics, WORKSPACE_SHEET_NAMES.metrics);
        metricsSheetHeaders = headers || [];
        metricsSheetRecords = records || [];
        updateOwnerSheetMetrics();
    } catch (error) {
        console.error('Failed to load metrics sheet data:', error);
        metricsSheetHeaders = [];
        metricsSheetRecords = [];
        updateOwnerSheetMetrics();
    }
}

async function fetchProductSheetData() {
    try {
        const { headers, records } = await fetchSheetData(API_ACTIONS.products, WORKSPACE_SHEET_NAMES.product);
        productSheetHeaders = headers || [];
        productSheetRecords = records || [];
    } catch (error) {
        console.warn('Product sheet unavailable; continuing without it:', error);
        productSheetHeaders = [];
        productSheetRecords = [];
    }
}

function populateOwnerTopPerformers() {
    if (!ownerTopPerformers || !metricsSheetRecords.length) return false;

    const nameHeader = getSheetHeader(['name', 'full name', 'username', 'firm name', 'firmname'], metricsSheetHeaders);
    const categoryHeader = getSheetHeader(['category', 'user type', 'type'], metricsSheetHeaders);
    const cityHeader = getSheetHeader(['city', 'location', 'town'], metricsSheetHeaders);
    const pointsHeader = getSheetHeader(['points', 'loyalty points', 'redeemed points', 'points issued', 'points earned'], metricsSheetHeaders);

    const sorted = [...metricsSheetRecords];
    if (pointsHeader) {
        sorted.sort((a, b) => parseSheetNumber(b[pointsHeader]) - parseSheetNumber(a[pointsHeader]));
    }

    const items = sorted.slice(0, 3).map(record => {
        const title = getSheetField(record, ['name', 'full name', 'username', 'firm name', 'firmname'], metricsSheetHeaders) || 'Unknown';
        const category = getSheetField(record, ['category', 'user type', 'type'], metricsSheetHeaders);
        const city = getSheetField(record, ['city', 'location', 'town'], metricsSheetHeaders);
        const points = pointsHeader ? parseSheetNumber(record[pointsHeader]) : null;
        let label = `${title}`;
        if (category) label += ` | ${category}`;
        if (city) label += ` | ${city}`;
        if (pointsHeader && points !== null) label += ` - ${points} pts`;
        return `<li>${label}</li>`;
    });

    if (items.length) {
        ownerTopPerformers.innerHTML = items.join('');
        return true;
    }
    return false;
}

function populateRecentRegistrations() {
    if (!ownerRecentRegistrations || !metricsSheetRecords.length) return false;

    const nameHeader = getSheetHeader(['name', 'full name', 'username', 'firm name', 'firmname'], metricsSheetHeaders);
    const categoryHeader = getSheetHeader(['category', 'user type', 'type'], metricsSheetHeaders);
    const cityHeader = getSheetHeader(['city', 'location', 'town'], metricsSheetHeaders);
    const dateHeader = getSheetHeader(['registration date', 'registered', 'signup date', 'date'], metricsSheetHeaders);

    const sorted = [...metricsSheetRecords];
    if (dateHeader) {
        sorted.sort((a, b) => {
            const dateA = parseSheetDate(a[dateHeader]);
            const dateB = parseSheetDate(b[dateHeader]);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        });
    }

    const items = sorted.slice(0, 3).map(record => {
        const title = getSheetField(record, ['name', 'full name', 'username', 'firm name', 'firmname']) || 'Unknown';
        const category = getSheetField(record, ['category', 'user type', 'type']);
        const city = getSheetField(record, ['city', 'location', 'town']);
        let label = `${title}`;
        if (category) label += ` | ${category}`;
        if (city) label += ` | ${city}`;
        return `<li>${label}</li>`;
    });

    if (items.length) {
        ownerRecentRegistrations.innerHTML = items.join('');
        return true;
    }
    return false;
}

function populateLivePortalMetrics() {
    if (!ownerNewVisits || !ownerNewAccounts || !ownerEngagementRate || !metricsSheetRecords.length) return false;

    const visitsValue = getSheetValue(['new visits today', 'new visits', 'site visits', 'visits today'], metricsSheetHeaders, metricsSheetRecords);
    const accountsValue = getSheetValue(['new accounts', 'new accounts today', 'accounts today'], metricsSheetHeaders, metricsSheetRecords);
    const engagementValue = getSheetValue(['engagement rate', 'engagement', 'engagement_rate'], metricsSheetHeaders, metricsSheetRecords);

    if (visitsValue) ownerNewVisits.textContent = visitsValue;
    if (accountsValue) ownerNewAccounts.textContent = accountsValue;
    if (engagementValue) ownerEngagementRate.textContent = engagementValue;

    if (!accountsValue) {
        const recentCount = countRecentAccounts(7);
        if (recentCount) ownerNewAccounts.textContent = String(recentCount);
    }

    return Boolean(visitsValue || accountsValue || engagementValue);
}

function updateOwnerSheetMetrics() {
    if (!metricsSheetRecords.length) return false;

    const totalRetailers = parseSheetNumber(getSheetValue(['total retailers', 'retailers count', 'retailer count'], metricsSheetHeaders, metricsSheetRecords)) || countCategoryRecords('retailer', metricsSheetHeaders, metricsSheetRecords);
    const activeMechanics = parseSheetNumber(getSheetValue(['active mechanics', 'mechanic count', 'mechanics count'], metricsSheetHeaders, metricsSheetRecords)) || countCategoryRecords('mechanic', metricsSheetHeaders, metricsSheetRecords);
    const pointsIssued = parseSheetNumber(getSheetValue(['total points issued', 'points issued', 'total points'], metricsSheetHeaders, metricsSheetRecords)) || sumSheetField(['points', 'loyalty points', 'redeemed points', 'points issued'], metricsSheetHeaders, metricsSheetRecords);
    let growthValue = getSheetValue(['monthly growth', 'growth', 'monthly_growth'], metricsSheetHeaders, metricsSheetRecords);
    if (!growthValue) {
        growthValue = computeMonthlyGrowth();
    }

    if (ownerTotalRetailers) ownerTotalRetailers.textContent = String(totalRetailers);
    if (ownerActiveMechanics) ownerActiveMechanics.textContent = String(activeMechanics);
    if (ownerPointsIssued) ownerPointsIssued.textContent = String(pointsIssued);
    if (ownerGrowth) ownerGrowth.textContent = growthValue || ownerGrowth.textContent;

    populateOwnerTopPerformers();
    populateRecentRegistrations();
    populateLivePortalMetrics();
    return true;
}

bootstrapFallbackCredentials();
fetchLoginSheetUsers();
fetchMetricsSheetData();
fetchProductSheetData();
initializeSession();

// Handle login form submission
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (isLoginInProgress) {
        return;
    }

    const identifier = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const validation = validateLoginIdentifier(identifier);

    if (!validation.valid) {
        showMessage(validation.message, 'error');
        return;
    }

    if (!password || password.length < 6) {
        showMessage('Please enter your password. Password must be at least 6 characters.', 'error');
        return;
    }

    isLoginInProgress = true;
    setButtonLoading(loginSubmitButton, true, 'Checking...');
    showMessage('Validating credentials...', 'info');

    const authResult = await authenticateCredentials(validation.normalized, password);

    if (!authResult || !authResult.user) {
        const msg = allowedUsers.length === 0
            ? 'No registered users were loaded. Register first or check the file-backed user store.'
            : 'Invalid credentials or network issue. Please check your email/mobile and password.';
        showMessage(msg, 'error');
        isLoginInProgress = false;
        setButtonLoading(loginSubmitButton, false);
        return;
    }
    currentUser = authResult.user;
    userEmail = identifier;
    otpSession = createOtpSession(currentUser);
    // attach temporary auth token (if server provided one) until OTP verification completes
    if (authResult.token) otpSession.tempAuthToken = authResult.token;
    setButtonLoading(loginSubmitButton, false);
    isLoginInProgress = false;

    showMessage('OTP sent to your registered email/phone. Enter it below.', 'success');
    loginForm.style.display = 'none';
    otpForm.style.display = 'block';
    resetOTPForm();
    startTimer();
    otpDigits[0].focus();
});

// Handle OTP form submission
otpForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (isOtpProcessing) {
        return;
    }

    const otp = Array.from(otpDigits).map(digit => digit.value.trim()).join('');
    if (!/^[0-9]{6}$/.test(otp)) {
        showMessage('Please enter a valid 6-digit OTP.', 'error');
        return;
    }

    if (!otpSession || !currentUser) {
        showMessage('No OTP request found. Please login again.', 'error');
        return;
    }

    if (Date.now() > otpSession.expiresAt) {
        showMessage('OTP has expired. Please resend the OTP and try again.', 'error');
        return;
    }

    isOtpProcessing = true;
    setButtonLoading(otpSubmitButton, true, 'Verifying...');

    if (otp !== otpSession.otp) {
        otpSession.attempts += 1;
        const remaining = Math.max(0, 3 - otpSession.attempts);
        if (remaining === 0) {
            showMessage('Too many invalid attempts. Please resend the OTP.', 'error');
            resendBtn.disabled = false;
        } else {
            showMessage(`Invalid OTP. ${remaining} attempt(s) remaining.`, 'error');
        }
        isOtpProcessing = false;
        setButtonLoading(otpSubmitButton, false);
        return;
    }

    const tempToken = otpSession?.tempAuthToken || null;
    otpSession = null;
    isOtpProcessing = false;
    setButtonLoading(otpSubmitButton, false);
    // persist session including token if available; short expiry if no token
    persistSession(currentUser, tempToken, tempToken ? 24 : 2);
    showMessage('Login successful!', 'success');
    logLoginEvent(currentUser, document.getElementById('email').value.trim());
    showDashboard(currentUser);
});

// Handle OTP digit inputs
otpDigits.forEach((digit, index) => {
    digit.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < otpDigits.length - 1) {
            otpDigits[index + 1].focus();
        }
    });
    
    digit.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
            otpDigits[index - 1].focus();
        }
    });
    
    digit.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        pastedData.split('').forEach((char, i) => {
            if (i < otpDigits.length && /\d/.test(char)) {
                otpDigits[i].value = char;
            }
        });
    });
});

// Resend OTP
resendBtn.addEventListener('click', () => {
    showMessage('OTP resent successfully!', 'success');
    resetOTPForm();
    startTimer();
    otpDigits[0].focus();
});

// Back to login
backBtn.addEventListener('click', () => {
    otpForm.style.display = 'none';
    loginForm.style.display = 'block';
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    messageDiv.textContent = '';
    if (timerInterval) clearInterval(timerInterval);
});

// Timer function
function startTimer() {
    otpTimer = 60;
    timerSpan.textContent = otpTimer;
    resendBtn.disabled = true;
    
    timerInterval = setInterval(() => {
        otpTimer--;
        timerSpan.textContent = otpTimer;
        
        if (otpTimer <= 0) {
            clearInterval(timerInterval);
            resendBtn.disabled = false;
        }
    }, 1000);
}

// Reset OTP form
function resetOTPForm() {
    otpDigits.forEach(digit => digit.value = '');
    messageDiv.textContent = '';
}

function getDashboardPoints(user) {
    if (!user) return 0;
    const base = 120;
    const bonus = user.name ? user.name.length * 4 : 0;
    const mobileBonus = user.mobile ? parseInt(user.mobile.slice(-2), 10) || 0 : 0;
    return base + bonus + mobileBonus;
}

function getDashboardActivity(user) {
    const activity = [];
    if (!user) return activity;

    activity.push(`Welcome back, ${user.name || user.email || user.mobile}!`);
    if (user.category) {
        activity.push(`Account type: ${user.category}`);
    }
    if (user.city) {
        activity.push(`Location: ${user.city}`);
    }
    activity.push('OTP verified successfully.');
    activity.push('You can view loyalty points and rewards here.');
    return activity;
}

function hideLoginUI() {
    if (loginCard) {
        loginCard.classList.add('hidden-ui');
    }
    if (loginForm) {
        loginForm.style.display = 'none';
    }
    if (otpForm) {
        otpForm.style.display = 'none';
    }
    const registrationForm = document.getElementById('registrationForm');
    if (registrationForm) {
        registrationForm.style.display = 'none';
    }
}

function showLoginUI() {
    if (loginCard) {
        loginCard.classList.remove('hidden-ui');
    }
    if (loginForm) {
        loginForm.style.display = 'block';
    }
    if (otpForm) {
        otpForm.style.display = 'none';
    }
    const registrationForm = document.getElementById('registrationForm');
    if (registrationForm) {
        registrationForm.style.display = 'none';
    }
}

function isOwner(user) {
    if (!user) return false;

    const role = (user.category || user.role || '').toString().trim().toLowerCase();
    if (['retailer', 'mechanic', 'retailers', 'mechanics'].includes(role)) {
        return false;
    }

    const ownerEmails = [OWNER_CREDENTIALS.email];
    const ownerRoles = ['owner', 'admin', 'super admin', 'administrator', 'owner admin'];
    const normalizedEmail = (user.email || '').toString().trim().toLowerCase();
    const normalizedName = (user.name || '').toString().trim().toLowerCase();
    const normalizedMobile = normalizeMobile(user.mobile || '');

    if (ownerRoles.includes(role)) {
        return true;
    }

    return ownerEmails.includes(normalizedEmail) ||
        normalizeMobile(OWNER_CREDENTIALS.mobile) === normalizedMobile ||
        ['owner', 'vikas', 'vikas automobiles'].includes(normalizedName);
}

function isAuthorizedCustomer(user) {
    if (!user) return false;
    const role = (user.category || user.role || '').toString().trim().toLowerCase();
    return role === 'retailer' || role === 'mechanic' || role === 'retailers' || role === 'mechanics';
}

function updateDistributorDashboardVisibility(user) {
    const showAuthorizedCustomerPanels = isAuthorizedCustomer(user);

    if (nextRewardCard) {
        nextRewardCard.style.display = showAuthorizedCustomerPanels ? '' : 'none';
    }
    if (activeOffersCard) {
        activeOffersCard.style.display = showAuthorizedCustomerPanels ? '' : 'none';
    }
    if (rewardsSection) {
        rewardsSection.style.display = showAuthorizedCustomerPanels ? '' : 'none';
    }
}

function showDashboard(user) {
    if (!user) {
        clearSession();
        showLoginUI();
        return;
    }
    currentUser = user;
    if (isOwner(user)) {
        // Validate with server before showing owner portal
        const token = getSessionToken();
        if (token && API_URL) {
            validateSessionWithServer(token).then(valid => {
                if (valid && valid.user && valid.isOwner) {
                    showOwnerDashboard(valid.user);
                } else {
                    showMessage('Unauthorized Access', 'error');
                    clearSession();
                    showLoginUI();
                }
            }).catch(() => {
                showMessage('Unauthorized Access', 'error');
                clearSession();
                showLoginUI();
            });
        } else {
            showMessage('Unauthorized Access', 'error');
            clearSession();
            showLoginUI();
        }
        return;
    }
    if (!dashboard) return;
    hideLoginUI();
    if (ownerDashboard) {
        ownerDashboard.style.display = 'none';
    }
    dashboard.style.display = 'block';
    updateDistributorDashboardVisibility(user);
    customerNameSpan.textContent = user?.name || user?.email || user?.mobile || 'Customer';
    pointsBalance.textContent = getDashboardPoints(user);
    renderActivity(getDashboardActivity(user));
    loadPurchaseRequests();
    loadPrices();
    startPriceSync();
    renderProductCatalog();
    renderProfile(user);
    renderNotifications();
    clearPurchaseForm();
}

function showOwnerDashboard(user) {
    if (!ownerDashboard) return;
    if (!user) {
        clearSession();
        showLoginUI();
        return;
    }
    hideLoginUI();
    if (dashboard) {
        dashboard.style.display = 'none';
    }
    ownerDashboard.style.display = 'block';
    if (!updateOwnerSheetMetrics()) {
        if (ownerTotalRetailers) ownerTotalRetailers.textContent = '28';
        if (ownerActiveMechanics) ownerActiveMechanics.textContent = '14';
        if (ownerPointsIssued) ownerPointsIssued.textContent = '1,430';
        if (ownerGrowth) ownerGrowth.textContent = '18%';
    }
    loadPurchaseRequests();
    loadPrices();
    startPriceSync();
    renderPricingTable();
    // load owner module dynamically and show owner UI
    try {
        import('./owner.js').then(owner => {
            owner.initOwnerModule({
                loadLocalUsers,
                loadUsersFromServer,
                normalizeCredentialList,
                STORAGE_KEYS,
                showMessage,
                getPurchaseRequests: () => purchaseRequests,
                setPurchaseRequests: (v) => { purchaseRequests = v; },
                savePurchaseRequests,
                logPurchaseApproval,
                persistLocalUsers,
                persistSession,
                getSessionToken,
                verifyPurchaseRequest,
                validateSessionWithServer,
                isOwner
            });
            // Render owner-specific views
            if (typeof owner.renderOwnerUsers === 'function') owner.renderOwnerUsers();
            if (typeof owner.renderOwnerPendingRequests === 'function') owner.renderOwnerPendingRequests();
            if (typeof owner.computeOwnerSummary === 'function') owner.computeOwnerSummary();
        }).catch(err => console.warn('Could not load owner module:', err));
    } catch (err) {
        console.warn('Owner module dynamic import failed:', err);
    }
}

function verifyPurchaseRequest(requestId, remark = '') {
    if (!requestId) return Promise.reject(new Error('Missing requestId'));
    return import('./owner-api.js').then(api => api.verifyPurchase(requestId, remark)).then(res => {
        // update local store if present
        const idx = (purchaseRequests || []).findIndex(r => r.requestId === requestId);
        if (idx >= 0) {
            purchaseRequests[idx].status = 'Verified by Distributor';
            purchaseRequests[idx].remark = remark || purchaseRequests[idx].remark || '';
            savePurchaseRequests();
        }
        return res;
    });
}
function renderActivity(activity) {
    if (!activityList) return;
    activityList.innerHTML = '';
    if (!activity || !activity.length) {
        activityList.innerHTML = '<li>No recent activity available.</li>';
        return;
    }
    activity.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        activityList.appendChild(li);
    });
}

function renderProfile(user) {
    if (!user) return;
    if (profileName) profileName.textContent = user.name || user.email || user.mobile || 'N/A';
    if (profileCategory) profileCategory.textContent = user.category || user.role || 'Customer';
    if (profileFirm) profileFirm.textContent = user.firmName || 'N/A';
    if (profileEmail) profileEmail.textContent = user.email || 'N/A';
    if (profileMobile) profileMobile.textContent = user.mobile || 'N/A';
    if (profileCity) profileCity.textContent = user.city || 'N/A';
}

function renderNotifications() {
    if (!notificationsList) return;
    const listItems = [
        'Welcome to your dashboard.',
        'Scan product QR codes to submit purchase requests.',
        'Approved purchases earn points automatically once processed.',
    ];
    notificationsList.innerHTML = listItems.map(item => `<li>${item}</li>`).join('');
}

function renderProductCatalog() {
    if (!productListBody) return;
    const query = productSearchInput?.value.trim().toLowerCase() || '';
    const records = productSheetRecords || [];
    const visible = records.filter(record => {
        const name = normalizeText(getSheetField(record, ['product name', 'name', 'title'], productSheetHeaders));
        const id = normalizeText(getSheetField(record, ['product id', 'product_id', 'id', 'sku', 'barcode', 'code', 'product code'], productSheetHeaders));
        const pack = normalizeText(getSheetField(record, ['pack size', 'packsize', 'size'], productSheetHeaders));
        return !query || name.includes(query) || id.includes(query) || pack.includes(query);
    });
    if (!visible.length) {
        productListBody.innerHTML = '<tr><td colspan="6">No products found.</td></tr>';
        return;
    }
    const isRetailer = ['retailer', 'retailers'].includes((currentUser?.category || currentUser?.role || '').toString().trim().toLowerCase());
        productListBody.innerHTML = visible.map(record => {
        const productId = getSheetField(record, ['product id', 'product_id', 'id', 'sku', 'barcode', 'code', 'product code'], productSheetHeaders) || '-';
        const productName = getSheetField(record, ['product name', 'name', 'title'], productSheetHeaders) || '-';
        const packSize = getSheetField(record, ['pack size', 'packsize', 'size'], productSheetHeaders) || '-';
        const retailerPrice = parseSheetNumber(getSheetField(record, ['retailer price', 'retailer_price', 'retailer', 'retail price'], productSheetHeaders));
        const mechanicPrice = parseSheetNumber(getSheetField(record, ['mechanic price', 'mechanic_price', 'mechanic'], productSheetHeaders));
        const retailerPoints = parseSheetNumber(getSheetField(record, ['retailer points', 'retailer_points', 'retailer points'], productSheetHeaders));
        const mechanicPoints = parseSheetNumber(getSheetField(record, ['mechanic points', 'mechanic_points', 'mechanic points'], productSheetHeaders));
        const status = getSheetField(record, ['status', 'product status'], productSheetHeaders) || 'Active';
                return `
                    <tr>
                        <td>${escapeHtml(productId)}</td>
                        <td>${escapeHtml(productName)}</td>
                        <td>${escapeHtml(packSize)}</td>
                        <td>₹${(isRetailer ? retailerPrice : mechanicPrice).toFixed(2)}</td>
                        <td>${isRetailer ? retailerPoints : mechanicPoints}</td>
                        <td>${escapeHtml(status)} <button type="button" class="generate-qr-btn" data-pid="${escapeHtml(productId)}" data-pname="${escapeHtml(productName)}">QR</button></td>
                    </tr>`;
    }).join('');

        // Attach click handler to generate QR images (one-time)
        if (!productListBody._qrListenerAttached) {
                productListBody.addEventListener('click', (ev) => {
                        const btn = ev.target.closest && ev.target.closest('.generate-qr-btn');
                        if (!btn) return;
                        const pid = btn.getAttribute('data-pid') || '';
                        const pname = btn.getAttribute('data-pname') || '';
                        const data = generateProductQrData(pid, pname);
                        const url = generateProductQrImageUrl(data);
                        // open QR image in new tab for download/printing
                        window.open(url, '_blank');
                });
                productListBody._qrListenerAttached = true;
        }
}

function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c] || ''); }

const handleProductSearch = debounce(() => { renderProductCatalog(); }, 250);

function setRetailerMechanicLabels() {
    const isRetailer = ['retailer', 'retailers'].includes((currentUser?.category || currentUser?.role || '').toString().trim().toLowerCase());
    if (priceHeader) {
        priceHeader.textContent = isRetailer ? 'Retailer Price (₹)' : 'Mechanic Price (₹)';
    }
    if (pointsHeader) {
        pointsHeader.textContent = isRetailer ? 'Retailer Points' : 'Mechanic Points';
    }
}

function renderPurchaseHistory() {
    if (!purchaseHistoryBody) return;
    const filteredRequests = purchaseRequests.filter(matchesCurrentUserRequest);
    if (!filteredRequests.length) {
        purchaseHistoryBody.innerHTML = '<tr><td colspan="8">No purchase history available.</td></tr>';
        return;
    }
    purchaseHistoryBody.innerHTML = filteredRequests.map(request => {
        const remark = request.remark || '-';
        const remarkCell = remark !== '-' ? `<strong>${remark}</strong>` : remark;
        return `
            <tr>
                <td>${escapeHtml(request.requestId || '')}</td>
                <td>${escapeHtml(request.submitterName || request.submitterEmail || request.submitterMobile || 'Customer')}</td>
                <td>${escapeHtml(request.productName || request.productId || 'Unknown')}</td>
                <td>${escapeHtml(request.packSize || '-')}</td>
                <td>${request.quantity}</td>
                <td>₹${request.amount.toFixed ? request.amount.toFixed(2) : request.amount}</td>
                <td>${escapeHtml(request.status)}</td>
                <td>${remarkCell}</td>
            </tr>`;
    }).join('');
}

if (productSearchInput) {
    productSearchInput.addEventListener('input', handleProductSearch);
}

function initializeRetailerMechanicDashboard(user) {
    renderProfile(user);
    renderNotifications();
    setRetailerMechanicLabels();
    renderProductCatalog();
    renderPurchaseHistory();
}

function showDashboard(user) {
    if (!user) {
        clearSession();
        showLoginUI();
        return;
    }
    currentUser = user;
    if (isOwner(user)) {
        // Validate with server before showing owner portal
        const token = getSessionToken();
        if (token && API_URL) {
            validateSessionWithServer(token).then(valid => {
                if (valid && valid.user && valid.isOwner) {
                    showOwnerDashboard(valid.user);
                } else {
                    showMessage('Unauthorized Access', 'error');
                    clearSession();
                    showLoginUI();
                }
            }).catch(() => {
                showMessage('Unauthorized Access', 'error');
                clearSession();
                showLoginUI();
            });
        } else {
            showMessage('Unauthorized Access', 'error');
            clearSession();
            showLoginUI();
        }
        return;
    }
    if (!dashboard) return;
    hideLoginUI();
    if (ownerDashboard) {
        ownerDashboard.style.display = 'none';
    }
    dashboard.style.display = 'block';
    updateDistributorDashboardVisibility(user);
    customerNameSpan.textContent = user?.name || user?.email || user?.mobile || 'Customer';
    pointsBalance.textContent = getDashboardPoints(user);
    renderActivity(getDashboardActivity(user));
    loadPurchaseRequests();
    loadPrices();
    startPriceSync();
    renderProductCatalog();
    renderProfile(user);
    renderNotifications();
    setRetailerMechanicLabels();
    clearPurchaseForm();
}

function validateSessionWithServer(token) {
    const prefix = STORAGE_KEYS.purchaseRequestsPrefix || 'purchase_requests';
    return `${prefix}_all`;
}

function getPurchaseStorageKey() {
    const userKey = normalizeText(currentUser?.email || currentUser?.mobile || currentUser?.name || 'guest');
    const prefix = STORAGE_KEYS.purchaseRequestsPrefix || 'purchase_requests';
    return `${prefix}_${userKey}`;
}

function matchesCurrentUserRequest(request) {
    if (!currentUser || !request) return false;
    const userEmail = normalizeText(currentUser.email || '');
    const userMobile = normalizeMobile(currentUser.mobile || '');
    const requestEmail = normalizeText(request.submitterEmail || '');
    const requestMobile = normalizeMobile(request.submitterMobile || '');
    const requestName = normalizeText(request.submitterName || '');
    const userName = normalizeText(currentUser.name || '');
    return (userEmail && userEmail === requestEmail) || (userMobile && userMobile === requestMobile) || (userName && userName === requestName);
}

function loadPurchaseRequests() {
    try {
        purchaseRequests = JSON.parse(localStorage.getItem(getGlobalPurchaseStorageKey())) || [];
    } catch (error) {
        purchaseRequests = [];
    }

    if (isOwner(currentUser)) {
        // delegate to owner module
        import('./owner.js').then(m => {
            if (m && typeof m.renderOwnerPendingRequests === 'function') m.renderOwnerPendingRequests();
        }).catch(err => console.warn('Could not render owner pending requests:', err));
    } else {
        renderPurchaseHistory();
    }
}

function savePurchaseRequests() {
    localStorage.setItem(getGlobalPurchaseStorageKey(), JSON.stringify(purchaseRequests));
}

function renderPurchaseHistory() {
    if (!purchaseHistoryBody) return;
    const filteredRequests = purchaseRequests.filter(matchesCurrentUserRequest);
    purchaseHistoryBody.innerHTML = filteredRequests.map(request => {
        const remark = request.remark || '-';
        const remarkCell = remark !== '-' ? `<strong>${remark}</strong>` : remark;
        return `
            <tr>
                <td>${request.productName || request.productId || 'Unknown'}</td>
                <td>${request.packSize || '-'}</td>
                <td>${request.quantity}</td>
                <td>${request.amount.toFixed ? request.amount.toFixed(2) : request.amount}</td>
                <td><strong>${request.status}</strong></td>
                <td>${remarkCell}</td>
            </tr>
        `;
    }).join('');
}



function clearPurchaseForm() {
    if (qrCodeInput) qrCodeInput.value = '';
    if (purchaseProductId) purchaseProductId.value = '';
    if (purchaseProductName) purchaseProductName.value = '';
    if (purchasePackSize) purchasePackSize.value = '';
    if (purchaseQuantity) purchaseQuantity.value = '1';
    if (purchaseStatusMessage) {
        purchaseStatusMessage.textContent = '';
        purchaseStatusMessage.className = 'message';
    }
    stopQrScan();
    // allow scanning same QR again after the form is cleared
    scannedQrSet.clear();
}

// Pricing Functions
function savePrices() {
    localStorage.setItem('productPrices', JSON.stringify(productPrices));
}

function loadPrices() {
    const saved = localStorage.getItem('productPrices');
    productPrices = saved ? JSON.parse(saved) : [];
}

function addProductPrice(productId, productName, packSize, retailerPrice, mechanicPrice) {
    const priceId = `price_${Date.now()}`;
    const price = {
        id: priceId,
        productId,
        productName,
        packSize,
        retailerPrice: parseFloat(retailerPrice),
        mechanicPrice: parseFloat(mechanicPrice),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Admin'
    };
    productPrices.unshift(price);
    savePrices();
    logPriceUpdate(price);
    renderPricingTable();
    displayPricingMessage('Product price added successfully!', 'success');
}

function renderPricingTable() {
    if (!pricingTableBody) return;
    
    pricingTableBody.innerHTML = productPrices.map(price => {
        return `
            <tr>
                <td>${price.productId}</td>
                <td>${price.productName}</td>
                <td>${price.packSize}</td>
                <td>₹${price.retailerPrice.toFixed(2)}</td>
                <td>₹${price.mechanicPrice.toFixed(2)}</td>
                <td>Active</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-secondary delete-price-btn" data-price-id="${price.id}">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Add delete listeners
    pricingTableBody.querySelectorAll('.delete-price-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const priceId = btn.getAttribute('data-price-id');
            deletePrice(priceId);
        });
    });
}

function deletePrice(priceId) {
    if (confirm('Are you sure you want to delete this price?')) {
        productPrices = productPrices.filter(p => p.id !== priceId);
        savePrices();
        renderPricingTable();
        displayPricingMessage('Price deleted successfully!', 'success');
    }
}

function displayPricingMessage(text, type) {
    if (!pricingMessage) return;
    pricingMessage.textContent = text;
    pricingMessage.className = 'message ' + type;
    setTimeout(() => {
        pricingMessage.textContent = '';
        pricingMessage.className = 'message';
    }, 3000);
}

function getRetailerPrice(productId, packSize) {
    const price = productPrices.find(p => p.productId === productId && p.packSize === packSize);
    return price ? price.retailerPrice : null;
}

function getMechanicPrice(productId, packSize) {
    const price = productPrices.find(p => p.productId === productId && p.packSize === packSize);
    return price ? price.mechanicPrice : null;
}

async function logPriceUpdate(price) {
    if (!price) return;

    const params = new URLSearchParams({
        type: 'price_update',
        sheetName: WORKSPACE_SHEET_NAMES.sales,
        priceId: price.id || '',
        productId: price.productId || '',
        productName: price.productName || '',
        packSize: price.packSize || '',
        retailerPrice: price.retailerPrice || '',
        mechanicPrice: price.mechanicPrice || '',
        createdBy: price.createdBy || '',
        createdAt: price.createdAt || new Date().toISOString()
    });

    const sheetUrl = SHEET_PURCHASE_URL;
    if (!sheetUrl) {
        console.warn('No sheetPurchaseUrl configured; price update not sent to Google Sheet.');
        return;
    }

    const url = `${sheetUrl}?${params.toString()}`;
    try {
        await fetch(url, { method: 'GET' });
        console.log('Price update sent to Google Sheet.');
    } catch (error) {
        console.error('Failed to send price update to Google Sheet:', error);
    }
}


// Price Syncing Functions
async function fetchPricingSheetData() {
    try {
        const { headers, records } = await fetchSheetData('pricing', WORKSPACE_SHEET_NAMES.pricing);
        pricingSheetHeaders = headers || [];
        pricingSheetRecords = records || [];
        console.log('Pricing sheet data fetched:', pricingSheetRecords.length, 'records');
        return true;
    } catch (error) {
        console.error('Error fetching pricing sheet:', error);
        return false;
    }
}

function buildPriceFromSheet(record) {
    if (!record) return null;
    return {
        productId: getSheetField(record, ['product id', 'productid', 'id', 'sku', 'product code'], pricingSheetHeaders) || '',
        productName: getSheetField(record, ['product name', 'productname', 'name', 'title'], pricingSheetHeaders) || '',
        packSize: getSheetField(record, ['pack size', 'packsize', 'size'], pricingSheetHeaders) || '',
        retailerPrice: parseFloat(getSheetField(record, ['retailer price', 'retailer_price', 'retailer', 'retail price'], pricingSheetHeaders)) || 0,
        mechanicPrice: parseFloat(getSheetField(record, ['mechanic price', 'mechanic_price', 'mechanic'], pricingSheetHeaders)) || 0
    };
}

function syncPricesFromSheet() {
    if (!pricingSheetRecords || pricingSheetRecords.length === 0) {
        console.log('No pricing sheet records to sync.');
        return;
    }

    let updatedCount = 0;

    pricingSheetRecords.forEach(record => {
        const sheetPrice = buildPriceFromSheet(record);
        if (!sheetPrice.productId || !sheetPrice.productName) return;

        const localPrice = productPrices.find(p => 
            normalizeText(p.productId) === normalizeText(sheetPrice.productId) &&
            normalizeText(p.packSize) === normalizeText(sheetPrice.packSize)
        );

        if (!localPrice) {
            // New price from sheet
            const newPrice = {
                id: `price_${Date.now()}_sync`,
                productId: sheetPrice.productId,
                productName: sheetPrice.productName,
                packSize: sheetPrice.packSize,
                retailerPrice: sheetPrice.retailerPrice,
                mechanicPrice: sheetPrice.mechanicPrice,
                createdAt: new Date().toISOString(),
                createdBy: 'Sheet Sync'
            };
            productPrices.unshift(newPrice);
            updatedCount++;
        } else if (
            localPrice.retailerPrice !== sheetPrice.retailerPrice ||
            localPrice.mechanicPrice !== sheetPrice.mechanicPrice
        ) {
            // Update existing price
            localPrice.retailerPrice = sheetPrice.retailerPrice;
            localPrice.mechanicPrice = sheetPrice.mechanicPrice;
            localPrice.updatedAt = new Date().toISOString();
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        savePrices();
        renderPricingTable();
        console.log(`Synced ${updatedCount} prices from Google Sheet.`);
    }
}

function startPriceSync() {
    // Fetch pricing sheet data immediately
    fetchPricingSheetData().then(() => {
        syncPricesFromSheet();
    });

    // Set up automatic sync every 5 minutes
    if (priceSyncInterval) {
        clearInterval(priceSyncInterval);
    }

    priceSyncInterval = setInterval(async () => {
        if (isOwner(currentUser)) {
            // Owners can see the sync happen
            console.log('Auto-syncing prices from Google Sheet...');
        }
        const fetched = await fetchPricingSheetData();
        if (fetched) {
            syncPricesFromSheet();
        }
    }, 5 * 60 * 1000); // 5 minutes
}

function stopPriceSync() {
    if (priceSyncInterval) {
        clearInterval(priceSyncInterval);
        priceSyncInterval = null;
    }
}

// CSV Upload Functions
function parseCSVFile(fileContent) {
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const prices = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',').map(part => part.trim());
        
        if (parts.length < 5) {
            continue; // Skip invalid lines
        }

        const productId = parts[0];
        const productName = parts[1];
        const packSize = parts[2];
        const retailerPrice = parseFloat(parts[3]);
        const mechanicPrice = parseFloat(parts[4]);

        // Validate data
        if (!productId || !productName || !packSize || isNaN(retailerPrice) || isNaN(mechanicPrice)) {
            continue; // Skip invalid rows
        }

        if (retailerPrice < 0 || mechanicPrice < 0) {
            continue; // Skip rows with negative prices
        }

        prices.push({
            productId,
            productName,
            packSize,
            retailerPrice,
            mechanicPrice
        });
    }

    return prices;
}

function parseExcelFile(fileContent) {
    try {
        const workbook = XLSX.read(fileContent, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const prices = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            if (!row || row.length < 5) {
                continue; // Skip invalid rows
            }

            const productId = String(row[0] || '').trim();
            const productName = String(row[1] || '').trim();
            const packSize = String(row[2] || '').trim();
            const retailerPrice = parseFloat(row[3]);
            const mechanicPrice = parseFloat(row[4]);

            // Validate data
            if (!productId || !productName || !packSize || isNaN(retailerPrice) || isNaN(mechanicPrice)) {
                continue; // Skip invalid rows
            }

            if (retailerPrice < 0 || mechanicPrice < 0) {
                continue; // Skip rows with negative prices
            }

            prices.push({
                productId,
                productName,
                packSize,
                retailerPrice,
                mechanicPrice
            });
        }

        return prices;
    } catch (error) {
        console.error('Error parsing Excel file:', error);
        throw new Error('Invalid Excel file format');
    }
}

function displayUploadPreview(prices) {
    if (!uploadPreviewBody) return;
    
    uploadPreviewBody.innerHTML = prices.map(price => {
        return `
            <tr>
                <td>${price.productId}</td>
                <td>${price.productName}</td>
                <td>${price.packSize}</td>
                <td>₹${price.retailerPrice.toFixed(2)}</td>
                <td>₹${price.mechanicPrice.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    uploadPreview.style.display = 'block';
    submitUploadPriceBtn.disabled = prices.length === 0;
}

//     savePrices();
//     renderPricingTable();
//     displayPricingMessage(`Successfully uploaded ${addedCount} product prices!`, 'success');
//     priceListToUpload = [];
//     priceListFile.value = '';
//     uploadPreview.style.display = 'none';
//     uploadPriceModal.style.display = 'none';
// }

async function uploadBulkPrices(prices) {
    let addedCount = 0;
    const uploadPromises = [];

    // 1. Create all price objects and queue their network requests simultaneously
    for (const price of prices) {
        const priceId = `price_${Date.now()}_${addedCount}`;
        const priceObj = {
            id: priceId,
            productId: price.productId,
            productName: price.productName,
            packSize: price.packSize,
            retailerPrice: parseFloat(price.retailerPrice),
            mechanicPrice: parseFloat(price.mechanicPrice),
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'Admin'
        };
        
        productPrices.unshift(priceObj);
        
        // Push the promise into an array instead of awaiting it individually
        uploadPromises.push(logPriceUpdate(priceObj));
        addedCount++;
    }

    // 2. Save local data and refresh the UI instantly
    savePrices();
    renderPricingTable();
    
    // 3. Close the upload modal immediately so the user sees a response
    priceListToUpload = [];
    if (priceListFile) priceListFile.value = '';
    if (uploadPreview) uploadPreview.style.display = 'none';
    if (uploadPriceModal) uploadPriceModal.style.display = 'none';

    alert(`Successfully processed ${addedCount} product prices! Syncing with Google Sheets in background.`);

    // 4. Let the network requests finish in the background together
    try {
        await Promise.all(uploadPromises);
        console.log("All background Google Sheet price updates finished.");
    } catch (err) {
        console.error("Some background uploads failed:", err);
    }
}











function displayPurchaseMessage(text, type) {
    if (!purchaseStatusMessage) return;
    purchaseStatusMessage.textContent = text;
    purchaseStatusMessage.className = 'message ' + type;
}

function parseProductQrData(raw) {
    const trimmed = raw?.toString().trim();
    if (!trimmed) return null;

    try {
        const data = JSON.parse(trimmed);
        return {
            productId: data.productId || data.id || data.code || '',
            productName: data.name || data.product || data.title || '',
            packSize: data.packSize || data.size || '',
            quantity: data.quantity || data.qty || 1,
            amount: data.amount || data.price || data.total || 0
        };
    } catch (error) {
        const parts = trimmed.split('|').map(part => part.trim());
        if (parts.length >= 4) {
            return {
                productId: parts[0],
                productName: parts[1],
                packSize: parts[2],
                quantity: parseInt(parts[3], 10) || 1,
                amount: 0
            };
        }
        if (parts.length >= 3) {
            return {
                productId: parts[0],
                productName: parts[1],
                packSize: parts[2],
                quantity: 1,
                amount: 0
            };
        }
        return {
            productId: trimmed,
            productName: trimmed,
            packSize: '',
            quantity: 1,
            amount: 0
        };
    }
}

function fillProductForm(productData) {
    if (!productData) return;
    if (qrCodeInput) qrCodeInput.value = qrCodeInput.value || productData.raw || '';
    if (purchaseProductId) purchaseProductId.value = productData.productId || '';
    if (purchaseProductName) purchaseProductName.value = productData.productName || '';
    if (purchasePackSize)
    purchasePackSize.value = productData.packSize || '';
    if (purchaseQuantity) purchaseQuantity.value = productData.quantity || 1;
}

function generateProductQrData(productId, productName) {
    const payload = { productId: productId || '', name: productName || '' };
    return JSON.stringify(payload);
}

function generateProductQrImageUrl(data) {
    // Uses Google Chart API to render a QR image for the given string data
    const encoded = encodeURIComponent(data);
    return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encoded}&chld=L|1`;
}

function buildProductFromSheet(record) {
    if (!record) return null;
    return {
        productId: getSheetField(record, ['product id', 'product_id', 'id', 'sku', 'barcode', 'code', 'product code'], productSheetHeaders) || '',
        productName: getSheetField(record, ['product name', 'name', 'title', 'product'], productSheetHeaders) || '',
        packSize: getSheetField(record,['pack size', 'packsize', 'size'],productSheetHeaders) || '',
        quantity: parseInt(getSheetField(record, ['quantity', 'qty', 'quantity ordered'], productSheetHeaders), 10) || 1,
        amount: parseFloat(getSheetField(record, ['amount', 'price', 'cost', 'rate', 'total', 'purchase amount'], productSheetHeaders)) || 0
    };
}

function queryProductSheet(rawValue, parsed) {
    if (!productSheetRecords.length) return null;
    const lookupValues = [normalizeText(rawValue), normalizeText(parsed?.productId), normalizeText(parsed?.productName)].filter(Boolean);
    const searchHeaders = ['product id', 'product_id', 'id', 'sku', 'barcode', 'code', 'product code', 'name', 'product name', 'title'];

    return productSheetRecords.find(record => {
        return searchHeaders.some(header => {
            const cellValue = normalizeText(record[header] || '');
            return cellValue && lookupValues.some(value => value === cellValue || cellValue.includes(value) || value.includes(cellValue));
        });
    });
}

function handleQrCode(raw) {
    const trimmedRaw = raw?.toString().trim();
    if (!trimmedRaw) {
        displayPurchaseMessage('Empty QR code data.', 'error');
        return;
    }

    // Prevent duplicate scanning within the current form/session
    if (scannedQrSet.has(trimmedRaw)) {
        displayPurchaseMessage('This QR code was already scanned. Duplicate rejected.', 'error');
        return;
    }

    scannedQrSet.add(trimmedRaw);

    const parsed = parseProductQrData(trimmedRaw);
    const sheetRecord = queryProductSheet(trimmedRaw, parsed);
    const productData = sheetRecord ? buildProductFromSheet(sheetRecord) : parsed;

    if (!productData) {
        displayPurchaseMessage('Unable to parse the QR code. Please enter the product code manually.', 'error');
        return;
    }

    if (qrCodeInput) qrCodeInput.value = trimmedRaw;
    fillProductForm(productData);

    if (sheetRecord) {
        displayPurchaseMessage('Product details autofilled from Google Sheet catalog. You may edit them before submitting.', 'success');
    } else {
        displayPurchaseMessage('QR not found in the catalog. Please complete or correct the product details manually.', 'warning');
    }
}

function stopQrScan() {
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    if (qrScanner) {
        qrScanner.classList.add('hidden');
    }
    if (qrVideo) {
        qrVideo.srcObject = null;
    }
    barcodeDetector = null;
}

// Handle image file uploads containing QR codes (uses jsQR)
if (uploadQrInput) {
    uploadQrInput.addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    await ensureJsQR();
                    const code = window.jsQR ? jsQR(imageData.data, imageData.width, imageData.height) : null;
            if (code && code.data) {
                handleQrCode(code.data);
            } else {
                displayPurchaseMessage('No valid QR code found in the uploaded image.', 'error');
            }
        } catch (err) {
            console.error('Failed to decode uploaded QR image', err);
            displayPurchaseMessage('Could not process uploaded image. Try a clear photo of the QR code.', 'error');
        } finally {
            // Reset input so the same file can be re-uploaded
            uploadQrInput.value = '';
        }
    });
}

async function startQrScan() {
    if (!window.BarcodeDetector || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        displayPurchaseMessage('QR scanning is not supported in this browser. Use manual entry instead.', 'error');
        return;
    }

    try {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (!formats.includes('qr_code')) {
            displayPurchaseMessage('QR code scanning is not available. Use manual entry instead.', 'error');
            return;
        }

        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (qrVideo) {
            qrVideo.srcObject = qrStream;
            qrVideo.play();
        }
        if (qrScanner) {
            qrScanner.classList.remove('hidden');
        }

        const scanFrame = async () => {
            if (!barcodeDetector || !qrVideo || qrVideo.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
                requestAnimationFrame(scanFrame);
                return;
            }
            try {
                const barcodes = await barcodeDetector.detect(qrVideo);
                if (barcodes.length) {
                    const rawValue = barcodes[0]?.rawValue || '';
                    if (rawValue) {
                        stopQrScan();
                        handleQrCode(rawValue);
                        return;
                    }
                }
            } catch (error) {
                console.error('QR scan error', error);
            }
            requestAnimationFrame(scanFrame);
        };
        scanFrame();
        displayPurchaseMessage('Scanning QR code... point the camera at the product QR.', 'success');
    } catch (error) {
        console.error('QR scan setup failed', error);
        // More specific camera permission/error messages
        if (error && (error.name === 'NotAllowedError' || /permission/i.test(error.message || ''))) {
            displayPurchaseMessage('Camera access was denied. Please allow camera permission to scan QR codes.', 'error');
        } else if (error && (error.name === 'NotFoundError' || /not found/i.test(error.message || ''))) {
            displayPurchaseMessage('No camera device was found on this device.', 'error');
        } else {
            displayPurchaseMessage('Unable to access camera for QR scanning. Use manual entry instead.', 'error');
        }
    }
}

function submitPurchaseRequest() {
    const productId = purchaseProductId?.value.trim();
    const productName = purchaseProductName?.value.trim();
    const packSize = purchasePackSize?.value.trim();
    const quantity = parseInt(purchaseQuantity?.value, 10) || 1;

    if (!productName && !productId) {
        displayPurchaseMessage('Please scan a QR code or enter product details before requesting approval.', 'error');
        return;
    }

    const request = {
        requestId: `req_${Date.now()}`,
        productId: productId || `prod_${Date.now()}`,
        productName: productName || 'Product',
        quantity,
        packSize,
        amount: 0,
        status: 'Pending Distributor Approval',
        submittedAt: new Date().toISOString(),
        submitterEmail: currentUser?.email || '',
        submitterMobile: currentUser?.mobile || '',
        submitterName: currentUser?.name || ''
    };

    purchaseRequests.unshift(request);
    savePurchaseRequests();
    logPurchaseRequest(request);
    renderPurchaseHistory();
    displayPurchaseMessage('Purchase request submitted. Distributor approval is required to add points.', 'success');
    clearPurchaseForm();
}

if (scanQrBtn) {
    scanQrBtn.addEventListener('click', startQrScan);
}

if (manualQrBtn) {
    manualQrBtn.addEventListener('click', () => {
        const raw = window.prompt('Paste the product QR code text here:');
        if (raw) {
            handleQrCode(raw);
        }
    });
}

if (stopScanBtn) {
    stopScanBtn.addEventListener('click', stopQrScan);
}

if (submitPurchaseBtn) {
    submitPurchaseBtn.addEventListener('click', submitPurchaseRequest);
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        stopPriceSync();
        if (dashboard) {
            dashboard.style.display = 'none';
        }
        clearSession();
        showLoginUI();
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        messageDiv.textContent = '';
        if (timerInterval) {
            clearInterval(timerInterval);
            resendBtn.disabled = true;
            timerSpan.textContent = String(DEFAULT_OTP_TIMEOUT);
        }
    });
}

if (ownerLogoutBtn) {
    ownerLogoutBtn.addEventListener('click', () => {
        stopPriceSync();
        if (ownerDashboard) {
            ownerDashboard.style.display = 'none';
        }
        clearSession();
        showLoginUI();
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        messageDiv.textContent = '';
        if (timerInterval) {
            clearInterval(timerInterval);
            resendBtn.disabled = true;
            timerSpan.textContent = String(DEFAULT_OTP_TIMEOUT);
        }
    });
}

if (redeemBtn) {
    redeemBtn.addEventListener('click', () => {
        showMessage('Redeem request submitted! Your rewards will be processed shortly.', 'success');
        pointsBalance.textContent = Math.max(0, parseInt(pointsBalance.textContent, 10) - 50);
    });
}

if (exploreOffersBtn) {
    exploreOffersBtn.addEventListener('click', () => {
        showMessage('Opening offers... check the latest deals in the portal.', 'success');
    });
}

if (btnViewSales) {
    btnViewSales.addEventListener('click', () => {
        showMessage('Sales report loading... (demo)', 'success');
        setTimeout(() => {
            showMessage('Sales report ready: 15% increase from last month.', 'success');
        }, 800);
    });
}

// Remarks modal event listeners handled by owner module when initialized

// Pricing Modal Event Listeners
if (btnAddPrice) {
    btnAddPrice.addEventListener('click', () => {
        priceProductId.value = '';
        priceProductName.value = '';
        pricePackSize.value = '';
        priceRetailer.value = '';
        priceMechanic.value = '';
        priceModal.style.display = 'flex';
    });
}

if (closePriceModal) {
    closePriceModal.addEventListener('click', () => {
        priceModal.style.display = 'none';
    });
}

if (cancelPriceBtn) {
    cancelPriceBtn.addEventListener('click', () => {
        priceModal.style.display = 'none';
    });
}

if (submitPriceBtn) {
    submitPriceBtn.addEventListener('click', () => {
        const pId = priceProductId.value.trim();
        const pName = priceProductName.value.trim();
        const pSize = pricePackSize.value.trim();
        const pRetail = parseFloat(priceRetailer.value) || 0;
        const pMech = parseFloat(priceMechanic.value) || 0;

        if (!pId || !pName || !pSize || pRetail <= 0 || pMech <= 0) {
            displayPricingMessage('Please fill all fields with valid prices.', 'error');
            return;
        }

        addProductPrice(pId, pName, pSize, pRetail, pMech);
        priceModal.style.display = 'none';
    });
}

// Upload Price List Event Listeners
if (btnUploadPrices) {
    btnUploadPrices.addEventListener('click', () => {
        priceListFile.value = '';
        uploadPreview.style.display = 'none';
        uploadPreviewBody.innerHTML = '';
        submitUploadPriceBtn.disabled = true;
        uploadPriceModal.style.display = 'flex';
    });
}

if (closeUploadPriceModal) {
    closeUploadPriceModal.addEventListener('click', () => {
        uploadPriceModal.style.display = 'none';
    });
}

if (cancelUploadPriceBtn) {
    cancelUploadPriceBtn.addEventListener('click', () => {
        uploadPriceModal.style.display = 'none';
    });
}

if (priceListFile) {
    priceListFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isCSV = file.name.endsWith('.csv');
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        if (!isCSV && !isExcel) {
            displayPricingMessage('Please upload a valid CSV or Excel file (.csv, .xlsx, .xls).', 'error');
            priceListFile.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let priceData;

                if (isCSV) {
                    const csvContent = event.target.result;
                    priceData = parseCSVFile(csvContent);
                } else if (isExcel) {
                    const excelContent = event.target.result;
                    // Lazy-load XLSX before parsing large files
                    await ensureXLSX();
                    priceData = parseExcelFile(excelContent);
                }

                priceListToUpload = priceData;

                if (priceListToUpload.length === 0) {
                    displayPricingMessage('No valid prices found in file.', 'error');
                    priceListFile.value = '';
                    return;
                }

                displayUploadPreview(priceListToUpload);
                displayPricingMessage(`Ready to upload ${priceListToUpload.length} prices`, 'success');
            } catch (error) {
                displayPricingMessage('Error parsing file: ' + error.message, 'error');
                priceListFile.value = '';
            }
        };

        if (isCSV) {
            reader.readAsText(file);
        } else if (isExcel) {
            reader.readAsArrayBuffer(file);
        }
    });
}

if (submitUploadPriceBtn) {
    submitUploadPriceBtn.addEventListener('click', async () => {
        if (priceListToUpload.length === 0) {
            displayPricingMessage('No prices to upload.', 'error');
            return;
        }

        submitUploadPriceBtn.disabled = true;
        await uploadBulkPrices(priceListToUpload);
        submitUploadPriceBtn.disabled = false;
    });
}

// Close modal when clicking outside
if (uploadPriceModal) {
    uploadPriceModal.addEventListener('click', (e) => {
        if (e.target === uploadPriceModal) {
            uploadPriceModal.style.display = 'none';
        }
    });
}

// Close modal when clicking outside
if (remarksModal) {
    remarksModal.addEventListener('click', (e) => {
        if (e.target === remarksModal) {
            import('./owner.js').then(m => { if (m && typeof m.closeRemarksModalFn === 'function') m.closeRemarksModalFn(); }).catch(() => {});
        }
    });
}

if (priceModal) {
    priceModal.addEventListener('click', (e) => {
        if (e.target === priceModal) {
            priceModal.style.display = 'none';
        }
    });
}

// Show message
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
}



//         const img = new Image();

//         img.onload = async () => {

//             const barcodeDetector =
//                 new BarcodeDetector({formats:["qr_code"]});

//             const codes = await barcodeDetector.detect(img);

//             if(codes.length){

//                 handleQrCode(codes[0].rawValue);

//             }else{

//                 displayPurchaseMessage(
//                     "No QR code found in image.",
//                     "error"
//                 );

//             }

//         };
//         img.src = URL.createObjectURL(file);
//     });
// }


if (uploadQrInput) {

    uploadQrInput.addEventListener("change", function (e) {

        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (event) {

            const img = new Image();

            img.onload = function () {

                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                await ensureJsQR();
                const code = jsQR(
                    imageData.data,
                    imageData.width,
                    imageData.height
                );

                if (code) {

                    console.log("QR Data:", code.data);

                    handleQrCode(code.data);

                } else {

                    displayPurchaseMessage(
                        "No QR code found in image.",
                        "error"
                    );

                }

            };

            img.src = event.target.result;

        };

        reader.readAsDataURL(file);

    });

}


// Add these to your DOM selector initializations at the top:
const tabViewPrices = document.getElementById("tab-view-prices");
const viewPricesView = document.getElementById("viewPricesView");
const searchPriceInput = document.getElementById("searchPriceInput");

// In your view routing/switching function logic, ensure it handles hiding/showing:
function showView(viewId) {
    // Hide all view panels
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(s => s.style.display = 'none');
    
    // Deactivate all tab selections
    const tabs = document.querySelectorAll('.nav-btn');
    tabs.forEach(t => t.classList.remove('active'));

    // Show selected view panel
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.style.display = 'block';
}

// Attach the click listener for the tab navigation
if (tabViewPrices) {
    tabViewPrices.addEventListener("click", () => {
        tabViewPrices.classList.add('active');
        showView("viewPricesView");
        renderPublicPricesTable(); // Load the table rows
    });
}


// Renders the visible read-only price catalog for general users
function renderPublicPricesTable(filterText = "") {
    const tableBody = document.getElementById("publicPriceTableBody");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    
    // Sanitize search keywords
    const searchKeyword = filterText.toLowerCase().trim();

    // Loop through your memory array or spreadsheet dataset (e.g., productPrices)
    // If your application uses a different array name like "productCatalog", change it here
    const pricingData = typeof productPrices !== 'undefined' ? productPrices : [];

    pricingData.forEach(item => {
        const matchesId = item.productId?.toLowerCase().includes(searchKeyword);
        const matchesName = item.productName?.toLowerCase().includes(searchKeyword);

        // Filter criteria evaluation
        if (searchKeyword && !matchesId && !matchesName) return;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(item.productId || '')}</strong></td>
            <td>${escapeHtml(item.productName || '')}</td>
            <td><span class="badge badge-info">${escapeHtml(item.packSize || '')}</span></td>
            <td>₹${parseFloat(item.retailerPrice || 0).toFixed(2)}</td>
            <td>₹${parseFloat(item.mechanicPrice || 0).toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);
    });

    if (tableBody.children.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">No matching products found.</td></tr>`;
    }
}

// Live search configuration
if (searchPriceInput) {
    searchPriceInput.addEventListener("input", (e) => {
        renderPublicPricesTable(e.target.value);
    });
}
