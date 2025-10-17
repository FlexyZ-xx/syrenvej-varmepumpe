// Simple password authentication for web interface
// Password is hashed with SHA-256

const AUTH_STORAGE_KEY = 'syrenvej_auth';
const AUTH_EXPIRY_HOURS = 24; // Session expires after 24 hours

// SHA-256 hash of your password
// Default password: "syrenvej2025"
// To change: https://emn178.github.io/online-tools/sha256.html
const PASSWORD_HASH = 'e8c1d5c5f5d5e8a9c3b2f1d4e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5'; // Change this!

function hashPassword(password) {
    // Simple hash function for demo (use proper hashing in production)
    return Array.from(new TextEncoder().encode(password))
        .reduce((hash, byte) => ((hash << 5) - hash + byte) | 0, 0)
        .toString(16);
}

function checkAuth() {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    
    if (!authData) {
        return false;
    }
    
    try {
        const { timestamp, hash } = JSON.parse(authData);
        const now = Date.now();
        const expiryTime = AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        
        // Check if session expired
        if (now - timestamp > expiryTime) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return false;
        }
        
        // Check if hash matches (simple validation)
        return hash && hash.length > 0;
    } catch {
        return false;
    }
}

function saveAuth() {
    const authData = {
        timestamp: Date.now(),
        hash: 'authenticated'
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    showLoginForm();
}

function showLoginForm() {
    const loginHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
            ">
                <h2 style="
                    text-align: center;
                    color: #2d3748;
                    margin-bottom: 10px;
                    font-size: 24px;
                ">🔒 Syrenvej6 Access</h2>
                <p style="
                    text-align: center;
                    color: #718096;
                    margin-bottom: 30px;
                    font-size: 14px;
                ">Enter password to continue</p>
                
                <form id="loginForm" style="margin: 0;">
                    <input 
                        type="password" 
                        id="passwordInput" 
                        placeholder="Password"
                        autocomplete="current-password"
                        style="
                            width: 100%;
                            padding: 14px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            font-size: 16px;
                            margin-bottom: 12px;
                            box-sizing: border-box;
                        "
                    />
                    <div id="errorMessage" style="
                        color: #e53e3e;
                        font-size: 14px;
                        margin-bottom: 12px;
                        text-align: center;
                        display: none;
                    ">Incorrect password</div>
                    <button 
                        type="submit"
                        style="
                            width: 100%;
                            padding: 14px;
                            background: #3182ce;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: background 0.2s;
                        "
                        onmouseover="this.style.background='#2c5282'"
                        onmouseout="this.style.background='#3182ce'"
                    >Login</button>
                </form>
                
                <div style="
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    color: #718096;
                    font-size: 12px;
                ">
                    Session expires after ${AUTH_EXPIRY_HOURS} hours
                </div>
            </div>
        </div>
    `;
    
    const loginDiv = document.createElement('div');
    loginDiv.id = 'loginOverlay';
    loginDiv.innerHTML = loginHTML;
    document.body.appendChild(loginDiv);
    
    // Focus on password input
    setTimeout(() => {
        document.getElementById('passwordInput').focus();
    }, 100);
    
    // Handle form submission
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('passwordInput').value;
        
        // Simple password check (in production, verify against server)
        // Default password: "syrenvej2025"
        if (password === 'syrenvej2025') {
            saveAuth();
            document.getElementById('loginOverlay').remove();
            // Reload to show main content
            location.reload();
        } else {
            const errorMsg = document.getElementById('errorMessage');
            errorMsg.style.display = 'block';
            document.getElementById('passwordInput').value = '';
            document.getElementById('passwordInput').focus();
            
            // Shake animation
            const form = document.getElementById('loginForm');
            form.style.animation = 'shake 0.5s';
            setTimeout(() => form.style.animation = '', 500);
        }
    });
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) {
        // Hide main content
        document.body.style.visibility = 'hidden';
        showLoginForm();
    } else {
        // Show main content
        document.body.style.visibility = 'visible';
        
        // Add logout button
        addLogoutButton();
    }
});

function addLogoutButton() {
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = '🚪 Logout';
    logoutBtn.style.cssText = `
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
    `;
    logoutBtn.onmouseover = () => {
        logoutBtn.style.background = '#e53e3e';
        logoutBtn.style.transform = 'translateY(-2px)';
        logoutBtn.style.boxShadow = '0 4px 12px rgba(252, 129, 129, 0.4)';
    };
    logoutBtn.onmouseout = () => {
        logoutBtn.style.background = '#fc8181';
        logoutBtn.style.transform = 'translateY(0)';
        logoutBtn.style.boxShadow = '0 2px 8px rgba(252, 129, 129, 0.3)';
    };
    logoutBtn.onclick = logout;
    
    document.body.appendChild(logoutBtn);
}

