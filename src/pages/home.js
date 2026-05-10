import { api } from '../utils/api.js';
import { idb } from '../utils/idb.js';
import { formatDateShort, escapeHtml, truncate, isOnline, timeAgo } from '../utils/helpers.js';

export async function renderHome() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
    <section class="hero" aria-label="Halaman utama StoryMap">
      <div class="hero-grid container">
        <div class="hero-content">
          <div class="hero-badge"> Platform Cerita Interaktif</div>
          <h1 class="hero-title">
            Bagikan <span class="gradient-text">Ceritamu</span><br>kepada Dunia
          </h1>
          <p class="hero-desc">
            Dokumentasikan petualangan, momen spesial, dan kisah harianmu
            dengan penanda lokasi yang tepat di peta dunia.
          </p>
          <div class="hero-actions">
            <a href="#/explore" class="btn btn-primary btn-lg">Jelajahi Cerita</a>
            <a href="#/add" class="btn btn-secondary btn-lg">Bagikan Cerita</a>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-map-card">
            <div id="heroMap" style="width:100%;height:100%"></div>
          </div>
          <div class="hero-stats">
            <div class="stat-item">
              <div class="stat-value" id="statStories">—</div>
              <div class="stat-label">Cerita</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" id="statLocations">—</div>
              <div class="stat-label">Lokasi</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" id="statFavs">—</div>
              <div class="stat-label">Favorit</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="page" style="padding-top:0" aria-labelledby="recentTitle">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="page-title" id="recentTitle">Cerita Terbaru</h2>
            <p class="page-subtitle">Kisah terbaru dari komunitas StoryMap</p>
          </div>
          <a href="#/explore" class="btn btn-secondary">Lihat Semua →</a>
        </div>
        <div id="recentStories" class="stories-grid" aria-live="polite" aria-label="Daftar cerita terbaru">
          ${skeletonCards(6)}
        </div>
      </div>
    </section>
  `;

    initHeroMap();

    await loadRecentStories();
    await loadStats();
}

function initHeroMap() {
    const el = document.getElementById('heroMap');
    if (!el || typeof L === 'undefined') return;
    if (window._heroMap) {
        window._heroMap.remove();
        window._heroMap = null;
    }

    const map = L.map('heroMap', {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
    }).setView([-2.5, 117.5], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
    }).addTo(map);

    window._heroMap = map;
}

async function loadRecentStories() {
    const el = document.getElementById('recentStories');
    if (!el) return;

    try {
        let stories = [];
        if (isOnline()) {
            const data = await api.getStories({ page: 1, size: 6, location: 1 });
            stories = data.listStory || [];
            await idb.cacheStories(stories);
        } else {
            const cached = await idb.getCachedStories();
            stories = cached.slice(0, 6);
        }

        if (!stories.length) {
            el.innerHTML = `<div class="empty-state"><h3>Belum ada cerita</h3><p>Jadilah yang pertama berbagi!</p><a href="#/add" class="btn btn-primary">Tambah Cerita</a></div>`;
            return;
        }

        const map = window._heroMap;
        if (map) {
            stories.forEach(s => {
                if (s.lat && s.lon) {
                    L.circleMarker([s.lat, s.lon], {
                            radius: 7,
                            fillColor: '#a855f7',
                            color: '#7c3aed',
                            weight: 2,
                            fillOpacity: 0.9,
                        }).addTo(map)
                        .bindPopup(`<strong>${escapeHtml(s.name)}</strong><br><small>${escapeHtml(truncate(s.description, 60))}</small>`);
                }
            });
        }

        el.innerHTML = stories.map(storyCard).join('');
        bindFavButtons(el);

    } catch (err) {
        try {
            const cached = await idb.getCachedStories();
            if (cached.length) {
                el.innerHTML = cached.slice(0, 6).map(storyCard).join('');
                bindFavButtons(el);
            } else {
                el.innerHTML = errorState(err.message);
            }
        } catch {
            el.innerHTML = errorState(err.message);
        }
    }
}

async function loadStats() {
    try {
        const favCount = await idb.getFavoritesCount();
        const statFavs = document.getElementById('statFavs');
        if (statFavs) statFavs.textContent = favCount;

        if (isOnline()) {
            const data = await api.getStories({ page: 1, size: 100, location: 1 });
            const stories = data.listStory || [];
            const withLoc = stories.filter(s => s.lat && s.lon);
            const s1 = document.getElementById('statStories');
            const s2 = document.getElementById('statLocations');
            if (s1) s1.textContent = stories.length + '+';
            if (s2) s2.textContent = withLoc.length + '+';
        }
    } catch {}
}

export function storyCard(story) {
    const img = story.photoUrl ?
        `<img class="card-img" src="${escapeHtml(story.photoUrl)}" alt="Foto cerita oleh ${escapeHtml(story.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` :
        '';
    const placeholder = `<div class="card-img-placeholder" ${story.photoUrl ? 'style="display:none"' : ''} aria-hidden="true"><i class="fas fa-image"></i></div>`;
    const loc = story.lat && story.lon ?
        `<span title="Lokasi: ${parseFloat(story.lat).toFixed(4)}, ${parseFloat(story.lon).toFixed(4)}"><i class="fas fa-map-marker-alt"></i> Ada lokasi</span>` :
        '<span><i class="fas fa-map-marker-alt"></i> Tanpa lokasi</span>';

    return `
    <article class="card" data-id="${escapeHtml(story.id)}">
      <a href="#/stories/${escapeHtml(story.id)}" aria-label="Baca cerita oleh ${escapeHtml(story.name)}">
        ${img}${placeholder}
      </a>
      <div class="card-body">
        <h3 class="card-title">
          <a href="#/stories/${escapeHtml(story.id)}">${escapeHtml(story.name)}'s Story</a>
        </h3>
        <p class="card-text">${escapeHtml(truncate(story.description, 120))}</p>
        <div class="card-meta">
          <span title="${escapeHtml(story.createdAt)}">${timeAgo(story.createdAt)}</span>
          ${loc}
        </div>
        <div class="card-actions">
          <a href="#/stories/${escapeHtml(story.id)}" class="btn btn-secondary btn-sm">Baca →</a>
          <button
            class="btn btn-ghost btn-sm btn-fav"
            data-story-id="${escapeHtml(story.id)}"
            data-story='${escapeHtml(JSON.stringify(story))}'
            aria-label="Simpan ke favorit"
            aria-pressed="false"
          ><i class="fas fa-heart"></i></button>
        </div>
      </div>
    </article>
  `;
}

