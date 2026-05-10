// ============================================================
// Add Story Page
// ============================================================

import { api } from '../utils/api.js';
import { idb } from '../utils/idb.js';
import { showToast, isOnline, fileToDataURL } from '../utils/helpers.js';
import { router } from '../utils/router.js';

let addMap = null;
let selectedLat = null;
let selectedLon = null;
let selectedFile = null;
let cameraStream = null;

export async function renderAddStory() {
    const container = document.getElementById('page-container');
    const offline = !isOnline();

    container.innerHTML = `
    <div class="page">
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">Bagikan Cerita</h1>
          <p class="page-subtitle">
            Ceritakan momen spesialmu dan tandai lokasinya
            ${offline ? '<span class="badge badge-warning" style="margin-left:.5rem">Mode Offline</span>' : ''}
          </p>
        </div>

        ${offline ? `
          <div class="status-banner" role="alert" style="border-radius:var(--radius-sm);margin-bottom:1.5rem;padding:.85rem 1.25rem">
            <i class="fas fa-wifi" style="margin-right:.5rem"></i>
            Anda sedang offline. Cerita akan disimpan dan dikirim otomatis ketika kembali online.
          </div>
        ` : ''}

        <div class="add-story-layout">
          <!-- LEFT: Form -->
          <div>
            <form id="addForm" novalidate aria-label="Form tambah cerita">
              <!-- Deskripsi -->
              <div class="form-group" id="groupDesc">
                <label class="form-label" for="storyDesc">Deskripsi Cerita <span aria-hidden="true">*</span></label>
                <textarea
                  id="storyDesc"
                  class="form-textarea"
                  placeholder="Ceritakan pengalamanmu di sini..."
                  rows="5"
                  required
                  aria-required="true"
                  aria-describedby="descErr"
                  maxlength="1000"
                ></textarea>
                <span class="form-error" id="descErr" role="alert">Deskripsi wajib diisi</span>
                <span class="form-hint" id="descCount">0 / 1000 karakter</span>
              </div>

              <!-- Foto upload -->
              <div class="form-group" id="groupPhoto">
                <label class="form-label">Foto <span aria-hidden="true">*</span></label>
                <div
                  class="photo-preview-wrap"
                  id="photoPreview"
                  role="button"
                  tabindex="0"
                  aria-label="Klik untuk memilih foto. Maksimal 1MB"
                >
                  <div class="photo-placeholder">
                    <span class="photo-placeholder-icon" aria-hidden="true"><i class="fas fa-camera"></i></span>
                    <span>Klik untuk pilih foto</span>
                    <small style="color:var(--text-muted)">JPG, PNG, GIF · Maks 1MB</small>
                  </div>
                </div>
                <input type="file" id="photoInput" accept="image/*" style="display:none" aria-label="Pilih file foto" />
                <span class="form-error" id="photoErr" role="alert">Foto wajib dipilih</span>
              </div>

              <!-- Kamera -->
              <div class="form-group camera-section" id="cameraSection">
                <label class="form-label">Atau Gunakan Kamera</label>
                <div class="camera-row">
                  <button type="button" id="cameraBtn" class="btn btn-secondary btn-sm"><i class="fas fa-camera"></i> Buka Kamera</button>
                  <button type="button" id="stopCameraBtn" class="btn btn-ghost btn-sm hidden"><i class="fas fa-stop"></i> Hentikan</button>
                </div>
                <video id="cameraVideo" playsinline muted aria-label="Preview kamera"></video>
                <button type="button" id="captureBtn" class="btn btn-primary btn-sm mt-2 hidden" aria-label="Ambil foto dari kamera"><i class="fas fa-camera"></i> Ambil Foto</button>
              </div>

              <!-- Lokasi info -->
              <div class="form-group">
                <label class="form-label">Lokasi <span style="font-weight:400;text-transform:none">(opsional)</span></label>
                <div class="location-info-box" id="locInfo" aria-live="polite">
                  <span aria-hidden="true"><i class="fas fa-map-marker-alt"></i></span>
                  <span id="locText">Klik pada peta di sebelah kanan untuk memilih lokasi</span>
                </div>
                <button type="button" id="clearLocBtn" class="btn btn-ghost btn-sm mt-2 hidden" aria-label="Hapus pilihan lokasi">✕ Hapus Lokasi</button>
              </div>

              <!-- Submit -->
              <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem">
                <button type="submit" id="submitBtn" class="btn btn-primary">
                  ${offline ? '<i class="fas fa-save"></i> Simpan Offline' : '<i class="fas fa-paper-plane"></i> Bagikan Cerita'}
                </button>
                <button type="button" onclick="history.back()" class="btn btn-ghost">Batal</button>
              </div>
            </form>

            <!-- Offline Queue -->
            <div id="offlineSection" class="hidden" style="margin-top:2rem">
              <div class="divider"></div>
              <div class="section-header">
                <div>
                  <h2 style="font-size:1rem;font-weight:700"><i class="fas fa-clock"></i> Antrian Offline</h2>
                  <p class="text-sm text-muted">Cerita yang menunggu dikirim</p>
                </div>
                <button id="syncBtn" class="btn btn-success btn-sm" aria-label="Sinkronisasi sekarang"><i class="fas fa-sync"></i> Sync Sekarang</button>
              </div>
              <div id="queueList" aria-live="polite" aria-label="Daftar antrian offline"></div>
            </div>
          </div>

          <!-- RIGHT: Map picker -->
          <div>
            <label class="form-label" style="display:block;margin-bottom:.5rem"> <i class="fas fa-map-marker-alt"></i> Pilih Lokasi di Peta</label>
            <div
              id="mapPicker"
              class="map-container"
              style="height:420px;cursor:crosshair"
              role="application"
              aria-label="Peta pemilih lokasi. Klik untuk memilih titik koordinat cerita"
            ></div>
            <p class="form-hint mt-2">Klik pada peta untuk menandai lokasi ceritamu</p>
          </div>
        </div>
      </div>
    </div>
  `;

  initMapPicker();
  initPhotoUpload();
  initCamera();
  initCharCounter();
  initForm();
  await loadOfflineQueue();
}

