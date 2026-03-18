import type { IPtyBridge, PtySession, PtySpawnOptions } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

type DataCallback = (data: string) => void;
type ExitCallback = (code: number) => void;

interface PtyDataPayload {
  id: string;
  data: string;
}

interface PtyExitPayload {
  id: string;
  code: number;
}

class PtyBridgeImpl implements IPtyBridge {
  private dataCallbacks: Map<string, Set<DataCallback>> = new Map();
  private exitCallbacks: Map<string, Set<ExitCallback>> = new Map();
  private ptyDataUnlisten: UnlistenFn | null = null;
  private ptyExitUnlisten: UnlistenFn | null = null;
  /** Ensure only one pair of global listeners is ever registered (avoids duplicate prompt) */
  private listenersReady: Promise<void> | null = null;

  private async ensurePtyListeners(): Promise<void> {
    if (this.listenersReady) return this.listenersReady;
    const promise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      this.ptyDataUnlisten = await listen<PtyDataPayload>('pty-data', (event) => {
        const { id, data } = event.payload;
        this.dataCallbacks.get(id)?.forEach((cb) => cb(data));
      });
      this.ptyExitUnlisten = await listen<PtyExitPayload>('pty-exit', (event) => {
        const { id, code } = event.payload;
        this.exitCallbacks.get(id)?.forEach((cb) => cb(code));
        this.cleanup(id);
      });
    })();
    this.listenersReady = promise;
    await promise;
  }

  async spawn(options: PtySpawnOptions): Promise<PtySession> {
    if (!isTauri) {
      const mockSession: PtySession = {
        id: `mock-${Date.now()}`,
        pid: Math.floor(Math.random() * 10000),
      };
      this.dataCallbacks.set(mockSession.id, new Set());
      this.exitCallbacks.set(mockSession.id, new Set());
      setTimeout(() => {
        this.dataCallbacks.get(mockSession.id)?.forEach((cb) =>
          cb('Terminal running in browser mode (mock)\r\n')
        );
      }, 100);
      return mockSession;
    }

    await this.ensurePtyListeners();

    const cols = options.cols ?? 80;
    const rows = options.rows ?? 24;
    const result = await invoke<{ id: string; pid: number }>('pty_spawn', {
      cwd: options.cwd ?? null,
      cols,
      rows,
    });

    this.dataCallbacks.set(result.id, new Set());
    this.exitCallbacks.set(result.id, new Set());

    return { id: result.id, pid: result.pid };
  }

  async write(sessionId: string, data: string): Promise<void> {
    if (!isTauri) {
      this.dataCallbacks.get(sessionId)?.forEach((cb) => cb(data));
      return;
    }
    await invoke('pty_write', { id: sessionId, data });
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    if (!isTauri) return;
    await invoke('pty_resize', { id: sessionId, cols, rows });
  }

  async kill(sessionId: string): Promise<void> {
    if (!isTauri) {
      this.cleanup(sessionId);
      return;
    }
    try {
      await invoke('pty_kill', { id: sessionId });
    } finally {
      this.cleanup(sessionId);
    }
  }

  onData(sessionId: string, callback: (data: string) => void): () => void {
    let callbacks = this.dataCallbacks.get(sessionId);
    if (!callbacks) {
      callbacks = new Set();
      this.dataCallbacks.set(sessionId, callbacks);
    }
    callbacks.add(callback);
    return () => {
      this.dataCallbacks.get(sessionId)?.delete(callback);
    };
  }

  onExit(sessionId: string, callback: (code: number) => void): () => void {
    let callbacks = this.exitCallbacks.get(sessionId);
    if (!callbacks) {
      callbacks = new Set();
      this.exitCallbacks.set(sessionId, callbacks);
    }
    callbacks.add(callback);
    return () => {
      this.exitCallbacks.get(sessionId)?.delete(callback);
    };
  }

  private cleanup(sessionId: string): void {
    this.dataCallbacks.delete(sessionId);
    this.exitCallbacks.delete(sessionId);
  }
}

export const ptyBridge = new PtyBridgeImpl();
