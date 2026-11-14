import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, ThinkingLevel, type LiveServerMessage } from '@google/genai';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  listFieldEscalations,
  listNegotiationRuns,
  saveChatExchange,
  saveFieldEscalation,
  saveNegotiationRun,
} from './src/db/users.ts';

const PORT = Number(process.env.PORT || 3000);

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 10000,
      retryOptions: {
        attempts: 1,
      },
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SYSTEM_PROMPT = `You are ResQ-Net AI, an operations assistant embedded in ResQ-Net, a Bengaluru critical-infrastructure cascade simulator.
You answer questions about the user's active ResQ-Net simulation state using the Live Simulation Context JSON provided in this prompt:
- Substations (KPTCL 220/66 kV & BESCOM 33/11 kV), Cauvery water pumping chain (TK Halli -> Harohalli -> Tataguni across Stages I-V), city reservoirs/tanks, hospitals (with diesel power backup and water storage hours), and telecom sites.
- Link strength (weak/medium/strong), Resilience Index (0-100 share of hospital-hours keeping both power and water), hospital-hours lost, weakest-link rankings, recommended 3-step fixes, and simulated agency alerts/responses (BWSSB, KPTCL, BESCOM, Hospitals).
- Always ground numbers in the provided Live Simulation Context when present (state clearly if no scenario is running yet). Keep answers concise, clear, and actionable.`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'resq-net' });
  });

  // Expose Google Maps public browser key safely if configured in server environment
  app.get('/api/config/maps', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ configured: Boolean(apiKey), apiKey });
  });

  // Gemini Chatbot endpoint (gemini-4-hydrogen)
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history = [], context = null } = req.body || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const ai = createAiClient();
      const contextLine = context
        ? `\nLive Simulation Context: ${JSON.stringify(context)}`
        : '';

      const chatHistory = Array.isArray(history)
        ? history
            .filter(
              (m: { role?: unknown; content?: unknown }) =>
                (m.role === 'user' || m.role === 'assistant') &&
                typeof m.content === 'string' &&
                m.content.trim().length > 0
            )
            .slice(-10)
            .map((m: { role: string; content: string }) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content.slice(0, 2000) }],
            }))
        : [];

      const contents = [
        ...chatHistory,
        { role: 'user', parts: [{ text: message.trim() }] },
      ];

      const tStart = Date.now();
      const systemInstruction = `${SYSTEM_PROMPT}${contextLine}`;
      let response;
      let modelUsed = 'gemini-4-hydrogen';
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(10000),
          },
        });
      } catch (firstErr: unknown) {
        const msgStr = String(firstErr instanceof Error ? firstErr.message : firstErr);
        const isTransient =
          msgStr.includes('503') ||
          msgStr.includes('504') ||
          msgStr.includes('UNAVAILABLE') ||
          msgStr.includes('DEADLINE_EXCEEDED') ||
          msgStr.includes('Deadline expired') ||
          msgStr.includes('aborted');
        if (isTransient) {
          console.warn(`gemini-4-hydrogen transient failure after ${Date.now() - tStart}ms (${msgStr}), retrying with gemini-3.1-flash-lite`);
          modelUsed = 'gemini-3.1-flash-lite';
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: {
              systemInstruction,
              abortSignal: AbortSignal.timeout(10000),
              httpOptions: { retryOptions: { attempts: 2, initialDelay: 0.4, maxDelay: 1.5 } },
            },
          });
        } else {
          throw firstErr;
        }
      }
      console.log(`/api/chat (${modelUsed}) completed in ${Date.now() - tStart}ms`);
      const reply = response.text || 'No response generated.';

      // Best-effort PostgreSQL archive if operator sent a verified Firebase Bearer token
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
          await saveChatExchange(
            decoded.uid,
            decoded.email || 'operator@resqnet.local',
            decoded.name || 'Operator',
            message.trim(),
            reply
          );
        } catch {
          // Do not fail chat response if optional SQL archive is skipped
        }
      }

      res.json({ reply });
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Chat generation failed.';
      let friendly = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) friendly = parsed.error.message;
      } catch {
        // Keep raw string
      }
      if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('GEMINI_API_KEY is not configured')) {
        friendly = 'Gemini API key is missing or invalid. Please check your key in the Settings > Secrets panel.';
      } else if (raw.includes('RESOURCE_EXHAUSTED')) {
        friendly = 'Gemini API quota exceeded. Please try again shortly or check your billing/quota in Settings > Secrets.';
      } else if (raw.includes('Deadline expired') || raw.includes('DEADLINE_EXCEEDED') || raw.includes('aborted due to timeout')) {
        friendly = 'Gemini API request timed out. Please try again in a moment.';
      }
      console.error('Gemini /api/chat error:', error);
      res.status(503).json({ error: friendly });
    }
  });

  // Gemini Audio Transcription endpoint (gemini-3.5-transcribe)
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', prompt } = req.body || {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'audioBase64 payload is required.' });
      }

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text:
                typeof prompt === 'string' && prompt.trim()
                  ? prompt.trim()
                  : 'Transcribe this emergency or utility dispatch audio accurately. Output only the spoken transcript.',
            },
          ],
        },
      });

      res.json({ text: (response.text || '').trim() });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Audio transcription failed.';
      console.error('Gemini /api/transcribe error:', error);
      res.status(500).json({ error: msg });
    }
  });

  // Cloud SQL PostgreSQL routes protected by Firebase Auth
  app.post('/api/sql/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'operator@resqnet.local';
      const displayName =
        typeof req.body?.displayName === 'string' && req.body.displayName.trim()
          ? req.body.displayName.trim()
          : req.user!.name || 'Operator';
      const role =
        typeof req.body?.role === 'string' ? req.body.role : 'citizen';

      const user = await getOrCreateUser(uid, email, displayName, role);
      res.json({ user });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to sync user.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/sql/runs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const runs = await listNegotiationRuns(req.user!.uid);
      res.json({ runs });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch runs.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/sql/runs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.profile || typeof b.negotiatedDamage !== 'number') {
        return res.status(400).json({ error: 'Invalid negotiation run payload.' });
      }
      const run = await saveNegotiationRun(
        req.user!.uid,
        req.user!.email || 'operator@resqnet.local',
        req.user!.name || 'Operator',
        {
          profile: String(b.profile),
          horizonH: Number(b.horizonH || 24),
          baseCapacityMW: Number(b.baseCapacityMW || 120),
          fairnessWeight: Number(b.fairnessWeight || 0.45),
          negotiatedDamage: Number(b.negotiatedDamage),
          uncoordinatedDamage: Number(b.uncoordinatedDamage || b.negotiatedDamage),
          jainsFairness: Number(b.jainsFairness || 0),
          notes: typeof b.notes === 'string' ? b.notes : '',
        }
      );
      res.json({ run });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save run.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/sql/escalations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const escalations = await listFieldEscalations(req.user!.uid);
      res.json({ escalations });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch escalations.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/sql/escalations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.category || !b.areaName || !b.summary) {
        return res.status(400).json({ error: 'category, areaName, and summary are required.' });
      }
      const escalation = await saveFieldEscalation(
        req.user!.uid,
        req.user!.email || 'operator@resqnet.local',
        req.user!.name || 'Operator',
        {
          category: String(b.category),
          areaName: String(b.areaName),
          severity: String(b.severity || 'high'),
          summary: String(b.summary),
          lat: Number(b.lat || 12.9716),
          lon: Number(b.lon || 77.5946),
        }
      );
      res.json({ escalation });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save escalation.';
      res.status(500).json({ error: msg });
    }
  });

  const httpServer = http.createServer(app);

  // Live API WebSocket Bridge (/live) for real-time voice (gemini-3.8-live)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/live') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    try {
      const ai = createAiClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are ResQ-Net Live Voice Dispatch. Keep spoken responses concise, calm, and practical for Bengaluru utility operators and citizens during power or water emergencies.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Live session error';
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ error: msg }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          },
        },
      });

      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ ready: true }));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to start Live session.';
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ error: msg }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session) return;
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text) {
          session.sendRealtimeInput({ text: String(parsed.text) });
        }
      } catch (err) {
        console.error('Live client WS message parse error:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close error
      }
      session = null;
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const clearSwScript = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate(c.url);
  })());
});
`;
    app.get(['/dev-sw.js', '/sw.js'], (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(clearSwScript);
    });
    app.get('/registerSW.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send('// no-op in dev');
    });
    app.get('/src/main.tsx', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.replace('/');
  }
})();
`);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true,
        ws: {
          server: httpServer,
          path: '/__vite_ws',
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ResQ-Net full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
