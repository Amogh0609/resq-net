import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import App from './App.jsx';
import ComplaintsPage from './ComplaintsPage.jsx';
import HelpPage from './HelpPage.jsx';
import AuthPage from './AuthPage.jsx';
import GoogleMapsView from './components/GoogleMapsView.tsx';
import { ROLES, canOpen, currentUser, ensureDemoAccounts, logOut, homePage } from './auth.js';
import { auth } from './lib/firebase.ts';
import { signOutCloud, syncCloudUserProfile } from './lib/cloudSync.ts';
import { ThemeToggle, applyTheme } from './ThemeToggle.jsx';
import { LANG_LABELS, tr, useLang } from './i18n.ts';
import { loadSettings } from './settings.js';
import SimulationChat from './SimulationChat.jsx';
import './styles.css';

// Before the first paint, so a light-theme user never sees a dark flash.
applyTheme(loadSettings().theme);

// Tier-1 Demo Key Quota Detection (fires before Maps API initializes)
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { tier: 1, reason: 'authFailure' } }));
  };
  const origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const joined = args.map((a) => String(a ?? '')).join(' ');
    if (/OverQuotaMapError|QuotaExceededError|OVER_QUERY_LIMIT/i.test(joined)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { tier: 1, reason: 'consoleError' } }));
    }
    origConsoleError(...args);
  };
}

const PAGES = [
  { id: 'citizen', href: '#/citizen', label: 'Citizen alerts', short: 'Alerts', officerLabel: 'Department desk', officerShort: 'Desk' },
  { id: 'gmaps', href: '#/gmaps', label: 'Live Map', short: 'Map' },
  { id: 'cascade', href: '#/cascade', label: 'Cascade analysis', short: 'Cascade' },
  { id: 'help', href: '#/help', label: 'Help desk & settings', short: 'Help' },
];
const GUEST = { role: 'guest', name: 'Guest' };

function pageFromHash() {
  const h = window.location.hash;
  if (h.startsWith('#/citizen') || h.startsWith('#/complaints')) return 'citizen';
  if (h.startsWith('#/gmaps')) return 'gmaps';
  if (h.startsWith('#/help')) return 'help';
  if (h.startsWith('#/cascade')) return 'cascade';
  return null;
}

function Root() {
  const [lang, setLang] = useLang();
  const [user, setUser] = useState(() => currentUser());
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [wanted, setWanted] = useState(pageFromHash);
  const [simContext, setSimContext] = useState(null);
  const [quotaBanner, setQuotaBanner] = useState(false);

  useEffect(() => {
    const onQuota = () => setQuotaBanner(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    let settled = false;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser && fbUser.emailVerified ? fbUser : null);
      if (fbUser && fbUser.emailVerified) {
        try {
          const synced = await syncCloudUserProfile(fbUser);
          setUser((prev) => (prev && prev.isFirebase && prev.uid === synced.uid ? synced : prev || synced));
        } catch {
          // Keep existing local session if profile sync fails offline
        }
      }
      if (!settled) {
        settled = true;
        setReady(true);
      }
    });
    ensureDemoAccounts().catch(() => {}).finally(() => {
      if (!settled) {
        settled = true;
        setReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const on = () => setWanted(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // A page this role can't open falls back to its home page, and the address follows.
  const page = user && (wanted && canOpen(user.role, wanted) ? wanted : homePage(user.role));
  useEffect(() => {
    if (page && page !== wanted) window.location.hash = `#/${page}`;
  }, [page, wanted]);

  if (!ready) return null;
  if (!user) {
    return (
      <AuthPage
        onDone={setUser}
        onFirebaseUser={setFirebaseUser}
        onGuest={() => setUser(GUEST)}
      />
    );
  }
  const signOut = () => {
    logOut();
    signOutCloud().catch(() => {});
    setFirebaseUser(null);
    setUser(null);
    window.location.hash = '#/';
  };
  const officer = user.role === 'officer';
  const roleLabel = ROLES[user.role]?.label || user.role;
  const who = user.role === 'guest' ? tr(lang, 'auth.guest') : `${user.name} · ${officer ? `${user.agency} officer` : roleLabel}`;
  return (
    <div className={`shell ${officer || user.role === 'admin' ? '' : 'cz'}`}>
      {quotaBanner && (
        <div className="gmp-quota-banner" role="status">
          <span>
            Google Maps demo quota temporarily reached. Try switching to Cascade Map or try again shortly.
          </span>
          <button type="button" onClick={() => setQuotaBanner(false)} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}
      <header className="shell-nav">
        <a className="shell-brand logo" href={`#/${homePage(user.role)}`} aria-label="ResQ-Net home">ResQ-<span>Net</span></a>
        <nav aria-label="Pages">
          {PAGES.filter((p) => canOpen(user.role, p.id)).map((p) => {
            const longText = officer && p.id === 'citizen' ? tr(lang, 'nav.officer.citizen') : tr(lang, `nav.${p.id}`);
            const shortText = officer && p.id === 'citizen' ? tr(lang, 'nav.officer.citizen.short') : tr(lang, `nav.${p.id}.short`);
            return (
              <a key={p.id} href={p.href} className={page === p.id ? 'on' : ''} aria-current={page === p.id ? 'page' : undefined}>
                <span className="long">{longText}</span><span className="short">{shortText}</span>
              </a>
            );
          })}
        </nav>
        <div className="shell-user">
          <span className="shell-who" title={user.email}>{who}</span>
          <select
            className="shell-lang"
            aria-label={tr(lang, 'lang.label')}
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {Object.entries(LANG_LABELS).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <ThemeToggle />
          <button className="shell-logout" onClick={signOut}>{user.role === 'guest' ? tr(lang, 'auth.login') : tr(lang, 'auth.logout')}</button>
        </div>
      </header>
      <div className="shell-main">
        {page === 'citizen' && <ComplaintsPage key={user.id || 'guest'} user={user} firebaseUser={firebaseUser} onNeedLogin={signOut} />}
        {page === 'gmaps' && <GoogleMapsView key="gmaps" />}
        {page === 'help' && <HelpPage key={user.id || 'guest'} user={user} />}
        {page === 'cascade' && <App key={window.location.hash.split('?')[1] || 'cascade'} onSimContext={setSimContext} firebaseUser={firebaseUser} />}
      </div>
      <SimulationChat simContext={simContext} page={page} firebaseUser={firebaseUser} />
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="splash">
          <h1>ResQ-Net</h1>
          <p className="err">{this.state.error.message || 'Something went wrong.'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><Root /></ErrorBoundary>);

// Offline cache + installable app in production; in dev, clear stale service workers so live edits always load.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    try {
      if (import.meta.env.PROD) {
        await navigator.serviceWorker.register('./sw.js');
        const reg = await navigator.serviceWorker.ready;
        const urls = [location.pathname, ...performance.getEntriesByType('resource').map((r) => r.name)
          .filter((u) => u.startsWith(location.origin))];
        reg.active?.postMessage({ type: 'cache-urls', urls });
      } else {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      }
    } catch { /* offline cache is optional */ }
  });
}
