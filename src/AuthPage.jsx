// Log in and sign up for the three roles. Emergency numbers stay reachable without an account.
import React, { useState } from 'react';
import { AGENCY_DEPARTMENTS, DEMO_ACCOUNTS, ROLES, logIn, signUp } from './auth.js';
import { signInWithGoogle } from './lib/cloudSync.ts';
import { EMERGENCY } from './contacts.js';
import { LANG_LABELS, tr, useLang } from './i18n.ts';
import { ThemeToggle } from './ThemeToggle.jsx';
import { THEME_BUTTON_PHOTOS } from './buttonPhotos.ts';

function demoPhotoFor(d) {
  if (d.agency === 'BWSSB') return THEME_BUTTON_PHOTOS.monsoon;
  if (d.agency === 'KPTCL') return THEME_BUTTON_PHOTOS.power;
  if (d.role === 'admin') return THEME_BUTTON_PHOTOS.hospital;
  return THEME_BUTTON_PHOTOS.skyline;
}

function Field({ label, id, hint, ...props }) {
  return (
    <div className="au-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
      {hint && <div className="au-hint">{hint}</div>}
    </div>
  );
}

export default function AuthPage({ onDone, onFirebaseUser, onGuest }) {
  const [lang, setLang] = useLang();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen', agency: '', code: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchMode = (m) => { setMode(m); setError(null); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      onDone(mode === 'login' ? await logIn(form.email, form.password) : await signUp(form));
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const googleLogin = async () => {
    setBusy(true); setError(null);
    try {
      const { firebaseUser, appUser } = await signInWithGoogle();
      onFirebaseUser?.(firebaseUser);
      onDone(appUser);
    } catch (err) {
      setError(err?.message || 'Google sign-in failed.');
      setBusy(false);
    }
  };
  const fillDemo = (d) => { switchMode('login'); setForm((f) => ({ ...f, email: d.email, password: d.password })); };

  return (
    <div className="au-page cz">
      <main className="au-card">
        <div className="au-top">
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
        </div>
        <div className="au-brand"><span className="logo">ResQ-<span>Net</span></span><p>{tr(lang, 'auth.tagline')}</p></div>

        <button type="button" className="au-google" disabled={busy} onClick={googleLogin}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
          </svg>
          <span>{tr(lang, 'auth.google')}</span>
        </button>

        <div className="au-tabs" role="group" aria-label="Log in or sign up">
          <button className={mode === 'login' ? 'on' : ''} aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>{tr(lang, 'auth.login')}</button>
          <button className={mode === 'signup' ? 'on' : ''} aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>{tr(lang, 'auth.signup')}</button>
        </div>

        <form onSubmit={submit} noValidate>
          {mode === 'signup' && (
            <>
              <fieldset className="au-roles">
                <legend>I am a</legend>
                {Object.entries(ROLES).map(([id, r]) => (
                  <label key={id} className={form.role === id ? 'on' : ''}>
                    <input type="radio" name="role" value={id} checked={form.role === id} onChange={set('role')} />
                    <span><b>{r.label}</b>{r.blurb}</span>
                  </label>
                ))}
              </fieldset>
              <Field label={tr(lang, 'auth.fullName')} id="au-name" autoComplete="name" value={form.name} onChange={set('name')} />
              {form.role === 'officer' && (
                <div className="au-field">
                  <label htmlFor="au-agency">Department</label>
                  <select id="au-agency" value={form.agency} onChange={set('agency')}>
                    <option value="">Choose your department</option>
                    {Object.keys(AGENCY_DEPARTMENTS).map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <Field label={tr(lang, 'auth.email')} id="au-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          <div className="au-field">
            <label htmlFor="au-password">{tr(lang, 'auth.password')}</label>
            <div className="au-password">
              <input id="au-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>{showPassword ? tr(lang, 'auth.hide') : tr(lang, 'auth.show')}</button>
            </div>
            {mode === 'signup' && <div className="au-hint">At least 8 characters.</div>}
          </div>
          {mode === 'signup' && form.role !== 'citizen' && (
            <Field label="Access code" id="au-code" autoComplete="off" hint={`Staff accounts need a code from your department. For this demo: ${form.role === 'officer' ? 'DEMO-OFFICER' : 'DEMO-ADMIN'}`} value={form.code} onChange={set('code')} />
          )}
          {error && <p className="au-error" role="alert">{error}</p>}
          <button className="au-submit" disabled={busy}>{busy ? tr(lang, 'auth.pleaseWait') : mode === 'login' ? tr(lang, 'auth.login') : tr(lang, 'auth.createAccount')}</button>
        </form>

        <button className="au-guest" onClick={onGuest}>{tr(lang, 'auth.guestBtn')}</button>

        <section className="au-demo" aria-label="Demo accounts">
          <h2>{tr(lang, 'auth.demoTitle')}</h2>
          <div className="au-demo-list">
            {DEMO_ACCOUNTS.map((d) => (
              <button key={d.email} type="button" onClick={() => fillDemo(d)}>
                <img className="au-demo-pic" src={demoPhotoFor(d)} alt="" referrerPolicy="no-referrer" />
                <div className="au-demo-meta">
                  <b>{d.agency ? `${d.agency} officer` : ROLES[d.role].label}</b><span>{d.email}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="au-hint">{tr(lang, 'auth.demoHint')}</p>
        </section>

        <div className="au-emergency">
          <span>{tr(lang, 'auth.emergency')}</span>
          {EMERGENCY.map((e) => <a key={e.number} href={`tel:${e.number}`} aria-label={`${e.label}: ${e.number}`}><b>{e.number}</b> {e.label}</a>)}
        </div>
      </main>
    </div>
  );
}
