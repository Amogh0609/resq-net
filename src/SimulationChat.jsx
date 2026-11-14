// Floating action button and chat drawer using server-side Gemini (/api/chat)
// and Real-Time Live Voice (/live).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildSuggestedQuestions, formatChatPayload } from './chatContext.js';
import { tr, useLang } from './i18n.ts';
import LiveVoicePanel from './components/LiveVoicePanel.tsx';

function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={idx}>{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedMessage({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="chat-msg-text">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="chat-gap" />;
        if (/^[-*•]\s+/.test(trimmed)) {
          return <div key={i} className="chat-bullet">• {renderInline(trimmed.replace(/^[-*•]\s+/, ''))}</div>;
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

export default function SimulationChat({ simContext, page, firebaseUser }) {
  const [lang] = useLang();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('chat'); // chat | voice
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = useMemo(() => buildSuggestedQuestions(simContext), [simContext]);

  const statusTag = useMemo(() => {
    if (page === 'gmaps') return 'Live Google Map';
    if (page !== 'cascade' || !simContext) return page === 'citizen' ? 'Citizen alerts' : 'Help desk';
    if (simContext.activeScenario) {
      return `${simContext.activeScenario.label} · Hr ${simContext.activeScenario.currentHour ?? 0}`;
    }
    if (simContext.mode === 'weak') return 'Weakest links';
    return 'City baseline';
  }, [page, simContext]);

  const contextSummary = useMemo(() => {
    if (page !== 'cascade' || !simContext) {
      return 'Ask about ResQ-Net cascade simulations or live voice dispatch.';
    }
    if (simContext.metrics) {
      const m = simContext.metrics;
      return `Resilience ${m.resilienceIndex}/100 · ${m.hospitalsDownAtCurrentHour} down · ${m.hospitalsOnBackupAtCurrentHour} on backup · ${simContext.alertsSummary?.total ?? 0} alerts`;
    }
    if (simContext.mode === 'weak' && simContext.weakestLinksTop5?.length) {
      return `Showing top ${simContext.weakestLinksTop5.length} weakest infrastructure nodes by hospital-hours lost.`;
    }
    if (simContext.cityBaseline) {
      const b = simContext.cityBaseline;
      return `${b.hospitals} hospitals · ${b.substations} substations · ${b.weakLinksPct}% weak links · No scenario running`;
    }
    return 'Ready to analyze Bengaluru cascade simulations.';
  }, [page, simContext]);

  useEffect(() => {
    if (open && tab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open, tab]);

  useEffect(() => {
    if (listRef.current && tab === 'chat') {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, busy, open, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sendMessage = async (rawText) => {
    const text = (rawText ?? input).trim();
    if (!text || busy) return;
    setError(null);
    const nextHistory = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    if (rawText == null) setInput('');
    setBusy(true);
    try {
      const payload = formatChatPayload({
        message: text,
        history: messages,
        context: simContext || { page },
      });
      const headers = { 'Content-Type': 'application/json' };
      if (firebaseUser) {
        try {
          headers.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;
        } catch {
          // Proceed without archival header
        }
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || 'No response generated.' }]);
    } catch (err) {
      setError(err.message || 'Could not reach simulation assistant.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`chat-fab-wrap in-${page}`}>
      {open && (
        <section className="chat-panel" role="dialog" aria-label="ResQ-Net Simulation Assistant">
          <header className="chat-head">
            <div className="chat-head-title">
              <span className="chat-dot" aria-hidden="true" />
              <div>
                <div className="chat-title">ResQ-Net Assistant</div>
                <div className="chat-sub">{statusTag}</div>
              </div>
            </div>
            <div className="chat-head-actions">
              {tab === 'chat' && messages.length > 0 && (
                <button type="button" className="chat-icon-btn" onClick={() => { setMessages([]); setError(null); }} title="Clear conversation">
                  Clear
                </button>
              )}
              <button type="button" className="chat-icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
                ×
              </button>
            </div>
          </header>

          <div className="chat-mode-tabs" role="tablist" aria-label="Assistant modes">
            {[
              ['chat', 'Ask AI'],
              ['voice', 'Live Voice'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'on' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="chat-ctx" title="Live state sent to assistant">{contextSummary}</div>

          {tab === 'chat' && (
            <>
              <div className="chat-body" ref={listRef} role="log" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="chat-welcome">
                    <p>Ask anything about the active Bengaluru simulation, failing hospitals, Cauvery supply chain, weak links, or recommended fixes.</p>
                    <div className="chat-chips">
                      {suggestions.map((q) => (
                        <button key={q} type="button" className="chat-chip" onClick={() => sendMessage(q)} disabled={busy}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className={`chat-msg ${m.role}`}>
                      <div className="chat-msg-role">{m.role === 'user' ? 'You' : 'ResQ-Net AI'}</div>
                      <FormattedMessage text={m.content} />
                    </div>
                  ))
                )}
                {busy && (
                  <div className="chat-msg assistant pending">
                    <div className="chat-msg-role">ResQ-Net AI</div>
                    <div className="chat-thinking">Analyzing simulation state…</div>
                  </div>
                )}
                {error && (
                  <div className="chat-err" role="alert">
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <form className="chat-form" onSubmit={handleSubmit}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about the current simulation…"
                  aria-label="Ask a question about the simulation"
                  disabled={busy}
                />
                <button type="submit" className="chat-send" disabled={busy || !input.trim()}>
                  {busy ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}

          {tab === 'voice' && (
            <div className="chat-body">
              <LiveVoicePanel />
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className={`chat-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close ResQ-Net AI assistant' : 'Ask ResQ-Net AI about simulation'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{open ? 'Close AI' : tr(lang, 'chat.askAi')}</span>
        {simContext?.activeScenario && !open && <em className="chat-live" title="Simulation running" />}
      </button>
    </div>
  );
}
