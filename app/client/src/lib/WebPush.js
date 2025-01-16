export class WebPush {
    static SERVICE_WORKER_URL = 'service-worker.js';

    static urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    static async register(vapidPublicKey) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            throw new Error('WebPush is not supported');
        }

        const registration = await navigator.serviceWorker.register(WebPush.SERVICE_WORKER_URL);
        const permission = await Notification.requestPermission();

        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            return null;
        }

        if (permission !== 'granted') {
            throw new Error('Permission denied');
        }

        const convertedVapidKey = WebPush.urlBase64ToUint8Array(vapidPublicKey);

        return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
        });
    }
}