export async function bindFavButtons(container) {
    const btns = container.querySelectorAll('.btn-fav');
    for (const btn of btns) {
        const id = btn.dataset.storyId;
        const fav = await idb.isFavorite(id);
        btn.innerHTML = fav ? '❤️' : '<i class="fas fa-heart"></i>';
        btn.setAttribute('aria-pressed', String(fav));
        btn.title = fav ? 'Hapus dari favorit' : 'Simpan ke favorit';
    }

    btns.forEach(btn => {
        btn.addEventListener('click', async(e) => {
            e.preventDefault();
            const id = btn.dataset.storyId;
            const isFav = await idb.isFavorite(id);
            if (isFav) {
                await idb.removeFavorite(id);
                btn.innerHTML = '<i class="fas fa-heart"></i>';
                btn.setAttribute('aria-pressed', 'false');
                btn.title = 'Simpan ke favorit';
            } else {
                try {
                    const story = JSON.parse(btn.dataset.story);
                    await idb.addFavorite(story);
                    btn.innerHTML = '❤️';
                    btn.setAttribute('aria-pressed', 'true');
                    btn.title = 'Hapus dari favorit';
                } catch {}
            }
        });
    });
}

export function skeletonCards(n) {
    return Array.from({ length: n }, () => `
    <div class="card" aria-hidden="true">
      <div class="skeleton" style="aspect-ratio:16/9;width:100%"></div>
      <div class="card-body">
        <div class="skeleton" style="height:1.1rem;width:75%;margin-bottom:.75rem"></div>
        <div class="skeleton" style="height:.85rem;width:100%;margin-bottom:.5rem"></div>
        <div class="skeleton" style="height:.85rem;width:55%"></div>
      </div>
    </div>
  `).join('');
}

function errorState(msg) {
    return `<div class="empty-state"><h3>Gagal memuat</h3><p>${escapeHtml(msg)}</p></div>`;
}