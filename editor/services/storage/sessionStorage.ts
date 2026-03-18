// SessionStorage - 会话存储服务实现
import {
  getHomeDir,
  createDir,
  exists,
  readTextFile,
  writeTextFile,
  remove,
} from '@/services/tauri/fs';
import type {
  SessionMeta,
  SessionIndex,
  SessionFilter,
  StoredMessage,
  AgentRunFile,
  SessionStorageInterface,
} from './types';

const SLATE_DIR = '.slate';
const SESSIONS_DIR = 'sessions';
const INDEX_FILE = 'index.json';
const META_FILE = 'meta.json';
const MESSAGES_FILE = 'messages.jsonl';
const AGENT_RUN_FILE = 'agent-run.json';
const INDEX_VERSION = 1;

function isValidStoredMessage(value: unknown): value is StoredMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredMessage>;
  const validRole =
    candidate.role === 'user' ||
    candidate.role === 'assistant' ||
    candidate.role === 'system';
  const validContent =
    typeof candidate.content === 'string' ||
    Array.isArray(candidate.content);

  return validRole && validContent;
}

function joinPath(base: string, ...parts: string[]): string {
  const sep = base.includes('\\') ? '\\' : '/';
  const normalized = [base, ...parts].map((p, i) => {
    if (i === 0) return p.replace(/[\\/]+$/, '');
    return p.replace(/^[\\/]+|[\\/]+$/g, '');
  });
  return normalized.join(sep);
}

class FileSessionStorage implements SessionStorageInterface {
  private slateDir: string | null = null;
  private sessionsDir: string | null = null;
  private initialized = false;
  private indexCache: SessionIndex | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const homeDir = await getHomeDir();
    if (!homeDir) {
      console.warn('[SessionStorage] Home directory not available');
      return;
    }

    this.slateDir = joinPath(homeDir, SLATE_DIR);
    this.sessionsDir = joinPath(this.slateDir, SESSIONS_DIR);

    await createDir(this.sessionsDir, true);

