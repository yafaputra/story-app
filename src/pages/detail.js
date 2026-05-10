// ============================================================
// Story Detail Page
// ============================================================

import { api } from '../utils/api.js';
import { idb } from '../utils/idb.js';
import { formatDate, escapeHtml, showToast, isOnline } from '../utils/helpers.js';

export async function renderStoryDetail({ id }) {
    const container = document.getElementById('page-container');
    container.innerHTML = `
    <div class="page">
      <div class="container">
        <nav aria-label="Navigasi kembali" style="margin-bottom:1.5rem">
          <button onclick="history.back()" class="btn btn-ghost btn-sm" aria-label="Kembali ke halaman sebelumnya">← Kembali</button>
        </nav>
        <div id="detailContent">
          <div class="story-detail">
            <div class="skeleton" style="height:400px;border-radius:var(--radius);margin-bottom:2rem" aria-hidden="true"></div>
            <div class="skeleton" style="height:2.5rem;width:65%;margin-bottom:1rem" aria-hidden="true"></div>
            <div class="skeleton" style="height:1rem;width:45%;margin-bottom:1.5rem" aria-hidden="true"></div>
            <div class="skeleton" style="height:1rem;width:100%;margin-bottom:.75rem" aria-hidden="true"></div>
            <div class="skeleton" style="height:1rem;width:85%;margin-bottom:.75rem" aria-hidden="true"></div>
            <div class="skeleton" style="height:1rem;width:70%" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>
  `;

    try {
        let story = null;
        if (isOnline()) {
            const data = await api.getStoryById(id);
            story = data.story;
            if (story) await idb.cacheStories([story]);
        }
        if (!story) story = await idb.getCachedStory(id);
        if (!story) throw new Error('Cerita tidak ditemukan');
        await renderDetail(story);
    } catch (err) {
        document.getElementById('detailContent').innerHTML = `
      <div class="empty-state">
        <h3>Gagal memuat cerita</h3>
        <p>${escapeHtml(err.message)}</p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem">
          <button onclick="history.back()" class="btn btn-secondary">← Kembali</button>
          <a href="#/" class="btn btn-primary">Beranda</a>
        </div>
      </div>
    `;
    }
}

async function renderDetail(story) {
    const el = document.getElementById('detailContent');
    if (!el) return;

    const isFav = await idb.isFavorite(story.id);

    const imgSection = story.photoUrl ? `
    <img
      class="story-detail-img"
      src="${escapeHtml(story.photoUrl)}"
      alt="Foto cerita oleh ${escapeHtml(story.name)}"
      onerror="this.style.display='none'"
    />
  ` : '';

    const mapSection = story.lat && story.lon ? `
    <section class="detail-map-section" aria-labelledby="mapHeading">
      <h3 id="mapHeading">Lokasi Cerita</h3>
      <div id="storyDetailMap" class="map-container" style="height:320px" role="application" aria-label="Peta lokasi cerita"></div>
      <p class="font-mono text-sm text-muted mt-2">
        Koordinat: ${parseFloat(story.lat).toFixed(6)}, ${parseFloat(story.lon).toFixed(6)}
      </p>
    </section>
  ` : '';

    el.innerHTML = `
    <article class="story-detail" aria-labelledby="storyTitle">
      ${imgSection}

      <div class="flex justify-between items-center flex-wrap gap-4" style="margin-bottom:1.25rem">
        <h1 class="story-detail-title" id="storyTitle" style="margin-bottom:0">
          ${escapeHtml(story.name)}'s Story
        </h1>
        <button
          id="favBtn"
          class="btn ${isFav ? 'btn-danger' : 'btn-secondary'}"
          aria-pressed="${isFav}"
          aria-label="${isFav ? 'Hapus dari favorit' : 'Simpan ke favorit'}"
        >${isFav ? '<i class="fas fa-heart"></i> Tersimpan' : '<i class="fas fa-heart"></i> Simpan Favorit'}</button>
      </div>

      <div class="story-detail-meta" role="list">
        <span role="listitem"><i class="fas fa-user"></i> ${escapeHtml(story.name)}</span>
        <span role="listitem"><i class="fas fa-calendar-alt"></i> ${formatDate(story.createdAt)}</span>
        ${story.lat && story.lon ? `<span role="listitem"><i class="fas fa-map-marker-alt"></i> Memiliki lokasi</span>` : ''}
      </div>

      <p class="story-detail-desc">${escapeHtml(story.description)}</p>

      ${mapSection}

      <div class="divider"></div>
      <div style="display:flex;gap:1rem;flex-wrap:wrap">
        <button onclick="history.back()" class="btn btn-secondary">← Kembali</button>
        <a href="#/explore" class="btn btn-ghost">Jelajahi Lainnya</a>
      </div>
    </article>
  `;

  // Init map
  if (story.lat && story.lon && typeof L !== 'undefined') {
    const map = L.map('storyDetailMap').setView([story.lat, story.lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    L.marker([story.lat, story.lon])
      .addTo(map)
      .bindPopup(`<strong>${escapeHtml(story.name)}</strong>`)
      .openPopup();
  }

  // Fav button
  document.getElementById('favBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('favBtn');
    const fav = await idb.isFavorite(story.id);
    try {
      if (fav) {
        await idb.removeFavorite(story.id);
        btn.className = 'btn btn-secondary';
        btn.innerHTML = '<i class="fas fa-heart"></i> Simpan Favorit';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Simpan ke favorit');
        showToast('Dihapus dari favorit', 'info');
      } else {
        await idb.addFavorite(story);
        btn.className = 'btn btn-danger';
        btn.innerHTML = '<i class="fas fa-heart"></i> Tersimpan';
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Hapus dari favorit');
        showToast('Disimpan ke favorit!', 'success');
      }
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    }
  });
}