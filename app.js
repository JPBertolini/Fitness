// --- DATABASE & STATE ---
const STORE_KEY = 'fitness_app_data';

let state = {
    currentView: 'home',
    selectedDate: null, 
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
                { id: 1, name: 'Chest' }, { id: 2, name: 'Back' }, { id: 3, name: 'Legs' },
                { id: 4, name: 'Biceps' }, { id: 5, name: 'Triceps' }, { id: 6, name: 'Shoulders' },
                { id: 7, name: 'Cardio' }, { id: 8, name: 'Abs' }, { id: 9, name: 'Measures' }
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
    return data;
}

function saveData(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

// --- RENDERING ---

function formatDate(dateStr) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', options);
}

function renderCalendar() {
    try {
        const data = getData();
        const grid = document.getElementById('calendar-grid');
        const monthTitle = document.getElementById('month-title');
        
        grid.innerHTML = '<div class="weekday">M</div><div class="weekday">T</div><div class="weekday">W</div><div class="weekday">T</div><div class="weekday">F</div><div class="weekday">S</div><div class="weekday">S</div>';

        const year = state.currentMonth.getFullYear();
        const month = state.currentMonth.getMonth();
        
        const options = { month: 'long', year: 'numeric' };
        monthTitle.innerText = state.currentMonth.toLocaleDateString('en-US', options);

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

        for (let i = 0; i < startDayIndex; i++) {
            grid.innerHTML += '<div class="day empty"></div>';
        }

        const todayStr = getLocalDateStr();
        const activeDates = new Set((data.logs || []).map(log => log.date));

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let classes = ['day'];
            let innerHtml = `${day}`;

            if (dateStr === todayStr) classes.push('today');
            if (activeDates.has(dateStr)) {
                classes.push('active-day');
                innerHtml += '<div class="dot"></div>';
            }

            grid.innerHTML += `<div class="${classes.join(' ')}" onclick="openLog('${dateStr}')">${innerHtml}</div>`;
        }
    } catch (e) {
        console.error("Calendar Render Error", e);
    }
}

