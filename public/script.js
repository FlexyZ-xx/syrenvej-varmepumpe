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
let expectedState = null;
let waitingForSchedule = false;
let expectedSchedule = null;
let lastArduinoHeartbeat = null;

function setupEventListeners() {
    // Manual toggle - use click event for better control
    const toggle = document.getElementById('manualToggle');
    
    // Block clicks while waiting
    toggle.addEventListener('click', (e) => {
        if (waitingForResponse) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true); // Capture phase to block before change event
    
    toggle.addEventListener('change', async (e) => {
        // Double-check we're not waiting
        if (waitingForResponse) {
            e.preventDefault();
            toggle.checked = expectedState;
            return;
        }
        
        const newState = e.target.checked;
        const command = newState ? 'on' : 'off';
        
        // Set expected state and waiting flag IMMEDIATELY
        expectedState = newState;
        waitingForResponse = true;
        
        // Disable toggle while waiting for Relay
        toggle.disabled = true;
        toggle.style.opacity = '0.5';
        toggle.style.cursor = 'wait';
        toggle.style.pointerEvents = 'none'; // Extra protection
        
        // Show loading in status box
        showWaitingState('Waiting for relay confirmation...');
        
        await sendCommand({ type: 'manual', action: command });
        
        // Timeout after 30 seconds if Relay doesn't respond
        setTimeout(() => {
            if (waitingForResponse) {
                toggle.disabled = false;
                waitingForResponse = false;
                expectedState = null;
                toggle.style.opacity = '1';
                toggle.style.cursor = 'pointer';
                toggle.style.pointerEvents = 'auto';
                hideWaitingState();
            }
        }, 30000);
    });

    // Save schedule
    document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
        if (waitingForSchedule) return;
        
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
        
        // Store expected schedule
        expectedSchedule = {
            day: parseInt(day),
            month: parseInt(month),
            year: parseInt(year),
            hour: parseInt(hour),
            minute: parseInt(minute),
            action: action,
            executed: false
        };
        
        // Disable all schedule controls and show loading
        setScheduleControlsState(false);
        waitingForSchedule = true;
        showWaitingState('Waiting for relay confirmation...');

        await sendCommand(schedule);
        
        // Timeout after 30 seconds if Relay doesn't respond
        setTimeout(() => {
            if (waitingForSchedule) {
                setScheduleControlsState(true);
                waitingForSchedule = false;
                expectedSchedule = null;
                hideWaitingState();
            }
        }, 30000);
    });

    // Clear schedule
    document.getElementById('clearScheduleBtn').addEventListener('click', async () => {
        if (waitingForSchedule) return;
        
        // Store expected state (no schedule)
        expectedSchedule = null;
        
        // Disable all schedule controls and show loading
        setScheduleControlsState(false);
        waitingForSchedule = true;
        showWaitingState('Waiting for relay confirmation...');
        
        await sendCommand({ type: 'clear_schedule' });
        
        // Timeout after 30 seconds if Relay doesn't respond
        setTimeout(() => {
            if (waitingForSchedule) {
                setScheduleControlsState(true);
                waitingForSchedule = false;
                hideWaitingState();
            }
        }, 30000);
    });
}

function setScheduleControlsState(enabled) {
    const controls = [
        'daySelect', 'monthSelect', 'yearSelect', 
        'hourSelect', 'minuteSelect', 'actionSelect',
        'saveScheduleBtn', 'clearScheduleBtn'
    ];
    
    controls.forEach(id => {
        const el = document.getElementById(id);
        el.disabled = !enabled;
        el.style.opacity = enabled ? '1' : '0.5';
    });
}

function showWaitingState(message) {
    const statusBox = document.getElementById('arduinoStatus');
    const statusDot = document.getElementById('statusDot');
    const statusSpinner = document.getElementById('statusSpinner');
    const statusText = document.getElementById('statusText');
    
    statusBox.classList.add('waiting');
    statusDot.style.display = 'none';
    statusSpinner.style.display = 'block';
    statusText.textContent = message;
}

