// LUMINAE — Face Recognition App
// face-api.js powered, 100% in-browser

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

let probeDescriptor = null;
let eventFiles = [];
let matchResults = [];
let currentLightboxResult = null;

// ─── BOOT SEQUENCE ───────────────────────────────────────────────────────────
const bootMessages = [
  'LOADING NEURAL WEIGHTS...',
  'CALIBRATING FACE DETECTOR...',
  'INITIALIZING LANDMARK ENGINE...',
  'LOADING RECOGNITION MODEL...',
  'SYSTEM ONLINE.',
];

async function boot() {
  const bar = document.getElementById('boot-bar');
  const status = document.getElementById('boot-status');

  const steps = [
    () => faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    () => faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    () => faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ];

  for (let i = 0; i < steps.length; i++) {
    status.textContent = bootMessages[i];
    bar.style.width = ((i / steps.length) * 80) + '%';
    try { await steps[i](); } catch (e) { console.error('Model load error:', e); }
  }

  bar.style.width = '100%';
  status.textContent = bootMessages[bootMessages.length - 1];
  await delay(600);

  const bootScreen = document.getElementById('boot-screen');
  bootScreen.style.opacity = '0';
  await delay(800);
  bootScreen.classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  setStatus('SYSTEM READY');
  bindEvents();
}

// ─── BIND EVENTS ─────────────────────────────────────────────────────────────
function bindEvents() {
  // Probe input
  const probeInput = document.getElementById('probe-input');
  probeInput.addEventListener('change', (e) => handleProbeFile(e.target.files[0]));

  // Probe zone drag & drop + click
  const probeZone = document.getElementById('probe-zone');
  probeZone.addEventListener('click', () => probeInput.click());
  probeZone.addEventListener('dragover', (e) => { e.preventDefault(); probeZone.classList.add('drag-over'); });
  probeZone.addEventListener('dragleave', () => probeZone.classList.remove('drag-over'));
  probeZone.addEventListener('drop', (e) => {
    e.preventDefault();
    probeZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleProbeFile(file);
  });

  // Event photos input
  const eventInput = document.getElementById('event-input');
  eventInput.addEventListener('change', (e) => handleEventFiles(e.target.files));

  // Scan button
  document.getElementById('btn-scan').addEventListener('click', runScan);

  // Download button
  document.getElementById('btn-download').addEventListener('click', downloadZip);

  // Threshold slider
  const slider = document.getElementById('threshold-slider');
  slider.addEventListener('input', () => {
    document.getElementById('threshold-val').textContent = slider.value + '%';
  });
}

