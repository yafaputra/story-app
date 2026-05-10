// ============================================================
// Auth Pages - Login & Register
// ============================================================

import { api } from '../utils/api.js';
import { showToast, isValidEmail } from '../utils/helpers.js';
import { router } from '../utils/router.js';

// updateNavAuth imported lazily to avoid circular dep
async function getUpdateNavAuth() {
    const { updateNavAuth } = await
    import ('../app.js');
    return updateNavAuth;
}

export async function renderLogin() {
    if (api.isLoggedIn()) { router.navigate('/'); return; }

    const container = document.getElementById('page-container');
    container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" aria-labelledby="loginTitle">
        <div class="auth-icon" aria-hidden="true">◈</div>
        <h1 class="auth-title" id="loginTitle">Masuk ke StoryMap</h1>
        <p class="auth-subtitle">Selamat datang kembali!</p>

        <div id="loginAlert" class="auth-error hidden" role="alert"></div>

        <form id="loginForm" novalidate aria-label="Form masuk">
          <div class="form-group" id="grpEmail">
            <label class="form-label" for="loginEmail">Email</label>
            <input
              type="email" id="loginEmail" class="form-input"
              placeholder="nama@email.com" required
              autocomplete="email" aria-required="true" aria-describedby="emailErr"
            />
            <span class="form-error" id="emailErr" role="alert">Masukkan email yang valid</span>
          </div>
          <div class="form-group" id="grpPass">
            <label class="form-label" for="loginPass">Password</label>
            <input
              type="password" id="loginPass" class="form-input"
              placeholder="Minimal 8 karakter" required
              autocomplete="current-password" aria-required="true" aria-describedby="passErr"
            />
            <span class="form-error" id="passErr" role="alert">Password minimal 8 karakter</span>
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="loginBtn">Masuk</button>
        </form>

        <div class="auth-footer">
          Belum punya akun? <a href="#/register" aria-label="Daftar akun baru">Daftar sekarang</a>
        </div>
        <div class="auth-footer" style="margin-top:.5rem">
          <small>Atau <a href="#/add" aria-label="Tambah cerita tanpa akun">lanjut tanpa akun</a> (guest)</small>
        </div>
      </div>
    </div>
  `;

    document.getElementById('loginForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value;
        const alert = document.getElementById('loginAlert');
        const btn = document.getElementById('loginBtn');

        let valid = true;
        if (!isValidEmail(email)) {
            document.getElementById('grpEmail').classList.add('has-error');
            valid = false;
        } else document.getElementById('grpEmail').classList.remove('has-error');
        if (pass.length < 8) {
            document.getElementById('grpPass').classList.add('has-error');
            valid = false;
        } else document.getElementById('grpPass').classList.remove('has-error');
        if (!valid) return;

        btn.disabled = true;
        btn.textContent = '⏳ Masuk...';
        alert.classList.add('hidden');

        try {
            await api.login(email, pass);
            const updateNavAuth = await getUpdateNavAuth();
            updateNavAuth();
            showToast('Login berhasil! Selamat datang 🎉', 'success');
            router.navigate('/');
        } catch (err) {
            alert.textContent = err.message;
            alert.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Masuk';
        }
    });
}

export async function renderRegister() {
    if (api.isLoggedIn()) { router.navigate('/'); return; }

    const container = document.getElementById('page-container');
    container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" aria-labelledby="regTitle">
        <div class="auth-icon" aria-hidden="true">◈</div>
        <h1 class="auth-title" id="regTitle">Buat Akun Baru</h1>
        <p class="auth-subtitle">Mulai berbagi ceritamu hari ini!</p>

        <div id="regAlert" class="auth-error hidden" role="alert"></div>
        <div id="regSuccess" class="auth-success hidden" role="status"></div>

        <form id="regForm" novalidate aria-label="Form pendaftaran">
          <div class="form-group" id="grpName">
            <label class="form-label" for="regName">Nama Lengkap</label>
            <input
              type="text" id="regName" class="form-input"
              placeholder="Nama Anda" required
              autocomplete="name" aria-required="true"
            />
            <span class="form-error" role="alert">Nama wajib diisi</span>
          </div>
          <div class="form-group" id="grpEmail">
            <label class="form-label" for="regEmail">Email</label>
            <input
              type="email" id="regEmail" class="form-input"
              placeholder="nama@email.com" required
              autocomplete="email" aria-required="true"
            />
            <span class="form-error" role="alert">Masukkan email yang valid</span>
          </div>
          <div class="form-group" id="grpPass">
            <label class="form-label" for="regPass">Password</label>
            <input
              type="password" id="regPass" class="form-input"
              placeholder="Minimal 8 karakter" required
              autocomplete="new-password" aria-required="true"
            />
            <span class="form-error" role="alert">Password minimal 8 karakter</span>
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="regBtn">Daftar Sekarang</button>
        </form>

        <div class="auth-footer">
          Sudah punya akun? <a href="#/login" aria-label="Masuk ke akun">Masuk</a>
        </div>
      </div>
    </div>
  `;

    document.getElementById('regForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPass').value;
        const alert = document.getElementById('regAlert');
        const success = document.getElementById('regSuccess');
        const btn = document.getElementById('regBtn');

        let valid = true;
        if (!name) {
            document.getElementById('grpName').classList.add('has-error');
            valid = false;
        } else document.getElementById('grpName').classList.remove('has-error');
        if (!isValidEmail(email)) {
            document.getElementById('grpEmail').classList.add('has-error');
            valid = false;
        } else document.getElementById('grpEmail').classList.remove('has-error');
        if (pass.length < 8) {
            document.getElementById('grpPass').classList.add('has-error');
            valid = false;
        } else document.getElementById('grpPass').classList.remove('has-error');
        if (!valid) return;

        btn.disabled = true;
        btn.textContent = '⏳ Mendaftar...';
        alert.classList.add('hidden');
        success.classList.add('hidden');

        try {
            await api.register(name, email, pass);
            success.textContent = '🎉 Pendaftaran berhasil! Mengarahkan ke halaman login...';
            success.classList.remove('hidden');
            setTimeout(() => router.navigate('/login'), 2000);
        } catch (err) {
            alert.textContent = err.message;
            alert.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Daftar Sekarang';
        }
    });
}