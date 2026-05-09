// --- DATABASE & STATE ---
const STORE_KEY = 'fitness_app_data';

let state = {
    currentView: 'home',
    selectedDate: null, // YYYY-MM-DD, or null for 'all'
    editingLogId: null,
    currentMonth: new Date()
};

function generateUUID() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getLocalDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initDB() {
    let data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!data) {
        data = {
            groups: [
                { id: 1, name: 'Chest' },
                { id: 2, name: 'Back' },
                { id: 3, name: 'Legs' },
                { id: 4, name: 'Biceps' },
                { id: 5, name: 'Triceps' },
                { id: 6, name: 'Shoulders' },
                { id: 7, name: 'Cardio' },
                { id: 8, name: 'Abs' },
                { id: 9, name: 'Measures' }
            ],
            items: [
                { id: 1, group_id: 1, name: 'Bench Press', type: 'weight_reps' },
                { id: 2, group_id: 1, name: 'Incline Dumbbell Press', type: 'weight_reps' },
                { id: 3, group_id: 2, name: 'Pull Ups', type: 'weight_reps' },
                { id: 4, group_id: 3, name: 'Squats', type: 'weight_reps' },
                { id: 5, group_id: 7, name: 'Treadmill Running', type: 'distance_time' },
                { id: 6, group_id: 9, name: 'Body Weight', type: 'measure' },
                { id: 7, group_id: 9, name: 'Body Fat', type: 'measure' },
                { id: 8, group_id: 9, name: 'Time', type: 'time_range' },
                { id: 9, group_id: 9, name: 'Muscle', type: 'measure' },
                { id: 10, group_id: 9, name: 'Chest', type: 'measure' },
                { id: 11, group_id: 9, name: 'Waist', type: 'measure' },
                { id: 12, group_id: 9, name: 'Hip', type: 'measure' }
            ],
            logs: []
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
    }
    return data;
}

function getData() {
    let data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!data) return initDB();
    
    // Auto-patch missing measures for existing users
    const missingMeasures = ['Muscle', 'Chest', 'Waist', 'Hip'];
    let changed = false;
    let maxId = Math.max(...data.items.map(i => i.id), 0);
    
    missingMeasures.forEach(m => {
        if (!data.items.find(i => i.name === m)) {
            maxId++;
            data.items.push({ id: maxId, group_id: 9, name: m, type: 'measure' });
            changed = true;
        }
    });
    
    if (changed) saveData(data);
    return data;
}

function saveData(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

// --- RENDERING ---

function formatDate(dateStr) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const date = new Date(dateStr + 'T12:00:00'); // Prevent timezone issues
    return date.toLocaleDateString('en-US', options);
}

function renderCalendar() {
    const data = getData();
    const grid = document.getElementById('calendar-grid');
    const monthTitle = document.getElementById('month-title');
    
    // Clear grid except weekdays
    grid.innerHTML = '<div class="weekday">M</div><div class="weekday">T</div><div class="weekday">W</div><div class="weekday">T</div><div class="weekday">F</div><div class="weekday">S</div><div class="weekday">S</div>';

    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    
    const options = { month: 'long', year: 'numeric' };
    monthTitle.innerText = state.currentMonth.toLocaleDateString('en-US', options);

    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust first day for Monday start (0: Mon, 6: Sun)
    let startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < startDayIndex; i++) {
        grid.innerHTML += '<div class="day empty"></div>';
    }

    const todayStr = getLocalDateStr();

    // Get dates that have logs
    const activeDates = new Set(data.logs.map(log => log.date));

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let classes = ['day'];
        let innerHtml = `${day}`;

        if (dateStr === todayStr) {
            classes.push('today');
        } else if (activeDates.has(dateStr)) {
            classes.push('active-day');
        }

        if (activeDates.has(dateStr)) {
            innerHtml += '<div class="dot"></div>';
        }

        grid.innerHTML += `<div class="${classes.join(' ')}" onclick="openLog('${dateStr}')">${innerHtml}</div>`;
    }
}

