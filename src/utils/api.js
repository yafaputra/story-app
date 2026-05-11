// ============================================================
// API Service - Dicoding Story API
// ============================================================

const BASE_URL = 'https://story-api.dicoding.dev/v1';

export const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Zvlars8MgAEOo1YRpB03YKF1HGkLbCEivJgbcXDRSFnB0HAzNjiEi6P8s';

class ApiService {
  #token = null;

  setToken(token) {
    this.#token = token;
    if (token) localStorage.setItem('authToken', token);
    else localStorage.removeItem('authToken');
  }

  getToken() {
    if (!this.#token) this.#token = localStorage.getItem('authToken');
    return this.#token;
  }

  isLoggedIn() { return !!this.getToken(); }

  #authHeader() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async #request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === 'TimeoutError') throw new Error('Request timeout. Periksa koneksi internet.');
      if (err.name === 'TypeError') throw new Error('Tidak dapat terhubung ke server.');
      throw err;
    }
  }

  async register(name, email, password) {
    return this.#request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
  }

  async login(email, password) {
    const data = await this.#request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (data.loginResult?.token) {
      this.setToken(data.loginResult.token);
      localStorage.setItem('userName', data.loginResult.name);
      localStorage.setItem('userId', data.loginResult.userId);
    }
    return data;
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
  }

  async getStories({ page = 1, size = 20, location = 1 } = {}) {
    const params = new URLSearchParams({ page, size, location });
    return this.#request(`/stories?${params}`, {
      headers: this.#authHeader(),
    });
  }

  async getStoryById(id) {
    return this.#request(`/stories/${id}`, {
      headers: this.#authHeader(),
    });
  }

  async addStory(formData) {
    return this.#request('/stories', {
      method: 'POST',
      headers: this.#authHeader(),
      body: formData,
    });
  }

  async addStoryGuest(formData) {
    return this.#request('/stories/guest', {
      method: 'POST',
      body: formData,
    });
  }

  async subscribePush(subscription) {
    const sub = subscription.toJSON();
    return this.#request('/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.#authHeader() },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      }),
    });
  }

  async unsubscribePush(endpoint) {
    return this.#request('/notifications/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...this.#authHeader() },
      body: JSON.stringify({ endpoint }),
    });
  }
}

export const api = new ApiService();
