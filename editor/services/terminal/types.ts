export type TerminalStatus = 'starting' | 'running' | 'exited';

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  status: TerminalStatus;
  exitCode?: number;
  pid?: number;
  createdAt: number;
}

export interface TerminalOutput {
  sessionId: string;
  data: string;
  type: 'stdout' | 'stderr';
}

export interface PtySpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface PtySession {
  id: string;
  pid: number;
}

export interface IPtyBridge {
  spawn(options: PtySpawnOptions): Promise<PtySession>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  kill(sessionId: string): Promise<void>;
  onData(sessionId: string, callback: (data: string) => void): () => void;
  onExit(sessionId: string, callback: (code: number) => void): () => void;
}