// ─── PROBE FILE ───────────────────────────────────────────────────────────────
async function handleProbeFile(file) {
  if (!file) return;
  setStatus('ANALYZING PROBE IMAGE...');

  const img = await fileToImage(file);
  const canvas = document.getElementById('probe-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  canvas.classList.remove('hidden');
  document.getElementById('probe-inner').classList.add('hidden');

  document.getElementById('probe-data').classList.remove('hidden');
  document.getElementById('probe-status-val').textContent = 'PROCESSING...';

  const detections = await faceapi
    .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  const probeData = document.getElementById('probe-data');
  probeData.classList.remove('hidden');

  if (!detections.length) {
    document.getElementById('probe-status-val').textContent = 'NO FACE DETECTED';
    document.getElementById('probe-faces-val').textContent = '0';
    document.getElementById('probe-conf-val').textContent = '—';
    setStatus('ERROR: NO FACE IN PROBE IMAGE');
    probeDescriptor = null;
    updateScanButton();
    return;
  }

  // Draw bounding box on probe
  const best = detections[0];
  const box = best.detection.box;
  const scaleX = canvas.width / canvas.offsetWidth;
  const scaleY = canvas.height / canvas.offsetHeight;

  ctx.strokeStyle = '#00ff6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  // corner marks
  const cs = 12;
  ctx.strokeStyle = '#00ff6a';
  ctx.lineWidth = 2;
  [[box.x, box.y],[box.x+box.width-cs, box.y],[box.x, box.y+box.height-cs],[box.x+box.width-cs, box.y+box.height-cs]].forEach(([x,y]) => {
    ctx.strokeRect(x, y, cs, cs);
  });

  probeDescriptor = best.descriptor;
  const score = Math.round(best.detection.score * 100);

  document.getElementById('probe-status-val').textContent = 'FACE LOCKED';
  document.getElementById('probe-faces-val').textContent = detections.length;
  document.getElementById('probe-conf-val').textContent = score + '%';

  setStatus('PROBE LOCKED — READY TO SCAN');
  updateScanButton();
}

// ─── EVENT FILES ──────────────────────────────────────────────────────────────
async function handleEventFiles(files) {
  eventFiles = Array.from(files);
  document.getElementById('event-count').textContent = eventFiles.length + ' files';
  document.getElementById('stat-total').textContent = eventFiles.length;
  setStatus(`${eventFiles.length} EVENT PHOTOS LOADED`);
  updateScanButton();
}

function updateScanButton() {
  const btn = document.getElementById('btn-scan');
  btn.disabled = !(probeDescriptor && eventFiles.length > 0);
}

// ─── RUN SCAN ─────────────────────────────────────────────────────────────────
async function runScan() {
  if (!probeDescriptor || !eventFiles.length) return;

  setStatus('SCANNING EVENT PHOTOS...');
  document.getElementById('btn-scan').disabled = true;

  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const progressPct = document.getElementById('progress-pct');
  const progressLabel = document.getElementById('progress-label-text');
  progressWrap.classList.remove('hidden');

  const threshold = parseInt(document.getElementById('threshold-slider').value) / 100;
  const distanceThreshold = 1 - threshold;

  matchResults = [];
  const seenHashes = new Set();
  let dupeCount = 0;

  for (let i = 0; i < eventFiles.length; i++) {
    const file = eventFiles[i];
    progressLabel.textContent = `SCANNING ${i + 1}/${eventFiles.length}`;
    const pct = Math.round(((i + 1) / eventFiles.length) * 100);
    progressFill.style.width = pct + '%';
    progressPct.textContent = pct + '%';

    try {
      const img = await fileToImage(file);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Duplicate detection via pixel hash
      const hash = await quickHash(canvas);
      let isDupe = seenHashes.has(hash);
      if (!isDupe) seenHashes.add(hash);
      else dupeCount++;

      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections.length) continue;

      let bestMatch = null;
      let bestDistance = Infinity;

      for (const det of detections) {
        const distance = faceapi.euclideanDistance(probeDescriptor, det.descriptor);
        if (distance < bestDistance) { bestDistance = distance; bestMatch = det; }
      }

      if (bestDistance <= distanceThreshold) {
        const confidence = Math.round((1 - bestDistance) * 100);

        // Draw boxes on canvas
        ctx.strokeStyle = '#00ff6a';
        ctx.lineWidth = Math.max(2, canvas.width / 300);
        for (const det of detections) {
          const b = det.detection.box;
          ctx.strokeRect(b.x, b.y, b.width, b.height);
          // face count label
          ctx.fillStyle = '#00ff6a';
          ctx.font = `${Math.max(12, canvas.width / 60)}px monospace`;
        }

        // Highlight matched face
        const mb = bestMatch.detection.box;
        ctx.strokeStyle = '#00ff6a';
        ctx.lineWidth = Math.max(3, canvas.width / 200);
        ctx.strokeRect(mb.x, mb.y, mb.width, mb.height);

        // Draw corner brackets on matched face
        const cs = mb.width * 0.15;
        ctx.lineWidth = Math.max(3, canvas.width / 200);
        [[mb.x, mb.y, cs, cs, 1, 1],[mb.x+mb.width, mb.y, -cs, cs, -1, 1],[mb.x, mb.y+mb.height, cs, -cs, 1, -1],[mb.x+mb.width, mb.y+mb.height, -cs, -cs, -1, -1]].forEach(([x,y,w,h]) => {
          ctx.beginPath(); ctx.moveTo(x+w, y); ctx.lineTo(x, y); ctx.lineTo(x, y+h); ctx.stroke();
        });

        // Confidence label
        ctx.fillStyle = '#000d07';
        ctx.fillRect(mb.x, mb.y - Math.max(18, canvas.width/40) - 2, Math.max(70, canvas.width/8), Math.max(18, canvas.width/40) + 4);
        ctx.fillStyle = '#00ff6a';
        ctx.font = `bold ${Math.max(12, canvas.width/60)}px monospace`;
        ctx.fillText(confidence + '% MATCH', mb.x + 4, mb.y - 4);

        matchResults.push({ file, canvas, confidence, faceCount: detections.length, isDupe });
      }
    } catch (err) {
      console.error('Error scanning', file.name, err);
    }
  }

  // Sort by confidence
  matchResults.sort((a, b) => b.confidence - a.confidence);

  document.getElementById('stat-matched').textContent = matchResults.length;
  document.getElementById('stat-dupes').textContent = dupeCount;
  document.getElementById('results-count').textContent = matchResults.length + ' found';

  progressWrap.classList.add('hidden');
  renderResults();

  document.getElementById('btn-scan').disabled = false;
  document.getElementById('btn-download').disabled = matchResults.length === 0;
  setStatus(`SCAN COMPLETE — ${matchResults.length} MATCHES FOUND`);
  showToast(`[ ${matchResults.length} MATCHES FOUND ]`);
}

