import './style.css';
const video = document.querySelector('#video');
const select = document.querySelector('#camera-select');
const errorEl = document.querySelector('#error');
const supportedConstraintsList = document.querySelector('#constraints');
const cameraConstraintsList = document.querySelector('#camera-constraints');
const trackInfoList = document.querySelector('#track-info');
const settingsSection = document.querySelector('#settings');
if (!video || !select || !errorEl || !supportedConstraintsList || !cameraConstraintsList || !trackInfoList || !settingsSection) {
    throw new Error('Missing required DOM elements');
}
const SKIP_CAPABILITIES = new Set(['deviceId', 'groupId']);
function createSettingRow(name, capability, currentValue) {
    let input;
    if (typeof capability === 'boolean') {
        const el = document.createElement('input');
        el.type = 'checkbox';
        el.id = name;
        input = el;
    }
    else if (Array.isArray(capability)) {
        const el = document.createElement('select');
        el.id = name;
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '— none —';
        el.appendChild(empty);
        capability.forEach((val) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            el.appendChild(opt);
        });
        input = el;
    }
    else if (typeof capability === 'object' && capability !== null) {
        const el = document.createElement('input');
        el.type = 'number';
        el.id = name;
        if (capability.min !== undefined)
            el.min = String(capability.min);
        if (capability.max !== undefined)
            el.max = String(capability.max);
        if (capability.step !== undefined)
            el.step = String(capability.step);
        input = el;
    }
    else {
        return null;
    }
    const row = document.createElement('section');
    const label = document.createElement('span');
    label.textContent = name;
    row.appendChild(label);
    const valueEl = document.createElement('span');
    valueEl.dataset.settingValue = name;
    valueEl.textContent = currentValue !== undefined ? String(currentValue) : '—';
    row.appendChild(valueEl);
    row.appendChild(input);
    return row;
}
function updateSettingValues(subsection, track) {
    const settings = track.getSettings();
    for (const [name, value] of Object.entries(settings)) {
        const el = subsection.querySelector(`[data-setting-value="${name}"]`);
        if (el)
            el.textContent = String(value);
    }
}
function collectConstraints(subsection) {
    const constraints = {};
    subsection.querySelectorAll('input, select').forEach((el) => {
        if (!el.id)
            return;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            constraints[el.id] = el.checked;
        }
        else if (el instanceof HTMLInputElement && el.type === 'number') {
            if (el.value !== '')
                constraints[el.id] = Number(el.value);
        }
        else if (el instanceof HTMLSelectElement) {
            if (el.value !== '')
                constraints[el.id] = el.value;
        }
    });
    return constraints;
}
async function applyTrackConstraints(subsection) {
    if (!activeStream)
        return;
    const trackId = subsection.dataset.trackId;
    const track = activeStream.getTracks().find((t) => t.id === trackId);
    if (!track)
        return;
    try {
        await track.applyConstraints(collectConstraints(subsection));
        updateSettingValues(subsection, track);
        errorEl.textContent = '';
    }
    catch {
        showError(`Failed to apply constraints to ${track.kind} track.`);
    }
}
function renderSettings(stream) {
    const header = settingsSection.querySelector('h2');
    settingsSection.replaceChildren(header);
    stream.getTracks().forEach((track) => {
        const subsection = document.createElement('section');
        subsection.dataset.trackId = track.id;
        const title = document.createElement('h3');
        title.textContent = `${track.kind} — ${track.label}`;
        subsection.appendChild(title);
        const capabilities = track.getCapabilities?.() ?? {};
        const settings = track.getSettings();
        for (const [name, value] of Object.entries(capabilities)) {
            if (SKIP_CAPABILITIES.has(name))
                continue;
            const row = createSettingRow(name, value, settings[name]);
            if (row)
                subsection.appendChild(row);
        }
        settingsSection.appendChild(subsection);
    });
}
settingsSection.addEventListener('change', (e) => {
    const subsection = e.target.closest('section[data-track-id]');
    if (subsection)
        applyTrackConstraints(subsection);
});
function renderCameraConstraints() {
    cameraConstraintsList.replaceChildren();
    const supported = navigator.mediaDevices.getSupportedConstraints();
    for (const [name, value] of Object.entries(supported)) {
        const li = document.createElement('li');
        li.textContent = `${name}: ${value}`;
        cameraConstraintsList.appendChild(li);
    }
}
function createNestedList(entries) {
    const ul = document.createElement('ul');
    for (const [key, value] of Object.entries(entries)) {
        const li = document.createElement('li');
        li.textContent = `${key}: ${JSON.stringify(value)}`;
        ul.appendChild(li);
    }
    return ul;
}
function renderTrackInfo(stream) {
    trackInfoList.replaceChildren();
    stream.getTracks().forEach((track) => {
        const li = document.createElement('li');
        const trackHeader = document.createElement('h2');
        trackHeader.textContent = `${track.kind} — ${track.label} [${track.readyState}]`;
        li.appendChild(trackHeader);
        const capabilitiesHeader = document.createElement('h3');
        capabilitiesHeader.textContent = 'Capabilities';
        li.appendChild(capabilitiesHeader);
        li.appendChild(createNestedList(track.getCapabilities?.() ?? {}));
        const constraintsHeader = document.createElement('h3');
        constraintsHeader.textContent = 'Constraints';
        li.appendChild(constraintsHeader);
        li.appendChild(createNestedList(track.getConstraints()));
        trackInfoList.appendChild(li);
    });
}
function renderSupportedConstraints() {
    const supported = navigator.mediaDevices.getSupportedConstraints();
    for (const [name, value] of Object.entries(supported)) {
        const li = document.createElement('li');
        li.textContent = `${name}: ${value}`;
        supportedConstraintsList.appendChild(li);
    }
}
let activeStream = null;
const devices = new Map();
function showError(message) {
    errorEl.textContent = message;
}
async function enumerateDevices() {
    devices.clear();
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    allDevices
        .filter((d) => d.kind === 'videoinput')
        .forEach((d) => devices.set(d.deviceId, d));
}
function populateSelect() {
    const currentValue = select.value;
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select camera —';
    select.appendChild(placeholder);
    for (const [id, device] of devices) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = device.label || `Camera ${select.options.length}`;
        select.appendChild(option);
    }
    if (currentValue && devices.has(currentValue)) {
        select.value = currentValue;
    }
}
async function attachCamera(deviceId) {
    if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
        activeStream = null;
        video.srcObject = null;
    }
    if (!deviceId)
        return;
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: true,
        });
        video.srcObject = activeStream;
        await video.play();
        renderTrackInfo(activeStream);
        renderSettings(activeStream);
        errorEl.textContent = '';
    }
    catch {
        trackInfoList.replaceChildren();
        showError('Unable to access the selected camera.');
    }
}
select.addEventListener('change', () => {
    if (select.value) {
        renderCameraConstraints();
    }
    else {
        cameraConstraintsList.replaceChildren();
        trackInfoList.replaceChildren();
        const header = settingsSection.querySelector('h2');
        settingsSection.replaceChildren(header);
    }
    attachCamera(select.value);
});
navigator.mediaDevices.addEventListener('devicechange', async () => {
    await enumerateDevices();
    populateSelect();
});
renderSupportedConstraints();
try {
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    tempStream.getTracks().forEach((t) => t.stop());
    await enumerateDevices();
    populateSelect();
}
catch {
    showError('Unable to access camera devices. Please grant permission and reload.');
}
