// Dark by default. The choice is remembered on this device. The cascade map stays dark in both themes.
import React, { useState } from 'react';
import { tr, useLang } from './i18n.ts';
import { loadSettings, saveSettings } from './settings.js';

export const applyTheme = (theme) => { document.documentElement.dataset.theme = theme; };

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => loadSettings().theme);
  const [lang] = useLang();
  const next = theme === 'dark' ? 'light' : 'dark';
  const change = () => { saveSettings({ theme: next }); applyTheme(next); setTheme(next); };
  const label = next === 'light' ? tr(lang, 'theme.light') : tr(lang, 'theme.dark');
  return (
    <button type="button" className="theme-toggle" onClick={change} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <span aria-hidden="true" className="theme-ic">
        {next === 'light' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
      <span className="theme-word">{label}</span>
    </button>
  );
}