function calculateTimeDuration(startTime, endTime) {
    if (!startTime || !endTime) return null;
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // handle crossing midnight
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function renderLogs() {
    const data = getData();
    const container = document.getElementById('log-container');
    container.innerHTML = '';

    let logs = data.logs;
    
    // Sort: Date descending, but within same date, timestamp ascending (FIFO)
    logs.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return a.timestamp - b.timestamp;
    });

    // Filter by selected date if not showing all
    if (state.selectedDate) {
        logs = logs.filter(log => log.date === state.selectedDate);
    }

    if (logs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 50px;">No records found.</p>';
        return;
    }

    // Group by Date
    const groupedByDate = {};
    logs.forEach(log => {
        if (!groupedByDate[log.date]) groupedByDate[log.date] = [];
        groupedByDate[log.date].push(log);
    });

    // Render Dates
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

    sortedDates.forEach(dateStr => {
        const dayLogs = groupedByDate[dateStr];
        
        // Find Time log if any
        const timeLog = dayLogs.find(l => {
            const item = data.items.find(i => i.id === parseInt(l.item_id));
            return item && item.type === 'time_range';
        });

        let timeHtml = '';
        if (timeLog && timeLog.start_time && timeLog.end_time) {
            const durationStr = calculateTimeDuration(timeLog.start_time, timeLog.end_time);
            timeHtml = `<div class="training-time" onclick="openTraining('${timeLog.id}')"><ion-icon name="time-outline"></ion-icon> ${durationStr}</div>`;
        }

        // Generate Date Header Block
        const isToday = dateStr === getLocalDateStr();
        const dateHeaderStr = isToday ? `Today - ${formatDate(dateStr)}` : formatDate(dateStr);

        let html = `
        <div class="date-group">
            <div class="date-header-block">
                <div class="date-header">${dateHeaderStr}</div>
                ${timeHtml}
            </div>
        `;

        // Group by Group Name within Date
        const groupedByGroup = {};
        dayLogs.forEach(log => {
            const item = data.items.find(i => i.id === parseInt(log.item_id));
            if (!item) return;
            // Ignore Time range item from the main list as it's shown in header
            if (item.type === 'time_range') return;

            const group = data.groups.find(g => g.id === item.group_id);
            const groupName = group ? group.name : 'Other';
            
            if (!groupedByGroup[groupName]) groupedByGroup[groupName] = [];
            groupedByGroup[groupName].push({ log, item });
        });

        // Render Groups
        for (const [groupName, records] of Object.entries(groupedByGroup)) {
            html += `<div class="group-header">${groupName}</div>`;
            
            records.forEach(record => {
                const { log, item } = record;
                let valueHtml = '';
                
                if (item.type === 'weight_reps') {
                    valueHtml = `${log.weight} kg<br><span class="log-reps">${log.reps} reps</span>`;
                } else if (item.type === 'distance_time') {
                    valueHtml = `${log.distance} km<br><span class="log-reps">${log.duration}</span>`;
                } else if (item.type === 'measure') {
                    valueHtml = `${log.measure_value}`;
                }

                html += `
                <div class="log-card" 
                     onclick="openTraining('${log.id}')"
                     onmousedown="startLongPress('${log.id}')" 
                     onmouseup="cancelLongPress()" 
                     onmouseleave="cancelLongPress()"
                     ontouchstart="startLongPress('${log.id}')" 
                     ontouchend="cancelLongPress()">
                    <div class="log-info">
                        <h3>${item.name}</h3>
                    </div>
                    <div class="log-value">${valueHtml}</div>
                </div>
                `;
            });
        }
        html += `</div>`; // Close date-group
        container.innerHTML += html;
    });
}

// --- FORM LOGIC ---

