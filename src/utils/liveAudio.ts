// Pure audio conversion and scheduling helpers for bidirectional Gemini Live WebSocket audio.

export function float32ToInt16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

export function int16ToFloat32(pcm16: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] < 0 ? pcm16[i] / 0x8000 : pcm16[i] / 0x7fff;
  }
  return float32;
}

export function calculateNextPlayTime(
  currentTime: number,
  nextStartTime: number,
  bufferDuration: number
): { startTime: number; nextStartTime: number } {
  const safeNow = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  const safeNext = Number.isFinite(nextStartTime) ? nextStartTime : 0;
  const safeDur = Number.isFinite(bufferDuration) ? Math.max(0, bufferDuration) : 0;
  const startTime = Math.max(safeNow + 0.015, safeNext);
  return {
    startTime,
    nextStartTime: startTime + safeDur,
  };
}

export function buildLiveWsUrl(loc: { protocol: string; host: string }): string {
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}/live`;
}
