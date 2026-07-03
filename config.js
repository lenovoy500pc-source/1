// Central configuration file for URLs and workspace sheet names
export const API_URL = "https://script.google.com/macros/s/AKfycbyQPkFC3GN3s72Vp_ByOVl2kCmT7xMWk6BIFDuZzubOCVDSdizyaAn4vPL4we63QCCkBw/exec";

export const WORKSPACE_SHEET_NAMES = {
    registrations: 'Registrations',
    metrics: 'Login Ids & Passwords',
    loginSheet: 'Login datasheet',
    product: 'Products list',
    sales: 'Sales Approval',
    pricing: 'Prices',
    users: 'Users'
};

export const API_ACTIONS = {
    users: 'users',
    metrics: 'metrics',
    products: 'products',
    authenticate: 'authenticate',
    register: 'register',
    validate: 'validate'
};

export const API_ENDPOINTS = {
    points: 'points'
};

export const DEFAULT_OTP_TIMEOUT = 60;
export const STORAGE_KEYS = {
    users: 'loyalty_users_v1',
    productPrices: 'productPrices',
    purchaseRequestsPrefix: 'purchase_requests'
};

export const SESSION_STORAGE_KEY = 'loyalty_session_v1';

// Apps Script endpoints and other external URLs (set to empty strings to avoid accidental leaks)
// External sheet/webhook URLs — leave empty in source to avoid accidental exposure.
export const SHEET_LOGIN_EVENT_URL = '';
export const SHEET_PURCHASE_URL = '';
export const SHEET_REGISTER_URL = '';
export const PRODUCT_SHEET_URL = '';
export const PRICING_SHEET_URL = '';

// Local API endpoint used by registration (if any)
export const LOCAL_API_URL = '';

// Export a safe default owner identifier (avoid including real secrets here)
// Default owner identifier (no password in source). Set securely during deployment.
export const OWNER_EMAIL = 'owner@vikasautomobiles.com';
export const OWNER_MOBILE = '9827003016';
export const OWNER_PASSWORD = '';

export default {
    API_URL,
    WORKSPACE_SHEET_NAMES,
    API_ACTIONS,
    API_ENDPOINTS,
    DEFAULT_OTP_TIMEOUT,
    STORAGE_KEYS,
    SHEET_LOGIN_EVENT_URL,
    SHEET_PURCHASE_URL,
    SHEET_REGISTER_URL,
    PRODUCT_SHEET_URL,
    PRICING_SHEET_URL,
    LOCAL_API_URL,
    OWNER_EMAIL,
    OWNER_MOBILE,
    OWNER_PASSWORD
};
