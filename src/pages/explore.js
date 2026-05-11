
import { api } from '../utils/api.js';
import { idb } from '../utils/idb.js';
import { escapeHtml, truncate, isOnline, debounce, timeAgo } from '../utils/helpers.js';
import { storyCard, bindFavButtons, skeletonCards } from './home.js';

let exploreMap = null;
let allStories = [];
let filteredStories = [];
let currentPage = 1;
const PAGE_SIZE = 12;

export async function renderExplore() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page">
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">Jelajahi Cerita</h1>
          <p class="page-subtitle">Temukan cerita dari seluruh penjuru dunia</p>
        </div>

        <div class="toolbar">
          <label for="exploreSearch" class="sr-only">Cari cerita</label>
          <input type="search" id="exploreSearch" class="search-box" placeholder="Cari cerita..." aria-label="Cari cerita" />
          <div class="view-toggle" role="group" aria-label="Mode tampilan">
            <button class="view-btn active" id="viewGrid" aria-pressed="true" title="Tampilan grid">⊞ Grid</button>
            <button class="view-btn" id="viewMap" aria-pressed="false" title="Tampilan peta"><i class="fas fa-map-marker-alt"></i> Peta</button>
          </div>
        </div>

        <div id="exploreContent">
          <div id="exploreGrid" class="stories-grid" aria-live="polite" aria-label="Daftar cerita">
            ${skeletonCards(9)}
          </div>
          <div id="exploreMapWrap" class="hidden">
            <div id="exploreMap" class="map-container map-full" role="application" aria-label="Peta cerita interaktif"></div>
          </div>
        </div>

        <div id="pagination" class="pagination"></div>
      </div>
    </div>
  `;

  await loadStories();
  initViewToggle();
  initSearch();
}

async function loadStories() {
  const grid = document.getElementById('exploreGrid');
  if (!grid) return;

  try {
    if (isOnline()) {
      const data = await api.getStories({ page: 1, size: 100, location: 1 });
      allStories = data.listStory || [];
      await idb.cacheStories(allStories);
    } else {
      allStories = await idb.getCachedStories();
    }

    filteredStories = allStories;
    currentPage = 1;
    renderPage();
    initExploreMap();

  } catch (err) {
    try {
      allStories = await idb.getCachedStories();
      filteredStories = allStories;
      if (allStories.length) { renderPage(); initExploreMap(); }
      else grid.innerHTML = `<div class="empty-state"><h2>Gagal memuat</h2><p>${escapeHtml(err.message)}</p></div>`;
    } catch {
      grid.innerHTML = `<div class="empty-state"><h2>Gagal memuat cerita</h2><p>Periksa koneksi internet Anda</p></div>`;
    }
  }
}

function renderPage() {
  const grid = document.getElementById('exploreGrid');
  const pag = document.getElementById('pagination');
  if (!grid) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredStories.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(filteredStories.length / PAGE_SIZE);

  if (!pageItems.length) {
    grid.innerHTML = `<div class="empty-state"><h2>Tidak ditemukan</h2><p>Coba kata kunci lain</p></div>`;
    if (pag) pag.innerHTML = '';
    return;
  }

  grid.innerHTML = pageItems.map(storyCard).join('');
  bindFavButtons(grid);

  // Pagination
  if (pag) {
    let html = '';
    if (currentPage > 1) html += `<button class="btn btn-secondary btn-sm" data-p="${currentPage-1}">← Prev</button>`;
    html += `<span class="page-info">${currentPage} / ${totalPages} (${filteredStories.length} cerita)</span>`;
    if (currentPage < totalPages) html += `<button class="btn btn-secondary btn-sm" data-p="${currentPage+1}">Next →</button>`;
    pag.innerHTML = html;
    pag.querySelectorAll('button[data-p]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.p);
        renderPage();
        document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
}

function initExploreMap() {
  const el = document.getElementById('exploreMap');
  if (!el || typeof L === 'undefined') return;
  if (exploreMap) { exploreMap.remove(); exploreMap = null; }

  exploreMap = L.map('exploreMap').setView([-2.5, 117.5], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(exploreMap);

  allStories.filter(s => s.lat && s.lon).forEach(story => {
    L.marker([story.lat, story.lon])
      .addTo(exploreMap)
      .bindPopup(`
        <div style="min-width:180px;max-width:240px">
          ${story.photoUrl ? `<img src="${escapeHtml(story.photoUrl)}" style="width:100%;border-radius:6px;margin-bottom:8px;max-height:110px;object-fit:cover" alt="">` : ''}
          <strong style="display:block;margin-bottom:4px;font-size:.9rem">${escapeHtml(story.name)}</strong>
          <p style="font-size:.8rem;margin-bottom:8px;color:#666;line-height:1.4">${escapeHtml(truncate(story.description, 80))}</p>
          <a href="#/stories/${escapeHtml(story.id)}" style="color:#7c3aed;font-weight:600;font-size:.8rem">Baca selengkapnya →</a>
        </div>
      `);
  });
}

function initViewToggle() {
  const gridBtn = document.getElementById('viewGrid');
  const mapBtn = document.getElementById('viewMap');
  const grid = document.getElementById('exploreGrid');
  const mapWrap = document.getElementById('exploreMapWrap');
  const pag = document.getElementById('pagination');

  gridBtn?.addEventListener('click', () => {
    grid?.classList.remove('hidden');
    mapWrap?.classList.add('hidden');
    pag?.classList.remove('hidden');
    gridBtn.classList.add('active'); gridBtn.setAttribute('aria-pressed','true');
    mapBtn.classList.remove('active'); mapBtn.setAttribute('aria-pressed','false');
  });

  mapBtn?.addEventListener('click', () => {
    grid?.classList.add('hidden');
    mapWrap?.classList.remove('hidden');
    pag?.classList.add('hidden');
    mapBtn.classList.add('active'); mapBtn.setAttribute('aria-pressed','true');
    gridBtn.classList.remove('active'); gridBtn.setAttribute('aria-pressed','false');
    setTimeout(() => exploreMap?.invalidateSize(), 150);
  });
}

function initSearch() {
  const input = document.getElementById('exploreSearch');
  if (!input) return;
  input.addEventListener('input', debounce((e) => {
    const q = e.target.value.toLowerCase().trim();
    filteredStories = q
      ? allStories.filter(s => s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
      : allStories;
    currentPage = 1;
    renderPage();
  }, 350));
}
