import './config.js';

const translations = {
    en: {
        title: 'Vikas Automobiles, Satna<br>(HPCL Lube Distributor)',
        greeting: 'Hello',
        login_title: 'Login',
        register_title: 'Create New Account',
        full_name: 'Full Name',
        category: 'Category',
        retailer_opt: 'Retailer',
        mechanic_opt: 'Mechanic',
        email: 'Email',
        mobile_number: 'Mobile Number',
        firm_name: 'Firm Name',
        city: 'City',
        password: 'Password',
        confirm_password: 'Confirm Password',
        send_otp: 'Send OTP',
        register_btn: 'Register',
        no_account: "Don't have an account?",
        register_here: 'Register here',
        back_to_login: 'Back to Login',
        enter_otp: 'Enter OTP sent to your registered email/phone',
        resend_in: 'Resend in',
        verify_otp: 'Verify OTP',
        resend_otp: 'Resend OTP',
        back: 'Back',
        email_phone: 'Email/Phone',
        view_prices: 'View Prices',
        product_price_list: 'Product Price List',
        product_id: 'Product ID',
        product_name: 'Product Name',
        pack_size: 'Pack Size',
        retailer_price: 'Retailer Price (₹)',
        mechanic_price: 'Mechanic Price (₹)',
    },
    hi: {
        title: 'विकास ऑटोमोबाइल्स, सतना<br>(एचपीसीएल ल्यूब वितरक)',
        greeting: 'नमस्ते',
        login_title: 'लॉगिन',
        register_title: 'नया खाता बनाएं',
        full_name: 'पूरा नाम',
        category: 'श्रेणी',
        retailer_opt: 'खुदरा विक्रेता',
        mechanic_opt: 'मैकेनिक',
        email: 'ईमेल',
        mobile_number: 'मोबाइल नंबर',
        firm_name: 'फर्म का नाम',
        city: 'शहर',
        password: 'पासवर्ड',
        confirm_password: 'पासवर्ड की पुष्टि करें',
        send_otp: 'OTP भेजें',
        register_btn: 'रजिस्टर करें',
        no_account: 'खाता नहीं है?',
        register_here: 'यहाँ रजिस्टर करें',
        back_to_login: 'लॉगिन पर वापस जाएं',
        enter_otp: 'अपने पंजीकृत ईमेल/फोन पर भेजे गए OTP दर्ज करें',
        resend_in: 'इसमें फिर से भेजें',
        verify_otp: 'OTP सत्यापित करें',
        resend_otp: 'OTP दोबारा भेजें',
        back: 'वापस',
    }
}

function setLanguage(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        const value = translations[lang][key];
        if (value !== undefined) {
            element.innerHTML = value;
        }
    });
    document.querySelectorAll('[data-i18n-opt]').forEach(element => {
        const key = element.dataset.i18nOpt;
        const value = translations[lang][key];
        if (value !== undefined) {
            element.textContent = value;
        }
    });
    document.getElementById('btn-en').disabled = lang === 'en';
    document.getElementById('btn-hi').disabled = lang === 'hi';
}

document.getElementById('btn-en').addEventListener('click', () => setLanguage('en'));
document.getElementById('btn-hi').addEventListener('click', () => setLanguage('hi'));

export { setLanguage };

// default language
setLanguage('en');