function populateGroups(selectedGroupId = null) {
    const data = getData();
    const select = document.getElementById('groupSelect');
    select.innerHTML = '';
    data.groups.forEach(g => {
        const option = document.createElement('option');
        option.value = g.id;
        option.text = g.name;
        if (selectedGroupId && g.id === parseInt(selectedGroupId)) option.selected = true;
        select.appendChild(option);
    });
    updateItemOptions();
}

function updateItemOptions(selectedItemId = null) {
    const data = getData();
    const groupSelect = document.getElementById('groupSelect');
    const groupId = parseInt(groupSelect.value);
    const select = document.getElementById('itemSelect');
    select.innerHTML = '';
    
    const items = data.items.filter(i => i.group_id === groupId);
    items.forEach(i => {
        const option = document.createElement('option');
        option.value = i.id;
        option.text = i.name;
        option.setAttribute('data-type', i.type);
        if (selectedItemId && i.id === parseInt(selectedItemId)) option.selected = true;
        select.appendChild(option);
    });
    
    updateFields();
}

function updateFields() {
    const select = document.getElementById('itemSelect');
    if (select.options.length === 0) return;
    
    document.getElementById('weightFields').style.display = 'none';
    document.getElementById('timeDistanceFields').style.display = 'none';
    document.getElementById('measureFields').style.display = 'none';
    document.getElementById('timeRangeFields').style.display = 'none';

    const type = select.options[select.selectedIndex].getAttribute('data-type');
    
    if(type === 'weight_reps') document.getElementById('weightFields').style.display = 'flex';
    if(type === 'distance_time') document.getElementById('timeDistanceFields').style.display = 'flex';
    if(type === 'measure') document.getElementById('measureFields').style.display = 'block';
    if(type === 'time_range') document.getElementById('timeRangeFields').style.display = 'flex';
}

function clearForm() {
    document.getElementById('inpWeight').value = '';
    document.getElementById('inpReps').value = '';
    document.getElementById('inpDuration').value = '';
    document.getElementById('inpDistance').value = '';
    document.getElementById('inpMeasure').value = '';
    document.getElementById('inpStartTime').value = '';
    document.getElementById('inpEndTime').value = '';
}

function saveRecord() {
    const data = getData();
    
    const itemId = parseInt(document.getElementById('itemSelect').value);
    const item = data.items.find(i => i.id === itemId);
    const type = item.type;
    
    let log = {
        id: state.editingLogId || generateUUID(),
        item_id: itemId,
        date: state.selectedDate || getLocalDateStr(),
        timestamp: Date.now()
    };

    if (type === 'weight_reps') {
        log.weight = parseFloat(document.getElementById('inpWeight').value) || 0;
        log.reps = parseInt(document.getElementById('inpReps').value) || 0;
    } else if (type === 'distance_time') {
        log.duration = document.getElementById('inpDuration').value || '';
        log.distance = parseFloat(document.getElementById('inpDistance').value) || 0;
    } else if (type === 'measure') {
        log.measure_value = parseFloat(document.getElementById('inpMeasure').value) || 0;
    } else if (type === 'time_range') {
        log.start_time = document.getElementById('inpStartTime').value || '';
        log.end_time = document.getElementById('inpEndTime').value || '';
    }

    if (state.editingLogId) {
        const index = data.logs.findIndex(l => l.id === state.editingLogId);
        if (index > -1) {
            // preserve original date/timestamp if editing
            log.date = data.logs[index].date;
            log.timestamp = data.logs[index].timestamp;
            data.logs[index] = log;
        }
    } else {
        data.logs.push(log);
    }

    saveData(data);
    goBack();
}

// --- CLONE LOGIC ---
let longPressTimer;
function startLongPress(logId) {
    longPressTimer = setTimeout(() => {
        cloneRecord(logId);
    }, 600); // 600ms for long press
}

function cancelLongPress() {
    clearTimeout(longPressTimer);
}