function initMapPicker() {
  const el = document.getElementById('mapPicker');
  if (!el || typeof L === 'undefined') return;
  if (addMap) { addMap.remove(); addMap = null; }

  addMap = L.map('mapPicker').setView([-6.2, 106.8], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(addMap);

  let marker = null;

  addMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    selectedLat = lat; selectedLon = lng;
    if (marker) marker.remove();
    marker = L.marker([lat, lng]).addTo(addMap)
      .bindPopup(`<strong>Lokasi dipilih</strong><br>${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();
    const locText = document.getElementById('locText');
    if (locText) locText.textContent = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`;
    document.getElementById('clearLocBtn')?.classList.remove('hidden');
  });

  document.getElementById('clearLocBtn')?.addEventListener('click', () => {
    selectedLat = null; selectedLon = null;
    if (marker) { marker.remove(); marker = null; }
    const locText = document.getElementById('locText');
    if (locText) locText.textContent = 'Klik pada peta di sebelah kanan untuk memilih lokasi';
    document.getElementById('clearLocBtn')?.classList.add('hidden');
  });

  // Try geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => addMap.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {}
    );
  }
}

function initPhotoUpload() {
  const preview = document.getElementById('photoPreview');
  const input = document.getElementById('photoInput');
  if (!preview || !input) return;

  const open = () => input.click();
  preview.addEventListener('click', open);
  preview.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { showToast('Ukuran foto maksimal 1MB', 'error'); return; }
    selectedFile = file;
    const url = await fileToDataURL(file);
    setPhotoPreview(url);
    document.getElementById('groupPhoto')?.classList.remove('has-error');
  });
}

