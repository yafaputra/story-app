
const DB_NAME = 'storymap_db';
const DB_VERSION = 2;
const STORE_FAV = 'favorites';
const STORE_QUEUE = 'offline_queue';
const STORE_CACHE = 'cached_stories';

class IDBService {
  #db = null;

  open() {
    if (this.#db) return Promise.resolve(this.#db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_FAV)) {
          const s = db.createObjectStore(STORE_FAV, { keyPath: 'id' });
          s.createIndex('savedAt', 'savedAt');
          s.createIndex('name', 'name');
          s.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const s = db.createObjectStore(STORE_QUEUE, { keyPath: 'queueId', autoIncrement: true });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          const s = db.createObjectStore(STORE_CACHE, { keyPath: 'id' });
          s.createIndex('cachedAt', 'cachedAt');
        }
      };
      req.onsuccess = (e) => { this.#db = e.target.result; resolve(this.#db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async #store(name, mode = 'readonly') {
    const db = await this.open();
    return db.transaction(name, mode).objectStore(name);
  }

  #p(req) {
    return new Promise((res, rej) => {
      req.onsuccess = (e) => res(e.target.result);
      req.onerror = (e) => rej(e.target.error);
    });
  }

  // ---- FAVORITES ----
  async addFavorite(story) {
    const s = await this.#store(STORE_FAV, 'readwrite');
    return this.#p(s.put({ ...story, savedAt: new Date().toISOString() }));
  }

  async removeFavorite(id) {
    const s = await this.#store(STORE_FAV, 'readwrite');
    return this.#p(s.delete(id));
  }

  async isFavorite(id) {
    const s = await this.#store(STORE_FAV);
    const r = await this.#p(s.get(id));
    return !!r;
  }

  async getAllFavorites() {
    const s = await this.#store(STORE_FAV);
    return this.#p(s.getAll());
  }

  async getFavoritesCount() {
    const s = await this.#store(STORE_FAV);
    return this.#p(s.count());
  }

  // ---- OFFLINE QUEUE ----
  async addToQueue(data) {
    const s = await this.#store(STORE_QUEUE, 'readwrite');
    return this.#p(s.add({ ...data, createdAt: new Date().toISOString(), status: 'pending' }));
  }

  async getQueue() {
    const s = await this.#store(STORE_QUEUE);
    return this.#p(s.getAll());
  }

  async removeFromQueue(queueId) {
    const s = await this.#store(STORE_QUEUE, 'readwrite');
    return this.#p(s.delete(Number(queueId)));
  }

  async clearQueue() {
    const s = await this.#store(STORE_QUEUE, 'readwrite');
    return this.#p(s.clear());
  }

  // ---- CACHED STORIES ----
  async cacheStories(stories) {
    const db = await this.open();
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    const now = new Date().toISOString();
    for (const story of stories) {
      store.put({ ...story, cachedAt: now });
    }
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  }

  async getCachedStories() {
    const s = await this.#store(STORE_CACHE);
    return this.#p(s.getAll());
  }

  async getCachedStory(id) {
    const s = await this.#store(STORE_CACHE);
    return this.#p(s.get(id));
  }
}

export const idb = new IDBService();
