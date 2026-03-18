import type { IPtyBridge, PtySession, PtySpawnOptions } from './types';

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

type DataCallback = (data: string) => void;
type ExitCallback = (code: number) => void;

interface CommandState {
  pid: number;
  onData: Set<DataCallback>;
  onExit: Set<ExitCallback>;
}

class PtyBridgeImpl implements IPtyBridge {
  private sessions: Map<string, CommandState> = new Map();
  private dataCallbacks: Map<string, Set<DataCallback>> = new Map();
  private exitCallbacks: Map<string, Set<ExitCallback>> = new Map();

  async spawn(options: PtySpawnOptions): Promise<PtySession> {
    if (!isTauri) {
      const mockSession: PtySession = {
        id: `mock-${Date.now()}`,
        pid: Math.floor(Math.random() * 10000),
      };

      this.sessions.set(mockSession.id, {
        pid: mockSession.pid,
        onData: new Set(),
        onExit: new Set(),
      });

      setTimeout(() => {
        const callbacks = this.dataCallbacks.get(mockSession.id);
        if (callbacks) {
          callbacks.forEach((cb) => cb('Terminal running in browser mode (mock)\r\n'));
        }
      }, 100);

      return mockSession;
    }

    const { Command } = await import('@tauri-apps/plugin-shell');

    const program = options.env?.SHELL || (navigator.platform.includes('Win') ? 'powershell.exe' : 'bash');
    const args: string[] = [];

    const command = options.cwd
      ? Command.create(program, args, { cwd: options.cwd })
      : Command.create(program, args);

    const id = `pty-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.dataCallbacks.set(id, new Set());
    this.exitCallbacks.set(id, new Set());

    command.stdout.on('data', (data) => {
      const callbacks = this.dataCallbacks.get(id);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data));
      }
    });

    command.stderr.on('data', (data) => {
      const callbacks = this.dataCallbacks.get(id);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data));
      }
    });

    return new Promise((resolve, reject) => {
      command.on('close', (data) => {
        const callbacks = this.exitCallbacks.get(id);
        if (callbacks) {
          callbacks.forEach((cb) => cb(data.code));
        }
        this.cleanup(id);
      });

      command.on('error', (error) => {
        reject(new Error(error));
        this.cleanup(id);
      });

      command.spawn().then((child) => {
        this.sessions.set(id, {
          pid: child.pid,
          onData: this.dataCallbacks.get(id)!,
          onExit: this.exitCallbacks.get(id)!,
        });

        resolve({ id, pid: child.pid });
      }).catch(reject);
    });
  }

  async write(sessionId: string, data: string): Promise<void> {
    if (!isTauri) {
      const callbacks = this.dataCallbacks.get(sessionId);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data));
      }
      return;
    }
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    if (!isTauri) {
      return;
    }
  }

  async kill(sessionId: string): Promise<void> {
    if (!isTauri) {
      this.cleanup(sessionId);
      return;
    }
  }

  onData(sessionId: string, callback: (data: string) => void): () => void {
    const callbacks = this.dataCallbacks.get(sessionId);
    if (!callbacks) {
      this.dataCallbacks.set(sessionId, new Set([callback]));
    } else {
      callbacks.add(callback);
    }

    return () => {
      const cbs = this.dataCallbacks.get(sessionId);
      if (cbs) {
        cbs.delete(callback);
      }
    };
  }

  onExit(sessionId: string, callback: (code: number) => void): () => void {
    const callbacks = this.exitCallbacks.get(sessionId);
    if (!callbacks) {
      this.exitCallbacks.set(sessionId, new Set([callback]));
    } else {
      callbacks.add(callback);
    }

    return () => {
      const cbs = this.exitCallbacks.get(sessionId);
      if (cbs) {
        cbs.delete(callback);
      }
    };
  }

  private cleanup(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.dataCallbacks.delete(sessionId);
    this.exitCallbacks.delete(sessionId);
  }
}

export const ptyBridge = new PtyBridgeImpl();