function calculateTimeDuration(startTime, endTime) {
    if (!startTime || !endTime) return null;
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function renderLogs() {
    const data = getData();
    const container = document.getElementById('log-container');
    container.innerHTML = '';

    let logs = data.logs || [];
    
    logs.sort((a, b) => {
        const da = a.date || "";
        const db = b.date || "";
        if (db !== da) return db.localeCompare(da);
        return (a.timestamp || 0) - (b.timestamp || 0);
    });

    if (state.selectedDate) {
        logs = logs.filter(log => log.date === state.selectedDate);
    }

    if (logs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 50px;">No records found.</p>';
        return;
    }

    const groupedByDate = {};
    logs.forEach(log => {
        if (!groupedByDate[log.date]) groupedByDate[log.date] = [];
        groupedByDate[log.date].push(log);
    });

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

    sortedDates.forEach(dateStr => {
        const dayLogs = groupedByDate[dateStr];
        const timeLog = dayLogs.find(l => {
            const item = data.items.find(i => i.id === parseInt(l.item_id));
            return item && item.type === 'time_range';
        });

        let timeHtml = '';
        if (timeLog && timeLog.start_time && timeLog.end_time) {
            const dur = calculateTimeDuration(timeLog.start_time, timeLog.end_time);
            timeHtml = `<div class="training-time" onclick="openTraining('${timeLog.id}')"><ion-icon name="time-outline"></ion-icon> ${dur}</div>`;
        }

        const isToday = dateStr === getLocalDateStr();
        const header = isToday ? `Today - ${formatDate(dateStr)}` : formatDate(dateStr);

        let html = `<div class="date-group"><div class="date-header-block"><div class="date-header">${header}</div>${timeHtml}</div>`;

        const groupedByGroup = {};
        dayLogs.forEach(log => {
            const item = data.items.find(i => i.id === parseInt(log.item_id));
            if (!item || item.type === 'time_range') return;
            const group = data.groups.find(g => g.id === item.group_id);
            const gName = group ? group.name : 'Other';
            if (!groupedByGroup[gName]) groupedByGroup[gName] = [];
            groupedByGroup[gName].push({ log, item });
        });

        for (const [gName, records] of Object.entries(groupedByGroup)) {
            html += `<div class="group-header">${gName}</div>`;
            records.forEach(r => {
                const { log, item } = r;
                let valHtml = '';
                if (item.type === 'weight_reps') valHtml = `${log.weight} kg<br><span class="log-reps">${log.reps} reps</span>`;
                else if (item.type === 'distance_time') valHtml = `${log.distance} km<br><span class="log-reps">${log.duration}</span>`;
                else if (item.type === 'measure') valHtml = `${log.measure_value}`;

                html += `
                <div class="log-card" onclick="openTraining('${log.id}')" onmousedown="startLongPress('${log.id}')" onmouseup="cancelLongPress()" onmouseleave="cancelLongPress()" ontouchstart="startLongPress('${log.id}')" ontouchend="cancelLongPress()">
                    <div class="log-info"><h3>${item.name}</h3></div>
                    <div class="log-value">${valHtml}</div>
                </div>`;
            });
        }
        html += `</div>`;
        container.innerHTML += html;
    });
}

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
    const groupId = parseInt(document.getElementById('groupSelect').value);
    const select = document.getElementById('itemSelect');
    select.innerHTML = '';
    data.items.filter(i => i.group_id === groupId).forEach(i => {
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
    ['weightFields', 'timeDistanceFields', 'measureFields', 'timeRangeFields'].forEach(id => document.getElementById(id).style.display = 'none');
    const type = select.options[select.selectedIndex].getAttribute('data-type');
    if(type === 'weight_reps') document.getElementById('weightFields').style.display = 'flex';
    if(type === 'distance_time') document.getElementById('timeDistanceFields').style.display = 'flex';
    if(type === 'measure') document.getElementById('measureFields').style.display = 'block';
    if(type === 'time_range') document.getElementById('timeRangeFields').style.display = 'flex';
}

function clearForm() {
    ['inpWeight', 'inpReps', 'inpDuration', 'inpDistance', 'inpMeasure', 'inpStartTime', 'inpEndTime'].forEach(id => document.getElementById(id).value = '');
}

function saveRecord() {
    const data = getData();
    const itemId = parseInt(document.getElementById('itemSelect').value);
    const item = data.items.find(i => i.id === itemId);
    let log = { id: state.editingLogId || generateUUID(), item_id: itemId, date: state.selectedDate || getLocalDateStr(), timestamp: Date.now() };

    if (item.type === 'weight_reps') {
        log.weight = parseFloat(document.getElementById('inpWeight').value) || 0;
        log.reps = parseInt(document.getElementById('inpReps').value) || 0;
    } else if (item.type === 'distance_time') {
        log.duration = document.getElementById('inpDuration').value || '';
        log.distance = parseFloat(document.getElementById('inpDistance').value) || 0;
    } else if (item.type === 'measure') {
        log.measure_value = parseFloat(document.getElementById('inpMeasure').value) || 0;
    } else if (item.type === 'time_range') {
        log.start_time = document.getElementById('inpStartTime').value || '';
        log.end_time = document.getElementById('inpEndTime').value || '';
    }

    if (state.editingLogId) {
        const idx = data.logs.findIndex(l => l.id === state.editingLogId);
        if (idx > -1) { log.date = data.logs[idx].date; log.timestamp = data.logs[idx].timestamp; data.logs[idx] = log; }
    } else { data.logs.push(log); }

    saveData(data);
    goBack();
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

// --- CLONE LOGIC ---
let longPressTimer;
function startLongPress(logId) { longPressTimer = setTimeout(() => cloneRecord(logId), 800); }
function cancelLongPress() { clearTimeout(longPressTimer); }
function cloneRecord(logId) {
    const data = getData();
    const original = data.logs.find(l => l.id === logId);
    if (!original) return;
    const item = data.items.find(i => i.id === parseInt(original.item_id));
    if (confirm(`Clone "${item ? item.name : 'Exercise'}"?`)) {
        const cloned = { ...original, id: generateUUID(), timestamp: Date.now() };
        data.logs.push(cloned);
        saveData(data);
        renderLogs();
        renderCalendar();
    }
}

// --- NAVIGATION ---
function setHeader(t, b) { document.getElementById('header-title').innerText = t; document.getElementById('btn-back').style.display = b ? 'block' : 'none'; }
function setMonthOffset(o) { state.currentMonth.setMonth(state.currentMonth.getMonth() + o); renderCalendar(); }
function setMonthToday() { state.currentMonth = new Date(); renderCalendar(); }
function toggleDrawer() { document.getElementById('app').classList.toggle('drawer-open'); }

function goHome() {
    ['screen-training', 'screen-log', 'screen-new-training', 'screen-metrics'].forEach(id => document.getElementById(id).style.transform = 'translateX(100%)');
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
            if (item.type === 'weight_reps') { document.getElementById('inpWeight').value = log.weight; document.getElementById('inpReps').value = log.reps; }
            else if (item.type === 'distance_time') { document.getElementById('inpDuration').value = log.duration; document.getElementById('inpDistance').value = log.distance; }
            else if (item.type === 'measure') { document.getElementById('inpMeasure').value = log.measure_value; }
            else if (item.type === 'time_range') { document.getElementById('inpStartTime').value = log.start_time; document.getElementById('inpEndTime').value = log.end_time; }
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
    data.groups.filter(g => g.name !== 'Measures').forEach(g => {
        const option = document.createElement('option');
        option.value = g.id; option.text = g.name; select.appendChild(option);
    });
    document.getElementById('inpNewTrainingName').value = '';
    document.getElementById('screen-log').style.transform = 'translateX(-30%)';
    document.getElementById('screen-new-training').style.transform = 'translateX(0)';
    setHeader('New Training', true);
    state.currentView = 'new-training';
}

function saveNewTraining() {
    const name = document.getElementById('inpNewTrainingName').value.trim();
    if (!name) return alert("Name required");
    const data = getData();
    data.items.push({ id: Date.now(), group_id: parseInt(document.getElementById('selNewGroup').value), name: name, type: document.getElementById('selNewTrainingType').value });
    saveData(data);
    goBack();
}

function goBack() {
    if (state.currentView === 'training' || state.currentView === 'new-training' || state.currentView === 'metrics') {
        renderLogs();
        document.getElementById('screen-training').style.transform = 'translateX(100%)';
        document.getElementById('screen-new-training').style.transform = 'translateX(100%)';
        document.getElementById('screen-metrics').style.transform = 'translateX(100%)';
        document.getElementById('screen-log').style.transform = 'translateX(0)';
        document.getElementById('fab-add').style.display = 'flex';
        setHeader(state.selectedDate ? 'Training Log' : 'All Records', true);
        state.currentView = 'log';
    } else if (state.currentView === 'log') {
        goHome();
    }
}

function downloadData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getData(), null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "fitness_data.json"); dl.click();
    toggleDrawer();
}

function uploadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.logs) { saveData(data); location.reload(); }
            else { alert("Invalid format"); }
        } catch (err) { alert("Error reading file"); }
    };
    reader.readAsText(file);
}

