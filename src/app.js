import { router } from './utils/router.js';
import './styles/main.css';
import { api } from './utils/api.js';
import { idb } from './utils/idb.js';
import { showToast, isOnline } from './utils/helpers.js';
import { subscribePush, unsubscribePush, isPushSupported, getPushSubscription, requestNotificationPermission } from './utils/push.js';

import { renderHome } from './pages/home.js';
import { renderExplore } from './pages/explore.js';
import { renderStoryDetail } from './pages/detail.js';
import { renderAddStory, syncQueue } from './pages/add-story.js';
import { renderFavorites } from './pages/favorites.js';
import { renderLogin, renderRegister } from './pages/auth.js';

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    console.log('[SW] Registered, scope:', reg.scope);

    navigator.serviceWorker.addEventListener('message', ({ data }) => {
      if (!data) return;
      if (data.type === 'NAVIGATE') router.navigate(data.payload);
      if (data.type === 'SYNC_OFFLINE') { if (isOnline() && api.isLoggedIn()) syncQueue(); }
    });
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
  }
}

let deferredPrompt = null;

function initInstallBanner() {
  const banner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installBtn');
  const dismissBtn = document.getElementById('dismissInstall');
  if (!banner) return;
  if (localStorage.getItem('pwa-installed') || localStorage.getItem('pwa-dismissed')) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.classList.add('hidden');
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-installed', '1');
      showToast('StoryMap berhasil diinstal! 🎉', 'success');
    }
  });

  dismissBtn?.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem('pwa-dismissed', '1');
  });

  window.addEventListener('appinstalled', () => {
    banner.classList.add('hidden');
    deferredPrompt = null;
    localStorage.setItem('pwa-installed', '1');
  });
}

