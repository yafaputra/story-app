import { VAPID_PUBLIC_KEY, api } from './api.js';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushSubscription() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.ready;
        return await reg.pushManager.getSubscription();
    } catch { return null; }
}

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result;
}

export async function subscribePush() {
    if (!api.isLoggedIn()) throw new Error('Harus login terlebih dahulu');

    const permission = await requestNotificationPermission();
    if (permission === 'denied') throw new Error('Izin notifikasi telah ditolak. Aktifkan di pengaturan browser.');
    if (permission !== 'granted') throw new Error('Izin notifikasi diperlukan untuk mengaktifkan push notification');

    const reg = await navigator.serviceWorker.ready;

    if (Notification.permission !== 'granted') {
        throw new Error('Izin notifikasi belum diberikan. Tidak dapat mendaftarkan push subscription.');
    }

    const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await api.subscribePush(subscription);
    localStorage.setItem('pushSubscribed', 'true');
    return subscription;
}

export async function unsubscribePush() {
    const sub = await getPushSubscription();
    if (!sub) { localStorage.removeItem('pushSubscribed'); return; }
    try { await api.unsubscribePush(sub.endpoint); } catch {}
    await sub.unsubscribe();
    localStorage.removeItem('pushSubscribed');
}

export function isPushSubscribed() {
    return localStorage.getItem('pushSubscribed') === 'true';
}