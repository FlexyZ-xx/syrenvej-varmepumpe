// Password Authentication
const CORRECT_PASSWORD = 'syrenvej2025';
const AUTH_KEY = 'syrenvej_auth';
const EXPIRY_HOURS = 24;

// Check if authenticated
function isAuthenticated() {
    try {
        const data = localStorage.getItem(AUTH_KEY);
        if (!data) return false;
        
        const { timestamp } = JSON.parse(data);
        const hoursPassed = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        if (hoursPassed > EXPIRY_HOURS) {
            localStorage.removeItem(AUTH_KEY);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

// Show login immediately if not authenticated
if (!isAuthenticated()) {
    // Create and inject login HTML immediately
    const loginHTML = `
        <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            #login-screen { 
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
            #login-box {
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 400px;
            }
            #login-box h2 {
                margin: 0 0 10px 0;
                color: #2d3748;
                font-size: 28px;
                text-align: center;
            }
            #login-box p {
                margin: 0 0 30px 0;
                color: #718096;
                font-size: 14px;
                text-align: center;
            }
            #pwd-input {
                width: 100%;
                padding: 14px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                font-size: 16px;
                box-sizing: border-box;
                margin-bottom: 12px;
            }
            #pwd-input:focus {
                outline: none;
                border-color: #667eea;
            }
            #error-msg {
                color: #e53e3e;
                font-size: 14px;
                text-align: center;
                margin-bottom: 12px;
                min-height: 20px;
            }
            #login-submit {
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
            }
            #login-submit:hover {
                background: #2c5282;
                transform: translateY(-1px);
            }
            #session-info {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                color: #718096;
                font-size: 12px;
                text-align: center;
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                75% { transform: translateX(10px); }
            }
            .shake { animation: shake 0.4s; }
            
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
            }
            #logout-btn:hover {
                background: #e53e3e;
                transform: translateY(-2px);
            }
        </style>
        <div id="login-screen">
            <div id="login-box">
                <h2>🔒 Syrenvej6</h2>
                <p>Enter password to continue</p>
                <form id="login-form" onsubmit="return false;">
                    <input type="password" id="pwd-input" placeholder="Password" autocomplete="current-password" required>
                    <div id="error-msg"></div>
                    <button type="submit" id="login-submit">Login</button>
                </form>
                <div id="session-info">Session expires after ${EXPIRY_HOURS} hours</div>
            </div>
        </div>
    `;
    
    document.write(loginHTML);
    document.close();
    
    // Setup login handler
    setTimeout(() => {
        const form = document.getElementById('login-form');
        const input = document.getElementById('pwd-input');
        const error = document.getElementById('error-msg');
        const box = document.getElementById('login-box');
        
        input.focus();
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (input.value === CORRECT_PASSWORD) {
                localStorage.setItem(AUTH_KEY, JSON.stringify({ timestamp: Date.now() }));
                location.reload();
            } else {
                error.textContent = '❌ Incorrect password';
                input.value = '';
                input.focus();
                box.classList.add('shake');
                setTimeout(() => box.classList.remove('shake'), 400);
            }
        });
    }, 100);
    
} else {
    // User is authenticated - add logout button when page loads
    window.addEventListener('DOMContentLoaded', () => {
        const btn = document.createElement('button');
        btn.id = 'logout-btn';
        btn.textContent = '🚪 Logout';
        btn.onclick = () => {
            localStorage.removeItem(AUTH_KEY);
            location.reload();
        };
        document.body.appendChild(btn);
    });
}