function showNotifPermissionDialog() {
  return new Promise((resolve) => {
    const existing = document.getElementById('notifPermissionDialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'notifPermissionDialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'notifDialogTitle');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    `;

    overlay.innerHTML = `
      <div style="
        background: #fff; border-radius: 16px; padding: 1.5rem;
        max-width: 360px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      ">
        <div style="text-align:center; margin-bottom: 1rem;">
          <div style="
            width: 56px; height: 56px; border-radius: 50%;
            background: #e8f4fd; margin: 0 auto 0.75rem;
            display: flex; align-items: center; justify-content: center;
            font-size: 28px;
          ">🔔</div>
          <h2 id="notifDialogTitle" style="margin:0 0 0.5rem; font-size:1.1rem; font-weight:600; color:#1a1a2e">
            Izinkan Notifikasi?
          </h2>
          <p style="margin:0; font-size:0.875rem; color:#555; line-height:1.6">
            StoryMap ingin mengirimkan notifikasi untuk memberi tahu kamu saat ada cerita baru atau aktivitas penting.
          </p>
        </div>
        <ul style="
          margin: 0 0 1.25rem; padding: 0.75rem 1rem;
          background: #f8f9fa; border-radius: 10px;
          list-style: none; font-size: 0.82rem; color: #444;
        ">
          <li style="padding: 3px 0">✅ Pemberitahuan cerita baru</li>
          <li style="padding: 3px 0">✅ Pengingat aktivitas akunmu</li>
          <li style="padding: 3px 0">🚫 Tidak ada spam atau iklan</li>
        </ul>
        <div style="display:flex; gap: 0.75rem;">
          <button id="notifDenyBtn" style="
            flex:1; padding: 0.65rem; border-radius: 10px;
            border: 1.5px solid #ddd; background: #fff;
            font-size: 0.875rem; cursor: pointer; color: #555;
          ">Tidak, terima kasih</button>
          <button id="notifAllowBtn" style="
            flex:1; padding: 0.65rem; border-radius: 10px;
            border: none; background: #3b82f6;
            font-size: 0.875rem; cursor: pointer; color: #fff; font-weight: 600;
          ">Izinkan</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('notifAllowBtn').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
    document.getElementById('notifDenyBtn').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

async function initPushToggle() {
  const wrap = document.getElementById('notifToggle');
  const btn = document.getElementById('togglePushBtn');
  if (!wrap || !btn) return;

  if (!isPushSupported() || !api.isLoggedIn()) return;
  wrap.classList.remove('hidden');

  if (Notification.permission === 'denied') {
    btn.title = 'Notifikasi diblokir. Aktifkan di pengaturan browser lalu refresh halaman.';
    btn.disabled = true;
    updatePushBtn(btn, false);
    return;
  }

  const sub = await getPushSubscription();
  updatePushBtn(btn, !!sub);

  btn.addEventListener('click', async () => {
    const isActive = btn.getAttribute('aria-pressed') === 'true';
    btn.disabled = true;
    try {
      if (isActive) {
        await unsubscribePush();
        updatePushBtn(btn, false);
        showToast('Push notification dinonaktifkan', 'info');
      } else {
        // Jika permission belum diberikan, tampilkan dialog penjelasan dulu
        if (Notification.permission !== 'granted') {
          const userAgreed = await showNotifPermissionDialog();
          if (!userAgreed) {
            showToast('Izin notifikasi tidak diberikan', 'info');
            btn.disabled = false;
            return;
          }
          // Setelah user setuju, baru panggil requestPermission() browser
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            showToast('Izin notifikasi ditolak oleh browser', 'error');
            btn.disabled = false;
            return;
          }
        }
        await subscribePush();
        updatePushBtn(btn, true);
        showToast('Push notification aktif! 🔔', 'success');
      }
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function updatePushBtn(btn, active) {
  btn.setAttribute('aria-pressed', String(active));
  btn.querySelector('.push-label').textContent = active ? 'Notif Aktif' : 'Notifikasi';
  btn.title = active ? 'Klik untuk nonaktifkan notifikasi' : 'Klik untuk aktifkan notifikasi';
}

export function updateNavAuth() {
  const loggedIn = api.isLoggedIn();
  const userName = localStorage.getItem('userName') || 'Akun';

  const navAuth = document.getElementById('nav-auth');
  const navAdd = document.getElementById('nav-add');
  const mobileAuth = document.getElementById('mobile-nav-auth');
  const mobileAdd = document.getElementById('mobile-nav-add');

  if (loggedIn) {
    if (navAuth) navAuth.innerHTML = `
      <button class="nav-link" id="logoutBtn" style="background:none;border:none;font-size:.9rem" aria-label="Keluar dari akun ${userName}">
        Keluar (${userName})
      </button>`;
    if (mobileAuth) mobileAuth.innerHTML = `
      <button class="nav-link" id="logoutBtnM" style="background:none;border:none;width:100%;text-align:left" aria-label="Keluar">
        Keluar (${userName})
      </button>`;
    navAdd?.classList.remove('hidden');
    mobileAdd?.classList.remove('hidden');

    document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
    document.getElementById('logoutBtnM')?.addEventListener('click', doLogout);
  } else {
    if (navAuth) navAuth.innerHTML = `<a href="#/login" class="nav-link nav-auth-btn" data-page="login">Masuk</a>`;
    if (mobileAuth) mobileAuth.innerHTML = `<a href="#/login" class="nav-link" data-page="login">🔑 Masuk</a>`;
    navAdd?.classList.add('hidden');
    mobileAdd?.classList.add('hidden');
    document.getElementById('notifToggle')?.classList.add('hidden');
  }
}

function doLogout() {
  api.logout();
  updateNavAuth();
  document.getElementById('notifToggle')?.classList.add('hidden');
  showToast('Berhasil keluar. Sampai jumpa!', 'info');
  router.navigate('/');
}

function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('mobileMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const open = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', open);
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.setAttribute('aria-label', open ? 'Buka menu navigasi' : 'Tutup menu navigasi');
  });

  menu.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) {
      menu.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function initNetworkStatus() {
  const banner = document.getElementById('statusBanner');
  const update = () => {
    if (!banner) return;
    if (!navigator.onLine) {
      banner.textContent = 'Anda sedang offline. Data ditampilkan dari cache.';
      banner.className = 'status-banner offline';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
      // Auto sync
      if (api.isLoggedIn()) {
        idb.getQueue().then(q => {
          if (q.length) {
            showToast(`Menyinkronkan ${q.length} cerita offline...`, 'info');
            syncQueue();
          }
        });
      }
    }
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setupRoutes() {
  router
    .add('/', () => renderHome())
    .add('/explore', () => renderExplore())
    .add('/stories/:id', (p) => renderStoryDetail(p))
    .add('/add', () => renderAddStory())
    .add('/favorites', () => renderFavorites())
    .add('/login', () => renderLogin())
    .add('/register', () => renderRegister())
    .add('/404', () => {
      document.getElementById('page-container').innerHTML = `
        <div class="page text-center">
          <div class="container">
            <div style="font-size:5rem;margin-bottom:1rem">🗺️</div>
            <h1 class="page-title">404 - Tidak Ditemukan</h1>
            <p class="text-muted" style="margin-bottom:2rem">Halaman yang Anda cari tidak ada.</p>
            <a href="#/" class="btn btn-primary btn-lg">Kembali ke Beranda</a>
          </div>
        </div>`;
    })
    .init();
}

async function init() {
  await idb.open();
  updateNavAuth();
  initMobileMenu();
  initNetworkStatus();
  initInstallBanner();
  setupRoutes();

  registerSW().then(() => {
    setTimeout(() => initPushToggle(), 800);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}