// ─── RENDER RESULTS ───────────────────────────────────────────────────────────
function renderResults() {
  const grid = document.getElementById('results-grid');
  const empty = document.getElementById('results-empty');

  grid.innerHTML = '';

  if (!matchResults.length) {
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  matchResults.forEach((result, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.onclick = () => openLightbox(result);

    const thumb = document.createElement('canvas');
    thumb.width = result.canvas.width;
    thumb.height = result.canvas.height;
    thumb.getContext('2d').drawImage(result.canvas, 0, 0);

    const corners = document.createElement('div');
    corners.className = 'card-corners';
    corners.innerHTML = '<span class="cc tl"></span><span class="cc tr"></span><span class="cc bl"></span><span class="cc br"></span>';

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML = `
      <div class="card-conf">${result.confidence}% MATCH</div>
      <div class="card-name">${result.file.name}</div>
      <div class="card-faces">▣ ${result.faceCount} face${result.faceCount !== 1 ? 's' : ''}</div>
    `;

    const badge = document.createElement('div');
    badge.className = 'card-badge';
    badge.textContent = '#' + String(idx + 1).padStart(2, '0');

    card.appendChild(thumb);
    card.appendChild(corners);
    card.appendChild(badge);
    if (result.isDupe) {
      const dupe = document.createElement('div');
      dupe.className = 'card-dupe';
      dupe.textContent = 'DUPE';
      card.appendChild(dupe);
    }
    card.appendChild(meta);
    grid.appendChild(card);
  });
}

// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────
function openLightbox(result) {
  currentLightboxResult = result;
  const lb = document.getElementById('lightbox');
  const lbCanvas = document.getElementById('lb-canvas');
  lbCanvas.width = result.canvas.width;
  lbCanvas.height = result.canvas.height;
  lbCanvas.getContext('2d').drawImage(result.canvas, 0, 0);
  document.getElementById('lb-filename').textContent = result.file.name;
  document.getElementById('lb-confidence').textContent = result.confidence + '%';
  document.getElementById('lb-faces').textContent = result.faceCount;
  lb.classList.remove('hidden');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  currentLightboxResult = null;
}

// ─── DOWNLOAD ZIP ─────────────────────────────────────────────────────────────
async function downloadZip() {
  if (!matchResults.length) return;
  setStatus('PREPARING ZIP ARCHIVE...');
  showToast('[ PREPARING DOWNLOAD... ]');

  const zip = new JSZip();
  const folder = zip.folder('LUMINAE_MATCHES');

  for (let i = 0; i < matchResults.length; i++) {
    const result = matchResults[i];
    const blob = await canvasToBlob(result.canvas);
    const name = `match_${String(i+1).padStart(3,'0')}_${result.confidence}pct_${result.file.name}`;
    folder.file(name, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'LUMINAE_MATCHES.zip';
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`DOWNLOADED ${matchResults.length} MATCHED PHOTOS`);
  showToast('[ ZIP DOWNLOADED ]');
}

// ─── RESET ────────────────────────────────────────────────────────────────────
function resetAll() {
  probeDescriptor = null;
  eventFiles = [];
  matchResults = [];

  document.getElementById('probe-canvas').classList.add('hidden');
  document.getElementById('probe-inner').classList.remove('hidden');
  document.getElementById('probe-data').classList.add('hidden');
  document.getElementById('probe-input').value = '';
  document.getElementById('event-input').value = '';
  document.getElementById('event-count').textContent = '0 files';
  document.getElementById('stat-total').textContent = '0';
  document.getElementById('stat-matched').textContent = '0';
  document.getElementById('stat-dupes').textContent = '0';
  document.getElementById('results-count').textContent = '0 found';
  document.getElementById('results-grid').classList.add('hidden');
  document.getElementById('results-empty').classList.remove('hidden');
  document.getElementById('results-grid').innerHTML = '';
  document.getElementById('btn-scan').disabled = true;
  document.getElementById('btn-download').disabled = true;
  document.getElementById('progress-wrap').classList.add('hidden');
  setStatus('SESSION RESET — READY');
  showToast('[ SESSION CLEARED ]');
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('status-text').textContent = msg;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

function fileToImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas) {
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
}

async function quickHash(canvas) {
  const small = document.createElement('canvas');
  small.width = 16; small.height = 16;
  small.getContext('2d').drawImage(canvas, 0, 0, 16, 16);
  const data = small.getContext('2d').getImageData(0, 0, 16, 16).data;
  let hash = 0;
  for (let i = 0; i < data.length; i += 4) {
    hash = ((hash << 5) - hash) + data[i] + data[i+1] + data[i+2];
    hash |= 0;
  }
  return hash;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── START ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);
