// ==========================================================================
// BRE AI - Legacy Loader & Backward Compatibility Layer
// File: public/admin.js
// ==========================================================================

(function() {
  if (window.__BRE_ADMIN_LOADED__) return;

  const scripts = [
    '/js/admin/utils.js',
    '/js/admin/providers.js',
    '/js/admin/telemetry.js',
    '/js/admin/details.js',
    '/js/admin/config.js',
    '/js/admin/telegram.js',
    '/js/admin/cloud.js',
    '/js/admin/tester.js',
    '/js/admin/audit.js',
    '/js/admin/core.js'
  ];

  if (document.readyState === 'loading') {
    scripts.forEach(src => {
      document.write('<script src="' + src + '"><\/script>');
    });
  } else {
    scripts.reduce((p, src) => p.then(() => new Promise(resolve => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    })), Promise.resolve());
  }
})();
