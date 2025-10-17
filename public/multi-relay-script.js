// API Configuration
const API_BASE = window.location.origin + '/api';
const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';

let relaysData = [];
let waitingForResponse = {}; // Track which relays are waiting for response
let expectedStates = {}; // Track expected states for each relay

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    populateSelects();
    loadRelaysState();
    setupEventListeners();
    
    // Poll for updates every 2 seconds
    setInterval(loadRelaysState, 2000);
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

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

function setupEventListeners() {
    // Save schedule
    document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
        const relayIndex = parseInt(document.getElementById('scheduleRelaySelect').value);
        const day = document.getElementById('daySelect').value;
        const month = document.getElementById('monthSelect').value;
        const year = document.getElementById('yearSelect').value;
        const hour = document.getElementById('hourSelect').value;
        const minute = document.getElementById('minuteSelect').value;
        const action = document.getElementById('actionSelect').value;

        const schedule = {
            type: 'schedule',
            relayIndex: relayIndex,
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
        const relayIndex = parseInt(document.getElementById('scheduleRelaySelect').value);
        await sendCommand({ type: 'clear_schedule', relayIndex: relayIndex });
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
        
        // Don't show success message
        // Don't reload state - wait for Arduino to report back
    } catch (error) {
        console.error('Error sending command:', error);
        showStatus('Failed to send command', 'error');
        
        // On error, clear waiting state for that relay
        if (command.relayIndex !== undefined) {
            delete waitingForResponse[command.relayIndex];
            renderRelayGrid();
        }
    }
}

async function loadRelaysState() {
    try {
        const response = await fetch(`${API_BASE}/status.js`, {
            headers: {
                'X-API-Key': API_KEY
            }
        });
        if (!response.ok) return;

        const data = await response.json();
        
        if (data.relays) {
            // Check if any waiting relays got their state confirmed
            data.relays.forEach((relay, index) => {
                if (waitingForResponse[index] && expectedStates[index] !== undefined) {
                    const arduinoState = relay.state === 'on';
                    // If Arduino reports the expected state, clear waiting
                    if (arduinoState === expectedStates[index]) {
                        delete waitingForResponse[index];
                        delete expectedStates[index];
                    }
                }
            });
            
            relaysData = data.relays;
            renderRelayGrid();
            updateRelaySelector();
        }
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

function renderRelayGrid() {
    const grid = document.getElementById('relayGrid');
    grid.innerHTML = '';
    
    relaysData.forEach((relay, index) => {
        const card = document.createElement('div');
        card.className = `relay-card ${relay.state === 'on' ? 'active' : ''}`;
        
        let scheduleInfo = '';
        if (relay.schedule) {
            const s = relay.schedule;
            const timeStr = `${s.hour.toString().padStart(2, '0')}:${s.minute.toString().padStart(2, '0')}`;
            const dateStr = `${s.day}/${s.month}`;
            scheduleInfo = `<div class="schedule-badge">📅 ${dateStr} ${timeStr} - ${s.action.toUpperCase()}</div>`;
        }
        
        const isWaiting = waitingForResponse[index];
        
        card.innerHTML = `
            <div class="relay-header">
                <div class="relay-name">${relay.name}</div>
                <div class="relay-status ${relay.state}">${relay.state.toUpperCase()}</div>
            </div>
            <div class="toggle-container">
                <label class="switch mini-toggle">
                    <input type="checkbox" 
                           ${relay.state === 'on' ? 'checked' : ''} 
                           ${isWaiting ? 'disabled' : ''}
                           data-relay-index="${index}"
                           style="${isWaiting ? 'opacity: 0.5; cursor: wait;' : ''}">
                    <span class="slider"></span>
                </label>
            </div>
            ${scheduleInfo}
        `;
        
        // Add toggle event listener
        const toggle = card.querySelector('input[type="checkbox"]');
        toggle.addEventListener('change', async (e) => {
            if (waitingForResponse[index]) {
                e.preventDefault();
                return;
            }
            
            const newState = e.target.checked;
            const command = newState ? 'on' : 'off';
            
            // Optimistic update - keep toggle in new position
            toggle.checked = newState;
            expectedStates[index] = newState;
            
            // Mark as waiting and re-render
            waitingForResponse[index] = true;
            renderRelayGrid();
            
            await sendCommand({ type: 'manual', action: command, relayIndex: index });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (waitingForResponse[index]) {
                    delete waitingForResponse[index];
                    delete expectedStates[index];
                    renderRelayGrid();
                }
            }, 30000);
        });
        
        grid.appendChild(card);
    });
}

function updateRelaySelector() {
    const select = document.getElementById('scheduleRelaySelect');
    select.innerHTML = '';
    
    relaysData.forEach((relay, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = relay.name;
        select.appendChild(option);
    });
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

