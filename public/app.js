// ==========================================================================
// BRE AI - Legacy Loader & Backward Compatibility Layer
// File: public/app.js
// ==========================================================================

(function() {
  if (window.__BRE_APP_LOADED__) return;

  const scripts = [
    '/js/app/state.js?v=3.5',
    '/js/app/ui.js?v=3.5',
    '/js/app/media.js?v=3.5',
    '/js/app/chat.js?v=3.5'
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
