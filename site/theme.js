(() => {
  'use strict';

  const storageKey = 'prototype-theme';
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const validPreference = value => value === 'light' || value === 'dark' ? value : null;
  let preference = null;
  try { preference = validPreference(localStorage.getItem(storageKey)); } catch { /* Storage may be blocked. */ }

  const applyTheme = () => {
    const dark = (preference ?? (systemDark.matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111522' : '#f5f2e9';
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  };

  // Runs before the stylesheet so a saved dark preference never paints a light page first.
  applyTheme();
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.theme-toggle');
    toggle.hidden = false;
    applyTheme();
    toggle.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, preference); } catch { /* Keep the in-page choice working. */ }
      applyTheme();
    });
  });
  systemDark.addEventListener('change', applyTheme);
  addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = validPreference(event.newValue);
    applyTheme();
  });
})();
