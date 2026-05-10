
class Router {
  #routes = new Map();
  #beforeEach = null;
  #isNavigating = false;

  add(path, handler) {
    this.#routes.set(path, handler);
    return this;
  }

  beforeEach(fn) {
    this.#beforeEach = fn;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  async #handle(hash) {
    if (this.#isNavigating) return;
    this.#isNavigating = true;

    try {
      const path = hash.replace(/^#/, '') || '/';

      // Match route
      let handler = null;
      let params = {};
      for (const [route, fn] of this.#routes) {
        const m = this.#match(route, path);
        if (m !== null) { handler = fn; params = m; break; }
      }
      if (!handler) handler = this.#routes.get('/404') || (() => this.#notFound());

      // Guard
      if (this.#beforeEach) {
        const allow = await this.#beforeEach(path, params);
        if (allow === false) return;
      }

      const container = document.getElementById('page-container');

      // View Transition API (Kriteria Wajib)
      if (document.startViewTransition && container) {
        const transition = document.startViewTransition(async () => {
          await handler(params);
          this.#updateActive(path);
        });

        await transition.finished.catch(() => {});
      } else if (container) {
        // Fallback untuk browser yang tidak mendukung View Transition API
        container.style.opacity = '0';
        await new Promise(r => setTimeout(r, 150));
        await handler(params);
        container.style.opacity = '1';
        this.#updateActive(path);
      } else {
        await handler(params);
        this.#updateActive(path);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Accessibility: fokus ke main content
      const main = document.getElementById('main-content');
      if (main) {
        main.focus({ preventScroll: true });
      }

    } finally {
      this.#isNavigating = false;
    }
  }

  #match(route, path) {
    const rParts = route.split('/');
    const pParts = path.split('/');
    if (rParts.length !== pParts.length) return null;
    const params = {};
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) {
        params[rParts[i].slice(1)] = decodeURIComponent(pParts[i] || '');
      } else if (rParts[i] !== pParts[i]) {
        return null;
      }
    }
    return params;
  }

  #updateActive(path) {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.classList.remove('active');
      const page = link.dataset.page;
      if (path === '/' && page === 'home') link.classList.add('active');
      else if (page !== 'home' && path.startsWith(`/${page}`)) link.classList.add('active');
    });
  }

  #notFound() {
    const container = document.getElementById('page-container');
    if (container) container.innerHTML = `
      <div class="page text-center">
        <div class="container">
          <div style="font-size:5rem;margin-bottom:1rem">🗺️</div>
          <h1 class="page-title">404</h1>
          <p class="text-muted" style="margin-bottom:2rem">Halaman tidak ditemukan.</p>
          <a href="#/" class="btn btn-primary">Kembali ke Beranda</a>
        </div>
      </div>`;
  }

  init() {
    const handle = () => this.#handle(window.location.hash);
    window.addEventListener('hashchange', handle);
    handle(); // handle initial route
    return this;
  }
}

export const router = new Router();