    const indexPath = joinPath(this.sessionsDir, INDEX_FILE);
    if (!(await exists(indexPath))) {
      const emptyIndex: SessionIndex = { version: INDEX_VERSION, sessions: [] };
      await writeTextFile(indexPath, JSON.stringify(emptyIndex, null, 2));
    }

    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized && this.slateDir !== null;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.slateDir || !this.sessionsDir) {
      throw new Error('[SessionStorage] Not initialized. Call initialize() first.');
    }
  }

  private async loadIndex(): Promise<SessionIndex> {
    this.ensureInitialized();
    if (this.indexCache) return this.indexCache;

    const indexPath = joinPath(this.sessionsDir!, INDEX_FILE);
    const content = await readTextFile(indexPath);
    this.indexCache = JSON.parse(content) as SessionIndex;
    return this.indexCache!;
  }

  private async saveIndex(index: SessionIndex): Promise<void> {
    this.ensureInitialized();
    const indexPath = joinPath(this.sessionsDir!, INDEX_FILE);
    await writeTextFile(indexPath, JSON.stringify(index, null, 2));
    this.indexCache = index;
  }

  async createSession(meta: SessionMeta): Promise<void> {
    this.ensureInitialized();

    const sessionDir = joinPath(this.sessionsDir!, meta.id);
    await createDir(sessionDir, true);

    const metaPath = joinPath(sessionDir, META_FILE);
    await writeTextFile(metaPath, JSON.stringify(meta, null, 2));

    const messagesPath = joinPath(sessionDir, MESSAGES_FILE);
    await writeTextFile(messagesPath, '');

    const index = await this.loadIndex();
    index.sessions.unshift(meta);
    await this.saveIndex(index);
  }

  async getSession(id: string): Promise<SessionMeta | null> {
    this.ensureInitialized();

    const metaPath = joinPath(this.sessionsDir!, id, META_FILE);
    if (!(await exists(metaPath))) {
      return null;
    }

    const content = await readTextFile(metaPath);
    return JSON.parse(content) as SessionMeta;
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMeta[]> {
    const index = await this.loadIndex();
    let sessions = [...index.sessions];

    if (filter?.projectPath) {
      sessions = sessions.filter((s) => s.projectPath === filter.projectPath);
    }
    if (filter?.status) {
      sessions = sessions.filter((s) => s.status === filter.status);
    }

    return sessions;
  }

  async updateSessionMeta(id: string, updates: Partial<SessionMeta>): Promise<void> {
    this.ensureInitialized();

    const meta = await this.getSession(id);
    if (!meta) {
      throw new Error(`[SessionStorage] Session not found: ${id}`);
    }

    const updated = { ...meta, ...updates, updatedAt: Date.now() };
    const metaPath = joinPath(this.sessionsDir!, id, META_FILE);
    await writeTextFile(metaPath, JSON.stringify(updated, null, 2));

    const index = await this.loadIndex();
    const idx = index.sessions.findIndex((s) => s.id === id);
    if (idx !== -1) {
      index.sessions[idx] = updated;
      await this.saveIndex(index);
    }
  }

  async deleteSession(id: string): Promise<void> {
    this.ensureInitialized();

    const sessionDir = joinPath(this.sessionsDir!, id);
    await remove(sessionDir, true);

    const index = await this.loadIndex();
    index.sessions = index.sessions.filter((s) => s.id !== id);
    await this.saveIndex(index);
  }

  async appendMessage(sessionId: string, message: StoredMessage): Promise<void> {
    this.ensureInitialized();

    const messagesPath = joinPath(this.sessionsDir!, sessionId, MESSAGES_FILE);
    const line = JSON.stringify(message) + '\n';

    const content = await readTextFile(messagesPath);
    await writeTextFile(messagesPath, content + line);
  }

  async replaceMessages(sessionId: string, messages: StoredMessage[]): Promise<void> {
    this.ensureInitialized();

    const messagesPath = joinPath(this.sessionsDir!, sessionId, MESSAGES_FILE);
    const content = messages.length > 0
      ? `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`
      : '';

    await writeTextFile(messagesPath, content);
  }

  async getMessages(sessionId: string): Promise<StoredMessage[]> {
    this.ensureInitialized();

    const messagesPath = joinPath(this.sessionsDir!, sessionId, MESSAGES_FILE);
    if (!(await exists(messagesPath))) {
      return [];
    }

    const content = await readTextFile(messagesPath);
    if (!content.trim()) {
      return [];
    }

    const parsedMessages: StoredMessage[] = [];
    let hasMalformedLine = false;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (isValidStoredMessage(parsed)) {
          parsedMessages.push(parsed);
        } else {
          hasMalformedLine = true;
          console.warn('[SessionStorage] Ignoring malformed stored message shape:', trimmed);
        }
      } catch (error) {
        hasMalformedLine = true;
        console.warn('[SessionStorage] Ignoring malformed message line:', trimmed, error);
      }
    }

    if (hasMalformedLine) {
      await this.replaceMessages(sessionId, parsedMessages);
    }

    return parsedMessages;
  }

  async saveAgentRun(sessionId: string, run: AgentRunFile): Promise<void> {
    this.ensureInitialized();

    const runPath = joinPath(this.sessionsDir!, sessionId, AGENT_RUN_FILE);
    await writeTextFile(runPath, JSON.stringify(run, null, 2));
  }

  async loadAgentRun(sessionId: string): Promise<AgentRunFile | null> {
    this.ensureInitialized();

    const runPath = joinPath(this.sessionsDir!, sessionId, AGENT_RUN_FILE);
    if (!(await exists(runPath))) {
      return null;
    }

    const content = await readTextFile(runPath);
    return JSON.parse(content) as AgentRunFile;
  }

  clearCache(): void {
    this.indexCache = null;
  }
}

export const sessionStorage = new FileSessionStorage();
