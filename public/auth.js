// Simple password authentication for web interface
const AUTH_STORAGE_KEY = 'syrenvej_auth';
const AUTH_EXPIRY_HOURS = 24;
const CORRECT_PASSWORD = 'syrenvej2025'; // Change this to your password

// Immediately hide page content
document.documentElement.style.visibility = 'hidden';

function checkAuth() {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    
    if (!authData) {
        return false;
    }
    
    try {
        const { timestamp } = JSON.parse(authData);
        const now = Date.now();
        const expiryTime = AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        
        if (now - timestamp > expiryTime) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return false;
        }
        
        return true;
    } catch {
        return false;
    }
}

function saveAuth() {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        timestamp: Date.now()
    }));
}

function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    location.reload();
}

function createLoginPage() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
        <style>
            #auth-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
            }
            
            #auth-box {
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
                text-align: center;
            }
            
            #auth-box h2 {
                color: #2d3748;
                margin-bottom: 10px;
                font-size: 28px;
                font-weight: 600;
            }
            
            #auth-box p {
                color: #718096;
                margin-bottom: 30px;
                font-size: 14px;
            }
            
            #password-input {
                width: 100%;
                padding: 14px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                font-size: 16px;
                margin-bottom: 12px;
                box-sizing: border-box;
                font-family: inherit;
            }
            
            #password-input:focus {
                outline: none;
                border-color: #667eea;
            }
            
            #auth-error {
                color: #e53e3e;
                font-size: 14px;
                margin-bottom: 12px;
                min-height: 20px;
            }
            
            #login-btn {
                width: 100%;
                padding: 14px;
                background: #3182ce;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                font-family: inherit;
            }
            
            #login-btn:hover {
                background: #2c5282;
                transform: translateY(-2px);
            }
            
            #login-btn:active {
                transform: translateY(0);
            }
            
            #auth-info {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                color: #718096;
                font-size: 12px;
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                50% { transform: translateX(10px); }
                75% { transform: translateX(-10px); }
            }
            
            .shake {
                animation: shake 0.5s;
            }
            
            #logout-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 20px;
                background: #fc8181;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                z-index: 1000;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(252, 129, 129, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            #logout-btn:hover {
                background: #e53e3e;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(252, 129, 129, 0.4);
            }
        </style>
        <div id="auth-box">
            <h2>🔒 Syrenvej6</h2>
            <p>Enter password to continue</p>
            <form id="auth-form">
                <input 
                    type="password" 
                    id="password-input" 
                    placeholder="Password"
                    autocomplete="current-password"
                    required
                />
                <div id="auth-error"></div>
                <button type="submit" id="login-btn">Login</button>
            </form>
            <div id="auth-info">
                Session expires after ${AUTH_EXPIRY_HOURS} hours
            </div>
        </div>
    `;
    
    document.body.insertBefore(overlay, document.body.firstChild);
    
    // Focus password input
    const passwordInput = document.getElementById('password-input');
    setTimeout(() => passwordInput.focus(), 100);
    
    // Handle form submission
    document.getElementById('auth-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const password = passwordInput.value;
        const errorDiv = document.getElementById('auth-error');
        const authBox = document.getElementById('auth-box');
        
        if (password === CORRECT_PASSWORD) {
            saveAuth();
            overlay.remove();
            document.documentElement.style.visibility = 'visible';
            addLogoutButton();
        } else {
            errorDiv.textContent = '❌ Incorrect password';
            passwordInput.value = '';
            passwordInput.focus();
            authBox.classList.add('shake');
            setTimeout(() => authBox.classList.remove('shake'), 500);
        }
    });
}

function addLogoutButton() {
    const btn = document.createElement('button');
    btn.id = 'logout-btn';
    btn.textContent = '🚪 Logout';
    btn.onclick = logout;
    document.body.appendChild(btn);
}

// Check auth when page loads
if (checkAuth()) {
    // User is authenticated
    document.documentElement.style.visibility = 'visible';
    window.addEventListener('DOMContentLoaded', addLogoutButton);
} else {
    // Show login page
    window.addEventListener('DOMContentLoaded', createLoginPage);
}