function cloneRecord(logId) {
    const data = getData();
    const original = data.logs.find(l => l.id === logId);
    if (!original) return;

    const item = data.items.find(i => i.id === parseInt(original.item_id));
    const itemName = item ? item.name : 'Exercise';

    if (confirm(`Do you want to clone "${itemName}"?`)) {
        const cloned = {
            ...original,
            id: generateUUID(),
            timestamp: Date.now() // Newer timestamp so it goes to the bottom of the day
        };
        data.logs.push(cloned);
        saveData(data);
        renderLogs();
        renderCalendar();
    }
}

function deleteRecord() {
    if (!state.editingLogId) return;
    if (confirm("Delete this record?")) {
        const data = getData();
        data.logs = data.logs.filter(l => l.id !== state.editingLogId);
        saveData(data);
        goBack();
    }
}

// --- NAVIGATION ---

function setHeader(title, showBack) {
    document.getElementById('header-title').innerText = title;
    document.getElementById('btn-back').style.display = showBack ? 'block' : 'none';
}

function setMonthOffset(offset) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + offset);
    renderCalendar();
}

function setMonthToday() {
    state.currentMonth = new Date();
    renderCalendar();
}

function goHome() {
    document.getElementById('screen-training').style.transform = 'translateX(100%)';
    document.getElementById('screen-log').style.transform = 'translateX(100%)';
    document.getElementById('screen-home').style.transform = 'translateX(0)';
    document.getElementById('fab-add').style.display = 'none';
    setHeader('Calendar', false);
    state.currentView = 'home';
    renderCalendar();
}

function openLog(dateStr = null) {
    state.selectedDate = dateStr;
    renderLogs();

    document.getElementById('screen-home').style.transform = 'translateX(-30%)';
    document.getElementById('screen-log').style.transform = 'translateX(0)';
    document.getElementById('fab-add').style.display = 'flex';
    setHeader(dateStr ? 'Training Log' : 'All Records', true);
    state.currentView = 'log';
}

function openTraining(logId = null) {
    state.editingLogId = logId;
    clearForm();

    const btnDelete = document.getElementById('btn-delete');

    if (logId) {
        const data = getData();
        const log = data.logs.find(l => l.id === logId);
        if (log) {
            const item = data.items.find(i => i.id === parseInt(log.item_id));
            populateGroups(item.group_id);
            updateItemOptions(log.item_id);

            if (item.type === 'weight_reps') {
                document.getElementById('inpWeight').value = log.weight;
                document.getElementById('inpReps').value = log.reps;
            } else if (item.type === 'distance_time') {
                document.getElementById('inpDuration').value = log.duration;
                document.getElementById('inpDistance').value = log.distance;
            } else if (item.type === 'measure') {
                document.getElementById('inpMeasure').value = log.measure_value;
            } else if (item.type === 'time_range') {
                document.getElementById('inpStartTime').value = log.start_time;
                document.getElementById('inpEndTime').value = log.end_time;
            }
        }
        btnDelete.style.display = 'block';
    } else {
        populateGroups();
        btnDelete.style.display = 'none';
    }

    document.getElementById('screen-log').style.transform = 'translateX(-30%)';
    document.getElementById('screen-training').style.transform = 'translateX(0)';
    document.getElementById('fab-add').style.display = 'none';
    setHeader(logId ? 'Edit Record' : 'New Record', true);
    state.currentView = 'training';
}

function openNewTraining() {
    const data = getData();
    const select = document.getElementById('selNewGroup');
    select.innerHTML = '';
    // Groups excluding Measures
    const groups = data.groups.filter(g => g.name !== 'Measures');
    groups.forEach(g => {
        const option = document.createElement('option');
        option.value = g.id;
        option.text = g.name;
        select.appendChild(option);
    });

    document.getElementById('inpNewTrainingName').value = '';

    // Hide other screens
    document.getElementById('screen-log').style.transform = 'translateX(-30%)';
    document.getElementById('screen-training').style.transform = 'translateX(100%)';
    document.getElementById('screen-new-training').style.transform = 'translateX(0)';
    document.getElementById('fab-add').style.display = 'none';
    setHeader('New Training', true);
    state.currentView = 'new-training';
}

