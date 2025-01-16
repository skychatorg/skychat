self.addEventListener('push', function (event) {
    let data = {};
    if (event.data) {
        data = event.data.json();
    }

    const title = data.title ?? 'SkyChat Notification';
    const options = {
        body: data.body ?? 'New notification from SkyChat',
        icon: '/favicon.png',
    };

    event.waitUntil(self.registration.showNotification(title, options));
});
