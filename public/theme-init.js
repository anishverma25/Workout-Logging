// Apply the saved theme before first paint to avoid a flash. A separate file (not inline) so
// the Content Security Policy can forbid inline scripts.
(function () {
  try {
    var pref = localStorage.getItem('overload.theme') || 'system';
    var dark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