function saveNewTraining() {
    const newName = document.getElementById('inpNewTrainingName').value.trim();
    if (!newName) {
        alert("Please enter a name for the new exercise.");
        return;
    }
    const groupId = parseInt(document.getElementById('selNewGroup').value);
    const type = document.getElementById('selNewTrainingType').value;
    
    const data = getData();
    const newId = Date.now();
    data.items.push({
        id: newId,
        group_id: groupId,
        name: newName,
        type: type
    });
    saveData(data);
    goBack();
}

function goBack() {
    if (state.currentView === 'training') {
        renderLogs();
        document.getElementById('screen-training').style.transform = 'translateX(100%)';
        document.getElementById('screen-log').style.transform = 'translateX(0)';
        document.getElementById('fab-add').style.display = 'flex';
        setHeader(state.selectedDate ? 'Training Log' : 'All Records', true);
        state.currentView = 'log';
    } else if (state.currentView === 'new-training') {
        document.getElementById('screen-new-training').style.transform = 'translateX(100%)';
        document.getElementById('screen-log').style.transform = 'translateX(0)';
        document.getElementById('fab-add').style.display = 'flex';
        setHeader(state.selectedDate ? 'Training Log' : 'Calendar', state.selectedDate ? true : false);
        state.currentView = state.selectedDate ? 'log' : 'home';
        if (state.currentView === 'home') goHome(); // Ensure home triggers calendar render
    } else if (state.currentView === 'metrics') {
        document.getElementById('screen-metrics').style.transform = 'translateX(100%)';
        document.getElementById('screen-log').style.transform = 'translateX(0)';
        document.getElementById('fab-add').style.display = 'flex';
        setHeader(state.selectedDate ? 'Training Log' : 'Calendar', state.selectedDate ? true : false);
        state.currentView = state.selectedDate ? 'log' : 'home';
        if (state.currentView === 'home') goHome();
    } else if (state.currentView === 'log') {
        goHome();
    }
}

function toggleDrawer() {
    document.getElementById('app').classList.toggle('drawer-open');
}

function downloadData() {
    const data = getData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "fitness_data_backup.json");
    dlAnchorElem.click();
    toggleDrawer();
}

function uploadData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.groups && data.items && data.logs) {
                saveData(data);
                alert("Data uploaded successfully!");
                location.reload(); // Reload to apply the new data everywhere
            } else {
                alert("Invalid JSON format. Make sure it is a valid fitness app backup.");
            }
        } catch (err) {
            alert("Error reading JSON file.");
        }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again if needed
    event.target.value = '';
}

// --- METRICS ---
let chartInstance = null;

function getWeekString(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2,'0');
}

