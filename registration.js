
document.addEventListener('DOMContentLoaded', () => {
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const loginForm = document.getElementById('loginForm');
    const otpForm = document.getElementById('otpForm');
    const registrationForm = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('message');
    const regCategorySelect = document.getElementById('regCategory');
    const firmNameGroup = document.getElementById('firmNameGroup');
    const regFirmNameInput = document.getElementById('regFirmName');

    // Using the local file-backed server for registration.
    // If you want to use Google Sheets instead, set this URL explicitly.
    const sheetRegisterUrl = config.SHEET_REGISTER_URL || '';
    const API_URL = config.API_URL || '';
    const API_ACTIONS = config.API_ACTIONS || { users: 'users' };
    const STORAGE_KEYS = config.STORAGE_KEYS || { users: 'loyalty_users_v1' };

    function setButtonLoading(button, isLoading, loadingLabel = 'Please wait...') {
        if (!button) return;
        if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
        button.disabled = isLoading;
        button.textContent = isLoading ? loadingLabel : button.dataset.originalLabel;
    }

    function validateEmail(email) {
        if (!email) return false;
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email.trim());
    }

    function validateMobile(mobile) {
        if (!mobile) return false;
        const digits = (mobile || '').toString().replace(/\D/g, '');
        return digits.length === 10;
    }

    function getLocalUsers() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.users);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    async function getServerUsers() {
        if (!API_URL) return [];
        try {
            const res = await fetch(`${API_URL}?action=${encodeURIComponent(API_ACTIONS.users)}`, { cache: 'no-store' });
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    async function isDuplicateRegistration(email, mobile) {
        const normEmail = (email || '').toString().trim().toLowerCase();
        const normMobile = (mobile || '').toString().replace(/\D/g, '');
        const local = getLocalUsers();
        const localDup = local.find(u => (u.email || '').toString().trim().toLowerCase() === normEmail || (u.mobile || '').toString().replace(/\D/g, '') === normMobile);
        if (localDup) return true;
        const server = await getServerUsers();
        const serverDup = server.find(u => (u.email || '').toString().trim().toLowerCase() === normEmail || (u.mobile || '').toString().replace(/\D/g, '') === normMobile);
        return Boolean(serverDup);
    }




    /*
      Google Apps Script endpoint example for saving registrations to a Google Sheet.
      1. Create a Google Sheet and note its Sheet ID.
      2. Open Extensions > Apps Script.
      3. Paste this code and deploy as a Web App.

      function doGet(e) {
        const params = e.parameter;
        const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getSheetByName('Sheet1');
        sheet.appendRow([
          new Date(),
          params.name || '',
          params.category || '',
          params.email || '',
          params.mobile || '',
          params.firmName || '',
          params.city || '',
          params.password || ''
        ]);
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, message: 'Saved' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Deploy as Web App and set access to "Anyone, even anonymous".
      // Then paste the /exec URL above.
    */

    if (!showRegisterBtn || !backToLoginBtn || !registrationForm || !regCategorySelect || !firmNameGroup || !regFirmNameInput) {
        console.error('Registration form elements missing');
        return;
    }

    // Always call the local Node.js API server on port 8000.
    // This avoids hitting the static page server on another port like 5501.
    const apiUrl = config.LOCAL_API_URL || '';

    // Show/hide firm name based on category
    regCategorySelect.addEventListener('change', () => {
        if (regCategorySelect.value === 'retailer') {
            firmNameGroup.style.display = 'block';
            regFirmNameInput.required = true;
        } else {
            firmNameGroup.style.display = 'none';
            regFirmNameInput.required = false;
            regFirmNameInput.value = '';
        }
    });

    // Show registration form
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openRegistrationForm();
    });

    // Back to login
    backToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'block';
        otpForm.style.display = 'none';
        registrationForm.style.display = 'none';
        registrationForm.reset();
        firmNameGroup.style.display = 'none';
        messageDiv.textContent = '';
    });

    // Handle registration form submission
    registrationForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = registrationForm.querySelector('button[type="submit"]');
        const name = document.getElementById('regName').value.trim();
        const category = regCategorySelect.value.trim();
        const mobileRaw = document.getElementById('regMobile').value.trim();
        const mobile = mobileRaw.replace(/\D/g, '');
        const email = document.getElementById('regEmail').value.trim();
        const firmName = regFirmNameInput.value.trim();
        const city = document.getElementById('regCity').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const confirmPassword = document.getElementById('regConfirmPassword').value.trim();

        // Basic validations
        if (!name) { showMessage('Please enter your full name', 'error'); return; }
        if (!category) { showMessage('Please select your category (Retailer/Mechanic)', 'error'); return; }
        if (!validateMobile(mobile)) { showMessage('Please enter a valid 10-digit mobile number', 'error'); return; }
        if (category === 'retailer' && !firmName) { showMessage('Firm name is required for retailers', 'error'); return; }
        if (email && !validateEmail(email)) { showMessage('Please enter a valid email address or leave it empty', 'error'); return; }
        if (password !== confirmPassword) { showMessage('Passwords do not match', 'error'); return; }
        if (password.length < 6) { showMessage('Password must be at least 6 characters', 'error'); return; }

        // Prevent duplicates
        setButtonLoading(submitBtn, true, 'Checking...');
        const isDuplicate = await isDuplicateRegistration(email, mobile);
        if (isDuplicate) {
            setButtonLoading(submitBtn, false);
            showMessage('An account with this email or mobile already exists. Try logging in or use a different contact.', 'error');
            return;
        }

        const payload = {
            name: name,
            category: category,
            email: email || '',
            mobile: mobile,
            firmName: firmName || '',
            city: city || '',
            password: password
        };

        try {
            setButtonLoading(submitBtn, true, 'Registering...');

            const localRegister = apiUrl
                ? fetch(apiUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                  })
                : Promise.resolve({ ok: true, status: 'skipped', text: async () => JSON.stringify({ message: 'Local registration skipped' }) });

            let sheetRegister = Promise.resolve({ status: 'skipped' });
            if (sheetRegisterUrl) {
                const params = new URLSearchParams(payload);
                const sheetUrl = `${sheetRegisterUrl}?${params.toString()}`;
                sheetRegister = fetch(sheetUrl, { method: 'GET', mode: 'no-cors' })
                    .then(() => ({ status: 'ok' }))
                    .catch(err => ({ status: 'failed', error: err }));
            }

            const [localResult, sheetResult] = await Promise.allSettled([localRegister, sheetRegister]);

            // Handle local result
            if (localResult.status !== 'fulfilled') {
                console.error('Registration request failed:', localResult.reason);
                setButtonLoading(submitBtn, false);
                showMessage('Error during registration. Please try again later.', 'error');
                return;
            }

            const response = localResult.value;
            let result = {};
            try {
                const text = await response.text();
                if (text) result = JSON.parse(text);
            } catch (err) {
                // ignore parse errors
            }

            if (!response.ok) {
                setButtonLoading(submitBtn, false);
                showMessage(result.message || `Registration failed (${response.status})`, 'error');
                return;
            }

            // If sheet logging failed, warn but consider registration successful
            const sheetFailed = sheetResult.status === 'fulfilled' && sheetResult.value?.status === 'failed';
            if (sheetFailed) {
                console.warn('Google Sheet registration failed:', sheetResult.value.error);
            }

            // Persist non-sensitive user info locally (do NOT store passwords)
            try {
                const localUsers = getLocalUsers();
                const safe = { name: payload.name, email: payload.email || '', mobile: payload.mobile || '', category: payload.category || '', firmName: payload.firmName || '', city: payload.city || '', registeredAt: new Date().toISOString() };
                localUsers.push(safe);
                localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(localUsers));
            } catch (err) {
                console.warn('Failed to persist local registration:', err);
            }

            // Reset and show login
            registrationForm.reset();
            firmNameGroup.style.display = 'none';
            setButtonLoading(submitBtn, false);
            if (sheetFailed) {
                showMessage('Registered locally but failed to log to sheet. You can login now.', 'warning');
            } else {
                showMessage(result.message || 'Registration successful! You can now login.', 'success');
            }
            // Switch back to login UI
            loginForm.style.display = 'block';
            otpForm.style.display = 'none';
            registrationForm.style.display = 'none';
        } catch (error) {
            console.error('Registration error:', error);
            setButtonLoading(submitBtn, false);
            showMessage('Error during registration. Please try again.', 'error');
        }
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
    }
});

// Example: after successful login 
/* function showDashboard(user) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registrationForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Display customer name
    document.getElementById('customerName').textContent = user.name;

    // Fetch points from backend (Google Sheet or API)
    fetch((config.API_URL || '') + (config.API_ENDPOINTS?.points || 'points') + '?customer=' + encodeURIComponent(user.mobile || ''))
      .then(res => res.json())
      .then(data => {
          document.getElementById('pointsBalance').textContent = data.points;
          renderActivity(data.activity);
      })
      .catch(err => console.error('Error fetching points:', err));
}

function renderActivity(activity) {
    const list = document.getElementById('activityList');
    list.innerHTML = '';
    activity.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
}

document.getElementById('redeemBtn').addEventListener('click', () => {
    alert('Redeem feature coming soon!');
});
*/


window.openRegistrationForm=function(){const loginForm=document.getElementById('loginForm');const otpForm=document.getElementById('otpForm');const registrationForm=document.getElementById('registrationForm');const messageDiv=document.getElementById('message');if(loginForm)loginForm.style.display='none';if(otpForm)otpForm.style.display='none';if(registrationForm)registrationForm.style.display='block';if(messageDiv)messageDiv.textContent='';};
