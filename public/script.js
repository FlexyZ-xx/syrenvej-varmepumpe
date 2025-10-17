// API Configuration
const API_BASE = window.location.origin + '/api';
const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    loadCurrentState();
    setupEventListeners();
    
    // Poll for updates every 2 seconds
    setInterval(loadCurrentState, 2000);
});

function populateSelects() {
    // Populate days (1-31)
    const daySelect = document.getElementById('daySelect');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        const dayOfWeek = days[(i - 1) % 7];
        option.value = i;
        option.textContent = `${i} ${dayOfWeek}`;
        daySelect.appendChild(option);
    }

    // Populate years (current year + 2 years)
    const yearSelect = document.getElementById('yearSelect');
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 3; i++) {
        const option = document.createElement('option');
        option.value = currentYear + i;
        option.textContent = currentYear + i;
        yearSelect.appendChild(option);
    }

    // Populate hours (00-23)
    const hourSelect = document.getElementById('hourSelect');
    for (let i = 0; i < 24; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i.toString().padStart(2, '0');
        hourSelect.appendChild(option);
    }

    // Populate minutes (00-59)
    const minuteSelect = document.getElementById('minuteSelect');
    for (let i = 0; i < 60; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i.toString().padStart(2, '0');
        minuteSelect.appendChild(option);
    }

    // Set current date/time as default
    const now = new Date();
    document.getElementById('daySelect').value = now.getDate();
    document.getElementById('monthSelect').value = now.getMonth() + 1;
    document.getElementById('yearSelect').value = now.getFullYear();
    document.getElementById('hourSelect').value = now.getHours().toString().padStart(2, '0');
    document.getElementById('minuteSelect').value = now.getMinutes().toString().padStart(2, '0');
}

let waitingForResponse = false;

function setupEventListeners() {
    // Manual toggle
    const toggle = document.getElementById('manualToggle');
    toggle.addEventListener('change', async (e) => {
        if (waitingForResponse) return;
        
        const command = e.target.checked ? 'on' : 'off';
        
        // Disable toggle while waiting for Arduino
        toggle.disabled = true;
        waitingForResponse = true;
        toggle.style.opacity = '0.5';
        toggle.style.cursor = 'wait';
        
        await sendCommand({ type: 'manual', action: command });
        
        // Re-enable after Arduino confirms (or timeout after 15 seconds)
        setTimeout(() => {
            toggle.disabled = false;
            waitingForResponse = false;
            toggle.style.opacity = '1';
            toggle.style.cursor = 'pointer';
        }, 15000);
    });

    // Save schedule
    document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
        const day = document.getElementById('daySelect').value;
        const month = document.getElementById('monthSelect').value;
        const year = document.getElementById('yearSelect').value;
        const hour = document.getElementById('hourSelect').value;
        const minute = document.getElementById('minuteSelect').value;
        const action = document.getElementById('actionSelect').value;

        const schedule = {
            type: 'schedule',
            day: parseInt(day),
            month: parseInt(month),
            year: parseInt(year),
            hour: parseInt(hour),
            minute: parseInt(minute),
            action: action
        };

        await sendCommand(schedule);
    });

    // Clear schedule
    document.getElementById('clearScheduleBtn').addEventListener('click', async () => {
        await sendCommand({ type: 'clear_schedule' });
    });
}

async function sendCommand(command) {
    try {
        const response = await fetch(`${API_BASE}/command.js`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(command)
        });

        if (!response.ok) {
            throw new Error('Failed to send command');
        }

        showStatus('Command sent successfully!', 'success');
        setTimeout(loadCurrentState, 500);
    } catch (error) {
        console.error('Error sending command:', error);
        showStatus('Failed to send command', 'error');
    }
}

async function loadCurrentState() {
    try {
        const response = await fetch(`${API_BASE}/status.js`, {
            headers: {
                'X-API-Key': API_KEY
            }
        });
        if (!response.ok) return;

        const data = await response.json();
        
        // Update toggle (without triggering change event)
        const toggle = document.getElementById('manualToggle');
        const oldState = toggle.checked;
        const newState = data.relayState === 'on';
        
        toggle.checked = newState;
        
        // If Arduino confirmed the state change, re-enable toggle
        if (waitingForResponse && oldState !== newState) {
            toggle.disabled = false;
            waitingForResponse = false;
            toggle.style.opacity = '1';
            toggle.style.cursor = 'pointer';
        }

        // Update schedule display
        updateScheduleDisplay(data.schedule);
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

function updateScheduleDisplay(schedule) {
    const container = document.getElementById('currentSchedule');
    
    if (!schedule || !schedule.year) {
        container.innerHTML = '<div style="color: #718096;">No schedule set</div>';
        container.classList.remove('has-schedule', 'executed');
        return;
    }

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const scheduleDate = new Date(schedule.year, schedule.month - 1, schedule.day, 
                                  schedule.hour, schedule.minute);
    const dayName = days[scheduleDate.getDay()];
    const monthName = months[schedule.month - 1];
    
    const timeStr = `${schedule.hour.toString().padStart(2, '0')}:${schedule.minute.toString().padStart(2, '0')}`;
    const dateStr = `${dayName}, ${schedule.day} ${monthName} ${schedule.year}`;
    
    const actionStr = schedule.action === 'on' ? 'ON' : 'OFF';
    const statusStr = schedule.executed ? '(Already executed)' : '';
    
    container.innerHTML = `
        <div class="schedule-time">${dateStr}</div>
        <div class="schedule-time">${timeStr} - ${actionStr} ${statusStr}</div>
    `;
    
    container.classList.add('has-schedule');
    if (schedule.executed) {
        container.classList.add('executed');
    } else {
        container.classList.remove('executed');
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