function hideWaitingState() {
    const statusBox = document.getElementById('arduinoStatus');
    const statusDot = document.getElementById('statusDot');
    const statusSpinner = document.getElementById('statusSpinner');
    
    statusBox.classList.remove('waiting');
    statusDot.style.display = 'block';
    statusSpinner.style.display = 'none';
    
    // Restore normal status
    updateArduinoStatus(false);
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
        
        // Don't show success message
        // Don't reload state - wait for Relay to report back
    } catch (error) {
        console.error('Error sending command:', error);
        showStatus('Failed to send command', 'error');
        
        // On error, re-enable controls
        const toggle = document.getElementById('manualToggle');
        toggle.disabled = false;
        waitingForResponse = false;
        toggle.style.opacity = '1';
        toggle.style.cursor = 'pointer';
        toggle.style.pointerEvents = 'auto';
        
        // Hide waiting state
        hideWaitingState();
        
        // Re-enable schedule controls if schedule command failed
        if (waitingForSchedule) {
            setScheduleControlsState(true);
            waitingForSchedule = false;
            expectedSchedule = null;
        }
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
        
        // Update heartbeat
        lastArduinoHeartbeat = Date.now();
        updateArduinoStatus(true);
        
        const toggle = document.getElementById('manualToggle');
        const arduinoState = data.relayState === 'on';
        
        // If waiting for confirmation, check if Relay confirmed the expected state
        if (waitingForResponse && expectedState !== null) {
            if (arduinoState === expectedState) {
                // Relay confirmed! Re-enable toggle
                toggle.checked = arduinoState;
                toggle.disabled = false;
                waitingForResponse = false;
                expectedState = null;
                toggle.style.opacity = '1';
                toggle.style.cursor = 'pointer';
                toggle.style.pointerEvents = 'auto';
                
                // Hide waiting state
                hideWaitingState();
            }
            // If state doesn't match, keep waiting
        } else {
            // Normal update when not waiting
            toggle.checked = arduinoState;
        }

        // Update schedule display and check if Relay confirmed
        if (waitingForSchedule) {
            if (schedulesMatch(data.schedule, expectedSchedule)) {
                // Relay confirmed! Re-enable controls
                setScheduleControlsState(true);
                waitingForSchedule = false;
                expectedSchedule = null;
                hideWaitingState();
            }
            // If schedule doesn't match, keep waiting
        }
        
        updateScheduleDisplay(data.schedule);
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

function schedulesMatch(actual, expected) {
    // If both are null/empty (cleared schedule)
    if ((!actual || !actual.year) && !expected) {
        return true;
    }
    
    // If one is null but not the other
    if (!actual || !actual.year || !expected) {
        return false;
    }
    
    // Compare all schedule fields
    return actual.day === expected.day &&
           actual.month === expected.month &&
           actual.year === expected.year &&
           actual.hour === expected.hour &&
           actual.minute === expected.minute &&
           actual.action === expected.action;
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

function updateArduinoStatus(isConnected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const lastSeenEl = document.getElementById('lastSeen');
    
    // Check if we have recent heartbeat (within 10 seconds)
    const hasRecentHeartbeat = lastArduinoHeartbeat && (Date.now() - lastArduinoHeartbeat) < 10000;
    
    if (hasRecentHeartbeat) {
        // Connected - green
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
        
        const timeSince = getTimeSince(lastArduinoHeartbeat);
        lastSeenEl.textContent = `Last seen: ${timeSince}`;
    } else {
        // Not connected - red
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Not Connected';
        
        if (lastArduinoHeartbeat) {
            const timeSince = getTimeSince(lastArduinoHeartbeat);
            lastSeenEl.textContent = `Last seen: ${timeSince}`;
        } else {
            lastSeenEl.textContent = 'Waiting for first connection...';
        }
    }
}

function getTimeSince(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
}

// Check connection status periodically
setInterval(() => {
    if (lastArduinoHeartbeat) {
        updateArduinoStatus(false);
    }
}, 1000);

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