// --- METRICS ---
let chartInstance = null;
function openMetrics() {
    const data = getData();
    const select = document.getElementById('metricGroupSelect');
    select.innerHTML = '';
    data.groups.forEach(g => { const o = document.createElement('option'); o.value = g.id; o.text = g.name; select.appendChild(o); });
    updateMetricItemOptions();
    document.getElementById('screen-log').style.transform = 'translateX(-30%)';
    document.getElementById('screen-metrics').style.transform = 'translateX(0)';
    setHeader('Metrics', true);
    state.currentView = 'metrics';
}

function updateMetricItemOptions() {
    const data = getData();
    const groupId = parseInt(document.getElementById('metricGroupSelect').value);
    const select = document.getElementById('metricItemSelect');
    select.innerHTML = '';
    data.items.filter(i => i.group_id === groupId).forEach(i => {
        const o = document.createElement('option'); o.value = i.id; o.text = i.name; o.setAttribute('data-type', i.type); select.appendChild(o);
    });
    renderChart();
}

function renderChart() {
    const data = getData();
    const itemSelect = document.getElementById('metricItemSelect');
    if (!itemSelect.value) return;
    const item = data.items.find(i => i.id === parseInt(itemSelect.value));
    const timeframe = document.getElementById('metricTimeframeSelect').value;
    let logs = data.logs.filter(l => parseInt(l.item_id) === item.id);
    logs.sort((a,b) => new Date(a.date) - new Date(b.date));

    const grouped = {};
    logs.forEach(l => {
        let key = l.date;
        const d = new Date(l.date + 'T12:00:00');
        if (timeframe === 'months') key = d.getFullYear() + '-' + (d.getMonth()+1);
        if (timeframe === 'years') key = d.getFullYear();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(l);
    });

    const labels = Object.keys(grouped);
    const values = labels.map(key => {
        const arr = grouped[key];
        if (item.type === 'weight_reps') return arr.reduce((s, l) => s + (l.weight * l.reps), 0);
        if (item.type === 'distance_time') return arr.reduce((s, l) => s + l.distance, 0);
        if (item.type === 'measure') return arr.reduce((s, l) => s + l.measure_value, 0) / arr.length;
        return 0;
    });

    const ctx = document.getElementById('metricsChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: item.name, data: values, backgroundColor: '#00e5ff' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    renderCalendar();
});
