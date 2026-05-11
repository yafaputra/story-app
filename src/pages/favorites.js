

import { idb } from '../utils/idb.js';
import { escapeHtml, truncate, showToast, debounce, timeAgo, formatDateShort } from '../utils/helpers.js';

export async function renderFavorites() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page">
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">Favorit Saya</h1>
          <p class="page-subtitle">Koleksi cerita yang Anda simpan di perangkat ini</p>
        </div>

        <div class="toolbar">
          <label for="favSearch" class="sr-only">Cari cerita favorit</label>
          <input
            type="search"
            id="favSearch"
            class="search-box"
            placeholder="Cari di favorit..."
            aria-label="Cari cerita favorit"
          />
          <label for="favSort" class="sr-only">Urutkan favorit</label>
          <select id="favSort" class="sort-box" aria-label="Urutkan favorit">
            <option value="savedAt_desc">Terbaru disimpan</option>
            <option value="savedAt_asc">Terlama disimpan</option>
            <option value="name_asc">Nama A–Z</option>
            <option value="name_desc">Nama Z–A</option>
            <option value="createdAt_desc">Dibuat terbaru</option>
            <option value="createdAt_asc">Dibuat terlama</option>
          </select>
          <button id="clearAllBtn" class="btn btn-danger btn-sm" aria-label="Hapus semua favorit">🗑 Hapus Semua</button>
        </div>

        <p id="favCount" class="text-sm text-muted font-mono" style="margin-bottom:1rem" aria-live="polite"></p>

        <div id="favGrid" class="stories-grid" aria-live="polite" aria-label="Daftar cerita favorit"></div>
      </div>
    </div>
  `;

  await loadFavorites();
  initControls();
}

let currentQuery = '';
let currentSort = 'savedAt_desc';

async function loadFavorites() {
  const grid = document.getElementById('favGrid');
  const count = document.getElementById('favCount');
  if (!grid) return;

  try {
    let data = await idb.getAllFavorites();

    // Filter
    if (currentQuery) {
      const q = currentQuery.toLowerCase();
      data = data.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    }

    // Sort
    const [sortKey, sortDir] = currentSort.split('_');
    data.sort((a, b) => {
      const av = (a[sortKey] || '').toLowerCase();
      const bv = (b[sortKey] || '').toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

    if (count) {
      const total = (await idb.getAllFavorites()).length;
      count.textContent = currentQuery
        ? `Menampilkan ${data.length} dari ${total} favorit`
        : `${total} cerita favorit`;
    }

    if (!data.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h2>${currentQuery ? 'Tidak ditemukan' : 'Belum ada favorit'}</h2>
          <p>${currentQuery ? 'Coba kata kunci lain' : 'Tekan tombol pada cerita untuk menyimpannya'}</p>
          ${!currentQuery ? '<a href="#/explore" class="btn btn-primary" style="margin-top:1rem">Jelajahi Cerita</a>' : ''}
        </div>
      `;
      return;
    }

    grid.innerHTML = data.map(s => favCard(s)).join('');
    bindEvents(grid);

  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><h2>Gagal memuat</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function favCard(story) {
  const img = story.photoUrl
    ? `<img class="card-img" src="${escapeHtml(story.photoUrl)}" alt="Foto cerita ${escapeHtml(story.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const ph = `<div class="card-img-placeholder" ${story.photoUrl ? 'style="display:none"' : ''} aria-hidden="true"><i class="fas fa-image"></i></div>`;

  return `
    <article class="card" data-id="${escapeHtml(story.id)}">
      <a href="#/stories/${escapeHtml(story.id)}" aria-label="Baca cerita oleh ${escapeHtml(story.name)}">
        ${img}${ph}
      </a>
      <div class="card-body">
        <h3 class="card-title">
          <a href="#/stories/${escapeHtml(story.id)}">${escapeHtml(story.name)}'s Story</a>
        </h3>
        <p class="card-text">${escapeHtml(truncate(story.description, 110))}</p>
        <div class="card-meta">
          <span title="${escapeHtml(story.createdAt)}">${timeAgo(story.createdAt)}</span>
          <span style="color:var(--accent-light)">❤️${formatDateShort(story.savedAt)}</span>
        </div>
        <div class="card-actions">
          <a href="#/stories/${escapeHtml(story.id)}" class="btn btn-secondary btn-sm">Baca →</a>
          <button
            class="btn btn-danger btn-sm rm-fav-btn"
            data-id="${escapeHtml(story.id)}"
            aria-label="Hapus ${escapeHtml(story.name)} dari favorit"
          >🗑 Hapus</button>
        </div>
      </div>
    </article>
  `;
}

function bindEvents(container) {
  container.querySelectorAll('.rm-fav-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const card = container.querySelector(`[data-id="${id}"]`);

      // Animate out
      if (card) {
        card.style.transition = 'all .25s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(.9)';
        await new Promise(r => setTimeout(r, 250));
        card.remove();
      }

      await idb.removeFavorite(id);
      showToast('Dihapus dari favorit', 'info');

      const remaining = await idb.getAllFavorites();
      const count = document.getElementById('favCount');
      if (count) count.textContent = `${remaining.length} cerita favorit`;
      if (!remaining.length) await loadFavorites();
    });
  });
}

function initControls() {
  const search = document.getElementById('favSearch');
  const sort = document.getElementById('favSort');
  const clearAll = document.getElementById('clearAllBtn');

  search?.addEventListener('input', debounce((e) => {
    currentQuery = e.target.value.trim();
    loadFavorites();
  }, 300));

  sort?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadFavorites();
  });

  clearAll?.addEventListener('click', async () => {
    const all = await idb.getAllFavorites();
    if (!all.length) { showToast('Tidak ada favorit', 'info'); return; }
    const ok = confirm(`Hapus semua ${all.length} favorit? Tindakan ini tidak bisa dibatalkan.`);
    if (!ok) return;
    for (const f of all) await idb.removeFavorite(f.id);
    showToast(`${all.length} favorit dihapus`, 'success');
    await loadFavorites();
  });
}
