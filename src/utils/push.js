// ============================================================
// Push Notification Utility
// ============================================================

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

export function isNotificationAvailable() {
  return 'Notification' in window;
}

export function isNotificationGranted() {
  return Notification.permission === 'granted';
}

export async function requestNotificationPermission() {
  if (!isNotificationAvailable()) {
    console.error('Notification API tidak didukung oleh browser ini.');
    return false;
  }

  if (isNotificationGranted()) {
    return true;
  }

  if (Notification.permission === 'denied') {
    alert('Izin notifikasi telah ditolak. Silakan aktifkan notifikasi di pengaturan browser Anda.');
    return false;
  }

  const status = await Notification.requestPermission();

  if (status === 'denied') {
    alert('Izin notifikasi ditolak.');
    return false;
  }

  if (status === 'default') {
    alert('Izin notifikasi ditutup atau diabaikan.');
    return false;
  }

  return true;
}

export async function getPushSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

export async function subscribePush() {
  if (!api.isLoggedIn()) throw new Error('Harus login terlebih dahulu');

  // Minta izin notifikasi secara eksplisit sebelum proses subscribe
  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    throw new Error('Izin notifikasi diperlukan untuk mengaktifkan push notification.');
  }

  // Cek apakah sudah berlangganan sebelumnya
  const existingSub = await getPushSubscription();
  if (existingSub) {
    console.log('Sudah berlangganan push notification.');
    localStorage.setItem('pushSubscribed', 'true');
    return existingSub;
  }

  const reg = await navigator.serviceWorker.ready;
  let subscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (error) {
    console.error('subscribePush: gagal subscribe ke push manager:', error);
    throw new Error('Gagal berlangganan push notification.');
  }

  try {
    await api.subscribePush(subscription);
    localStorage.setItem('pushSubscribed', 'true');
    return subscription;
  } catch (error) {
    // Batalkan subscribe di sisi client jika penyimpanan ke server gagal
    console.error('subscribePush: gagal menyimpan langganan ke server:', error);
    await subscription.unsubscribe();
    throw new Error('Gagal menyimpan langganan ke server. Silakan coba lagi.');
  }
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