function getMonthString(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

function getYearString(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getFullYear().toString();
}

function parseTimeRangeToMins(t1, t2) {
    if (!t1 || !t2) return 0;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    let tm = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (tm < 0) tm += 24 * 60;
    return tm;
}

function openMetrics() {
    const data = getData();
    const selectGroup = document.getElementById('metricGroupSelect');
    selectGroup.innerHTML = '';
    data.groups.forEach(g => {
        const option = document.createElement('option');
        option.value = g.id;
        option.text = g.name;
        selectGroup.appendChild(option);
    });

    updateMetricItemOptions();

    // Hide other screens
    document.getElementById('screen-log').style.transform = 'translateX(-30%)';
    document.getElementById('screen-training').style.transform = 'translateX(100%)';
    document.getElementById('screen-new-training').style.transform = 'translateX(100%)';
    document.getElementById('screen-metrics').style.transform = 'translateX(0)';
    document.getElementById('fab-add').style.display = 'none';
    setHeader('Metrics', true);
    state.currentView = 'metrics';
}

function updateMetricItemOptions() {
    const data = getData();
    const groupId = parseInt(document.getElementById('metricGroupSelect').value);
    const selectItem = document.getElementById('metricItemSelect');
    selectItem.innerHTML = '';
    
    const items = data.items.filter(i => i.group_id === groupId);
    items.forEach(i => {
        const option = document.createElement('option');
        option.value = i.id;
        option.text = i.name;
        option.setAttribute('data-type', i.type);
        selectItem.appendChild(option);
    });
    
    renderChart();
}

function renderChart() {
    const data = getData();
    const itemSelect = document.getElementById('metricItemSelect');
    if (!itemSelect.value) return; // Prevent errors if group has no items
    
    const itemId = parseInt(itemSelect.value);
    const item = data.items.find(i => i.id === itemId);
    const timeframe = document.getElementById('metricTimeframeSelect').value;
    
    if (!item) return;

    let logs = data.logs.filter(l => parseInt(l.item_id) === itemId);
    logs.sort((a,b) => new Date(a.date) - new Date(b.date));

    const grouped = {};
    logs.forEach(l => {
        let key = l.date;
        if (timeframe === 'weeks') key = getWeekString(l.date);
        else if (timeframe === 'months') key = getMonthString(l.date);
        else if (timeframe === 'years') key = getYearString(l.date);

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(l);
    });

    const labels = Object.keys(grouped);
    const values = [];

    labels.forEach(key => {
        const arr = grouped[key];
        let val = 0;
        
        if (item.type === 'weight_reps') {
            val = arr.reduce((sum, l) => sum + (l.weight * l.reps), 0);
        } else if (item.type === 'distance_time') {
            val = arr.reduce((sum, l) => sum + l.distance, 0);
        } else if (item.type === 'measure') {
            const sum = arr.reduce((s, l) => s + l.measure_value, 0);
            val = sum / arr.length;
        } else if (item.type === 'time_range') {
            val = arr.reduce((sum, l) => sum + parseTimeRangeToMins(l.start_time, l.end_time), 0);
        }
        values.push(parseFloat(val.toFixed(2)));
    });

    let yLabel = 'Value';
    if (item.type === 'weight_reps') yLabel = 'Total Volume (kg)';
    if (item.type === 'distance_time') yLabel = 'Total Distance (km)';
    if (item.type === 'measure') yLabel = 'Average Value';
    if (item.type === 'time_range') yLabel = 'Total Time (mins)';

    document.getElementById('metricSummary').innerText = `Total periods analyzed: ${labels.length}`;

    const ctx = document.getElementById('metricsChart').getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: yLabel,
                data: values,
                backgroundColor: 'rgba(0, 229, 255, 0.7)',
                borderColor: '#00e5ff',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#a0a0a0' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0a0' }
                }
            },
            plugins: {
                legend: { labels: { color: '#ffffff' } }
            }
        }
    });
}

// Swipe to go back logic
let touchstartX = 0;
let touchendX = 0;

document.getElementById('swipe-area').addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
});

document.getElementById('swipe-area').addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    if (touchendX - touchstartX > 100) { 
        goBack();
    }
}

// --- CLONE LOGIC ---
let longPressTimer;
function startLongPress(logId) {
    longPressTimer = setTimeout(() => {
        cloneRecord(logId);
    }, 800); // 800ms for long press to avoid accidental triggers
}

function cancelLongPress() {
    clearTimeout(longPressTimer);
}

function cloneRecord(logId) {
    const data = getData();
    const original = data.logs.find(l => l.id === logId);
    if (!original) return;

    const item = data.items.find(i => i.id === parseInt(original.item_id));
    const itemName = item ? item.name : 'Exercise';

    if (confirm(`Do you want to clone "${itemName}" with its current values?`)) {
        const cloned = {
            ...original,
            id: generateUUID(),
            timestamp: Date.now() // Newer timestamp so it goes to the bottom of the day
        };
        data.logs.push(cloned);
        saveData(data);
        renderLogs();
        renderCalendar();
    }
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    renderCalendar();
});