function setPhotoPreview(url) {
  const preview = document.getElementById('photoPreview');
  if (!preview) return;
  // Remove placeholder, add img
  preview.innerHTML = `
    <img src="${url}" alt="Preview foto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <button type="button" id="removePhotoBtn" style="position:absolute;top:.5rem;right:.5rem;background:rgba(0,0,0,.6);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px" aria-label="Hapus foto">✕</button>
  `;
  document.getElementById('removePhotoBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    preview.innerHTML = `
      <div class="photo-placeholder">
        <span class="photo-placeholder-icon" aria-hidden="true">📷</span>
        <span>Klik untuk pilih foto</span>
        <small style="color:var(--text-muted)">JPG, PNG, GIF · Maks 1MB</small>
      </div>
    `;
    document.getElementById('photoInput').value = '';
  });
}

function initCamera() {
  const cameraBtn = document.getElementById('cameraBtn');
  const stopBtn = document.getElementById('stopCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const video = document.getElementById('cameraVideo');
  if (!cameraBtn || !video) return;

  if (!navigator.mediaDevices) {
    document.getElementById('cameraSection')?.classList.add('hidden');
    return;
  }

  cameraBtn.addEventListener('click', async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = cameraStream;
      video.style.display = 'block';
      await video.play();
      cameraBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      captureBtn.classList.remove('hidden');
    } catch {
      showToast('Tidak bisa mengakses kamera', 'error');
    }
  });

  stopBtn.addEventListener('click', stopCamera);

  captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob((blob) => {
      selectedFile = new File([blob], 'kamera-capture.jpg', { type: 'image/jpeg' });
      setPhotoPreview(canvas.toDataURL('image/jpeg'));
      document.getElementById('groupPhoto')?.classList.remove('has-error');
    }, 'image/jpeg', 0.85);
  });
}

function stopCamera() {
  cameraStream?.getTracks().forEach(t => t.stop());
  cameraStream = null;
  const video = document.getElementById('cameraVideo');
  if (video) { video.style.display = 'none'; video.srcObject = null; }
  document.getElementById('cameraBtn')?.classList.remove('hidden');
  document.getElementById('stopCameraBtn')?.classList.add('hidden');
  document.getElementById('captureBtn')?.classList.add('hidden');
}

function initCharCounter() {
  const ta = document.getElementById('storyDesc');
  const count = document.getElementById('descCount');
  if (!ta || !count) return;
  ta.addEventListener('input', () => {
    count.textContent = `${ta.value.length} / 1000 karakter`;
  });
}

function validateForm() {
  let ok = true;
  const desc = document.getElementById('storyDesc')?.value.trim() || '';
  const groupDesc = document.getElementById('groupDesc');
  const groupPhoto = document.getElementById('groupPhoto');

  if (!desc) { groupDesc?.classList.add('has-error'); ok = false; }
  else groupDesc?.classList.remove('has-error');

  if (!selectedFile) { groupPhoto?.classList.add('has-error'); ok = false; }
  else groupPhoto?.classList.remove('has-error');

  return ok;
}

function initForm() {
  const form = document.getElementById('addForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      document.querySelector('.has-error .form-input, .has-error .form-textarea')?.focus();
      return;
    }

    const desc = document.getElementById('storyDesc').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Mengirim...';

    if (!isOnline()) {
      // Offline: simpan ke queue
      try {
        const dataUrl = await fileToDataURL(selectedFile);
        await idb.addToQueue({
          description: desc,
          lat: selectedLat,
          lon: selectedLon,
          photoDataUrl: dataUrl,
          photoName: selectedFile.name,
          photoType: selectedFile.type,
        });
        showToast('<i class="fas fa-save" style="color: green;"></i> Disimpan offline! Akan dikirim saat online.', 'success');
        resetForm();
        await loadOfflineQueue();
      } catch (err) {
        showToast('Gagal simpan offline: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '<i class="fas fa-save"></i> Simpan Offline';
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append('description', desc);
      formData.append('photo', selectedFile);
      if (selectedLat !== null) formData.append('lat', selectedLat);
      if (selectedLon !== null) formData.append('lon', selectedLon);

      if (api.isLoggedIn()) {
        await api.addStory(formData);
      } else {
        await api.addStoryGuest(formData);
      }

      showToast('🎉 Cerita berhasil dibagikan!', 'success');
      setTimeout(() => router.navigate('/'), 1800);

    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '<i class="fas fa-paper-plane"></i> Bagikan Cerita';
    }
  });
}

function resetForm() {
  document.getElementById('storyDesc').value = '';
  document.getElementById('descCount').textContent = '0 / 1000 karakter';
  selectedFile = null;
  selectedLat = null; selectedLon = null;
  const preview = document.getElementById('photoPreview');
  if (preview) {
    preview.innerHTML = `
      <div class="photo-placeholder">
        <span class="photo-placeholder-icon" aria-hidden="true"><i class="fas fa-camera"></i></span>
        <span>Klik untuk pilih foto</span>
        <small style="color:var(--text-muted)">JPG, PNG, GIF · Maks 1MB</small>
      </div>
    `;
  }
  document.getElementById('photoInput').value = '';
  document.getElementById('locText').textContent = 'Klik pada peta di sebelah kanan untuk memilih lokasi';
  document.getElementById('clearLocBtn')?.classList.add('hidden');
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('submitBtn').textContent = isOnline() ? '<i class="fas fa-paper-plane"></i> Bagikan Cerita' : '<i class="fas fa-save"></i> Simpan Offline';
}

export async function loadOfflineQueue() {
  const section = document.getElementById('offlineSection');
  const list = document.getElementById('queueList');
  if (!section || !list) return;

  const queue = await idb.getQueue();
  if (!queue.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  list.innerHTML = queue.map(item => `
    <div class="queue-item" data-qid="${item.queueId}">
      <div class="queue-item-info">
        <div class="queue-item-title">${(item.description || '').slice(0, 70)}…</div>
        <div class="queue-item-date"> <i class="fas fa-clock"></i> ${new Date(item.createdAt).toLocaleString('id-ID')} ${item.lat ? `· 📍 Lokasi ada` : ''}</div>
      </div>
      <button class="btn btn-danger btn-sm del-queue-btn" data-qid="${item.queueId}" aria-label="Hapus dari antrian">🗑</button>
    </div>
  `).join('');

  list.querySelectorAll('.del-queue-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await idb.removeFromQueue(parseInt(btn.dataset.qid));
      btn.closest('.queue-item').remove();
      await loadOfflineQueue();
      showToast('Dihapus dari antrian', 'info');
    });
  });

  document.getElementById('syncBtn')?.addEventListener('click', async () => {
    if (!isOnline()) { showToast('Masih offline. Coba lagi nanti.', 'error'); return; }
    await syncQueue();
  });
}

export async function syncQueue() {
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = '<i class="fas fa-sync"></i> Menyinkronkan...'; }

  const queue = await idb.getQueue();
  let ok = 0, fail = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.photoDataUrl);
      const blob = await res.blob();
      const file = new File([blob], item.photoName || 'photo.jpg', { type: item.photoType || 'image/jpeg' });
      const fd = new FormData();
      fd.append('description', item.description || '');
      fd.append('photo', file);
      if (item.lat) fd.append('lat', item.lat);
      if (item.lon) fd.append('lon', item.lon);

      if (api.isLoggedIn()) await api.addStory(fd);
      else await api.addStoryGuest(fd);

      await idb.removeFromQueue(item.queueId);
      ok++;
    } catch { fail++; }
  }

  showToast(`Sync selesai: ${ok} berhasil${fail ? `, ${fail} gagal` : ''}`, ok > 0 ? 'success' : 'error');
  await loadOfflineQueue();
  if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = '<i class="fas fa-sync"></i> Sync Sekarang'; }
}