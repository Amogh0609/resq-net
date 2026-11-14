// Bidirectional Real-Time Voice Conversation client using Gemini Live WS (/live)
import React, { useEffect, useRef, useState } from 'react';
import {
  base64ToInt16,
  buildLiveWsUrl,
  calculateNextPlayTime,
  float32ToInt16Base64,
  int16ToFloat32,
} from '../utils/liveAudio.ts';

interface TranscriptTurn {
  role: 'user' | 'assistant';
  text: string;
}

export default function LiveVoicePanel() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [textDraft, setTextDraft] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Refs for audio callback closures (never read stale React state inside onaudioprocess)
  const isConnectedRef = useRef(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = muted;

  const stopPlaybackQueue = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Ignore already stopped buffer source
      }
    }
    activeSourcesRef.current.clear();
    if (playCtxRef.current) {
      nextStartTimeRef.current = playCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  };

  const cleanupSession = () => {
    isConnectedRef.current = false;
    stopPlaybackQueue();
    if (procRef.current) {
      try {
        procRef.current.disconnect();
      } catch {}
      procRef.current.onaudioprocess = null;
      procRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    if (playCtxRef.current) {
      playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setStatus('idle');
  };

  useEffect(() => () => cleanupSession(), []);

  const appendTurnText = (role: 'user' | 'assistant', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        const sep = last.text.endsWith(' ') || clean.startsWith(' ') ? '' : ' ';
        return [...prev.slice(0, -1), { role, text: `${last.text}${sep}${clean}` }];
      }
      return [...prev, { role, text: clean }];
    });
  };

  const scheduleAudioChunk = (b64: string) => {
    const playCtx = playCtxRef.current;
    if (!playCtx) return;
    const pcm16 = base64ToInt16(b64);
    if (!pcm16.length) return;
    const float32 = int16ToFloat32(pcm16);
    const buffer = playCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const src = playCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(playCtx.destination);

    const { startTime, nextStartTime } = calculateNextPlayTime(
      playCtx.currentTime,
      nextStartTimeRef.current,
      buffer.duration
    );
    nextStartTimeRef.current = nextStartTime;

    activeSourcesRef.current.add(src);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
    };
    src.start(startTime);
  };

  const startVoiceSession = async () => {
    if (status === 'connecting' || status === 'connected') {
      cleanupSession();
      return;
    }
    setError(null);
    setStatus('connecting');

    try {
      const playCtx = new AudioContext({ sampleRate: 24000 });
      playCtxRef.current = playCtx;
      nextStartTimeRef.current = playCtx.currentTime;
      if (playCtx.state === 'suspended') await playCtx.resume();

      // Best-effort microphone access (typed Live fallback works even if browser lacks mic)
      let micReady = false;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
          });
          streamRef.current = stream;
          const micCtx = new AudioContext({ sampleRate: 16000 });
          micCtxRef.current = micCtx;
          const source = micCtx.createMediaStreamSource(stream);
          const processor = micCtx.createScriptProcessor(4096, 1, 1);
          procRef.current = processor;

          processor.onaudioprocess = (ev) => {
            if (!isConnectedRef.current || isMutedRef.current) return;
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            const float32 = ev.inputBuffer.getChannelData(0);
            const audio = float32ToInt16Base64(float32);
            ws.send(JSON.stringify({ audio }));
          };

          source.connect(processor);
          processor.connect(micCtx.destination);
          micReady = true;
        } catch {
          setError('Microphone permission unavailable; connected in typed/listen-only mode.');
        }
      }

      const ws = new WebSocket(buildLiveWsUrl(window.location));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.ready) {
            isConnectedRef.current = true;
            setStatus('connected');
            if (!micReady && !error) {
              setMuted(true);
            }
          }
          if (msg.inputTranscript) appendTurnText('user', msg.inputTranscript);
          if (msg.outputTranscript) appendTurnText('assistant', msg.outputTranscript);
          if (msg.audio) scheduleAudioChunk(msg.audio);
          if (msg.interrupted) stopPlaybackQueue();
          if (msg.error) {
            setError(msg.error);
            setStatus('error');
          }
          if (msg.closed) {
            cleanupSession();
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        setError('Live voice WebSocket connection failed.');
        cleanupSession();
      };

      ws.onclose = () => {
        isConnectedRef.current = false;
        setStatus((s) => (s === 'error' ? 'error' : 'idle'));
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize live audio.');
      cleanupSession();
    }
  };

  const sendLiveText = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = textDraft.trim();
    if (!txt || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: txt }));
    appendTurnText('user', txt);
    setTextDraft('');
  };

  return (
    <div className="lv-wrap">
      <div className="lv-controls">
        <button
          type="button"
          className={`lv-btn ${status === 'connected' ? 'on' : ''}`}
          onClick={startVoiceSession}
          disabled={status === 'connecting'}
        >
          {status === 'connected'
            ? 'End Live Dispatch'
            : status === 'connecting'
              ? 'Connecting…'
              : 'Start Live Voice'}
        </button>
        {status === 'connected' && (
          <button
            type="button"
            className="chat-icon-btn"
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
          >
            {muted ? 'Unmute Mic' : 'Mute Mic'}
          </button>
        )}
      </div>

      {error && <div className="chat-err">{error}</div>}

      <div className="lv-transcript" role="log" aria-live="polite">
        {turns.length === 0 ? (
          <p className="lv-empty">
            {status === 'connected'
              ? 'Listening on 16kHz PCM channel. Speak or send a quick dispatch line below.'
              : 'Connect for real-time two-way voice dispatch (16kHz mic in, 24kHz voice out).'}
          </p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={`chat-msg ${t.role}`}>
              <div className="chat-msg-role">{t.role === 'user' ? 'Operator' : 'Live Dispatch'}</div>
              <div>{t.text}</div>
            </div>
          ))
        )}
      </div>

      {status === 'connected' && (
        <form className="lv-text-form" onSubmit={sendLiveText}>
          <input
            type="text"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder="Send spoken/text cue…"
            aria-label="Send message to live voice session"
          />
          <button type="submit" className="chat-send" disabled={!textDraft.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
