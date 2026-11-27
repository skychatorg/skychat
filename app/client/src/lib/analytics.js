const RYBBIT_HOST = 'https://stats.7ph.dev';

/**
 * Loads Rybbit when the server gives a site id (production only), so dev sends nothing. URLs hold no secret: rooms are
 * counted by id, and Rybbit's site settings drop query strings
 */
export async function startAnalytics(router) {
    let siteId = null;
    try {
        ({ rybbitSiteId: siteId } = await (await fetch('/api/analytics')).json());
    } catch {
        // No analytics: the page works the same
    }
    if (!siteId) {
        return;
    }
    const script = document.createElement('script');
    script.src = `${RYBBIT_HOST}/api/script.js`;
    script.defer = true;
    script.dataset.siteId = siteId;
    document.head.appendChild(script);
    // Rybbit's own SPA tracking is off, since vue-router's replaceState calls would each count: one pageview per path
    // change here. The first page is counted by the script itself when it loads
    router.afterEach((to, from) => {
        if (from.matched.length && to.path !== from.path) {
            requestAnimationFrame(() => window.rybbit?.pageview());
        }
    });
}
