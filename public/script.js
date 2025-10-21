// API Configuration
const API_BASE = window.location.origin + '/api';
const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    loadCurrentState();
    setupEventListeners();
    
    // Poll for updates every 1 second (fast response)
    setInterval(loadCurrentState, 1000);
    
    // Note: Status updates happen when loadCurrentState() polls the API
    // No need for separate interval since server determines connection status
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
let isShowingWaitingState = false;
let lastConnectionState = false; // Track last known connection state
let currentSchedule = null;

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
            toggle.checked = !expectedState; // Revert to current state
            return;
        }
        
        const newState = e.target.checked;
        const command = newState ? 'on' : 'off';
        const currentState = !newState; // Current state is opposite of new
        
        // Revert toggle immediately - only changes when Arduino confirms
        toggle.checked = currentState;
        
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
        
        // Timeout after 2.5 minutes if Relay doesn't respond (accounts for 60s polling interval)
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
        }, 150000);
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
        
        // Set waiting state and show loading
        waitingForSchedule = true;
        showWaitingState('Waiting for relay confirmation...');

        await sendCommand(schedule);
        
        // Timeout after 2.5 minutes if Relay doesn't respond (accounts for 60s polling interval)
        setTimeout(() => {
            if (waitingForSchedule) {
                waitingForSchedule = false;
                expectedSchedule = null;
                hideWaitingState();
            }
        }, 150000);
    });

    // Clear schedule
    document.getElementById('clearScheduleBtn').addEventListener('click', async () => {
        if (waitingForSchedule) return;
        
        // Store expected state (no schedule)
        expectedSchedule = null;
        
        // Set waiting state and show loading
        waitingForSchedule = true;
        showWaitingState('Waiting for relay confirmation...');
        
        await sendCommand({ type: 'clear_schedule' });
        
        // Timeout after 2.5 minutes if Relay doesn't respond (accounts for 60s polling interval)
        setTimeout(() => {
            if (waitingForSchedule) {
                waitingForSchedule = false;
                hideWaitingState();
            }
        }, 150000);
    });
}

function showWaitingState(message) {
    const statusBox = document.getElementById('arduinoStatus');
    const statusDot = document.getElementById('statusDot');
    const statusSpinner = document.getElementById('statusSpinner');
    const statusText = document.getElementById('statusText');
    
    isShowingWaitingState = true;
    statusBox.classList.add('waiting');
    statusDot.style.display = 'none';
    statusSpinner.style.display = 'block';
    statusText.textContent = message;
}

function hideWaitingState() {
    const statusBox = document.getElementById('arduinoStatus');
    const statusDot = document.getElementById('statusDot');
    const statusSpinner = document.getElementById('statusSpinner');
    
    isShowingWaitingState = false;
    statusBox.classList.remove('waiting');
    statusDot.style.display = 'block';
    statusSpinner.style.display = 'none';
    
    // Restore last known connection status (not force to false)
    updateArduinoStatus(lastConnectionState);
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
        
        // Reset waiting flags
        waitingForResponse = false;
        waitingForSchedule = false;
        expectedSchedule = null;
        
        const toggle = document.getElementById('manualToggle');
        toggle.style.pointerEvents = 'auto';
        
        // Hide waiting state (this will call updateArduinoStatus to re-enable all controls)
        hideWaitingState();
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
        
        // Update heartbeat from server's lastUpdate timestamp
        if (data.lastUpdate) {
            lastArduinoHeartbeat = data.lastUpdate;
        }
        updateArduinoStatus(data.isConnected || false);
        
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
                // Relay confirmed! Clear waiting state
                waitingForSchedule = false;
                expectedSchedule = null;
                hideWaitingState();  // This will call updateArduinoStatus to re-enable all controls
            }
            // If schedule doesn't match, keep waiting
        }
        
        // Only update schedule display if we have schedule data in the response
        if (data.hasOwnProperty('schedule')) {
            currentSchedule = data.schedule;
            updateScheduleDisplay(currentSchedule);
        }
        // If schedule is not in response, keep showing current schedule
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
    
    // Only clear if schedule is explicitly null or empty (not just missing from response)
    if (!schedule || !schedule.year || schedule.year === 0) {
        container.innerHTML = '<div style="color: #718096;">No schedule set</div>';
        container.classList.remove('has-schedule', 'executed');
        currentSchedule = null;
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
    // Store the connection state for later restoration
    lastConnectionState = isConnected;
    
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const lastSeenEl = document.getElementById('lastSeen');
    
    // Get control elements
    const toggle = document.getElementById('manualToggle');
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    const clearScheduleBtn = document.getElementById('clearScheduleBtn');
    const daySelect = document.getElementById('daySelect');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const hourSelect = document.getElementById('hourSelect');
    const minuteSelect = document.getElementById('minuteSelect');
    const actionSelect = document.getElementById('actionSelect');
    
    // Update status display ONLY if not showing waiting state
    if (!isShowingWaitingState) {
        // Always show time since last heartbeat regardless of connection status
        if (lastArduinoHeartbeat) {
            const secondsSince = Math.floor((Date.now() - lastArduinoHeartbeat) / 1000);
            if (secondsSince < 5) {
                lastSeenEl.textContent = 'Active now';
            } else if (secondsSince < 60) {
                lastSeenEl.textContent = `${secondsSince}s ago`;
            } else if (secondsSince < 120) {
                lastSeenEl.textContent = `1 min ago`;
            } else {
                const minutes = Math.floor(secondsSince / 60);
                lastSeenEl.textContent = `${minutes} min ago`;
            }
        } else {
            lastSeenEl.textContent = 'Waiting for connection...';
        }
        
        // Update connection indicator
        if (isConnected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Not Connected';
        }
    }
    
    // ALWAYS update control states (even during waiting state)
    // Enable ALL controls only if: connected AND not waiting for any response
    const isWaiting = waitingForResponse || waitingForSchedule;
    const shouldEnable = isConnected && !isWaiting;
    
    if (shouldEnable) {
        // Enable all controls
        toggle.disabled = false;
        toggle.style.opacity = '1';
        toggle.style.cursor = 'pointer';
        
        saveScheduleBtn.disabled = false;
        clearScheduleBtn.disabled = false;
        daySelect.disabled = false;
        monthSelect.disabled = false;
        yearSelect.disabled = false;
        hourSelect.disabled = false;
        minuteSelect.disabled = false;
        actionSelect.disabled = false;
    } else {
        // Disable all controls (either not connected OR waiting for response)
        toggle.disabled = true;
        toggle.style.opacity = '0.5';
        toggle.style.cursor = 'not-allowed';
        
        saveScheduleBtn.disabled = true;
        clearScheduleBtn.disabled = true;
        daySelect.disabled = true;
        monthSelect.disabled = true;
        yearSelect.disabled = true;
        hourSelect.disabled = true;
        minuteSelect.disabled = true;
        actionSelect.disabled = true;
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

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

