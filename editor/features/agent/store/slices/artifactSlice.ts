// Artifact Slice - handles artifacts management
import { StateCreator } from 'zustand';
import type { ArtifactRef, ArtifactKind, AgentRun } from '../types';
import { ARTIFACT_SNAPSHOT_MAX_LENGTH, ARTIFACT_SNAPSHOT_TIMEOUT_MS } from '../types';
import { readTextFile } from '@/services/tauri/fs';
import { isAbsolutePath, joinPath } from '@/utils/pathUtils';
import { useConfigStore } from '@/stores/configStore';
import { createArtifact, replaceArtifact, attachArtifactToRun } from '../utils';

function now(): number {
  return Date.now();
}

function truncateText(value: string, maxLength = 240): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function resolveArtifactSnapshotPath(path: string): string | null {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return null;
  }

  if (isAbsolutePath(normalizedPath)) {
    return normalizedPath;
  }

  const workingDirectory = useConfigStore.getState().workingDirectory.trim();
  if (!workingDirectory) {
    return null;
  }

  return joinPath(workingDirectory, normalizedPath);
}

async function readArtifactSnapshot(path: string): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const content = await Promise.race([
      readTextFile(path),
      new Promise<string>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timed out while reading file snapshot.'));
        }, ARTIFACT_SNAPSHOT_TIMEOUT_MS);
      }),
    ]);

    return content.length > ARTIFACT_SNAPSHOT_MAX_LENGTH
      ? content.slice(0, ARTIFACT_SNAPSHOT_MAX_LENGTH)
      : content;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export interface ArtifactSlice {
  // Artifact actions
  createArtifact: (input: {
    stepId?: string | null;
    path: string;
    kind: ArtifactKind;
    title?: string;
    preview?: string;
    contentSnapshot?: string;
  }) => ArtifactRef;
  attachArtifactToRun: (
    run: AgentRun,
    artifactInput: {
      stepId?: string | null;
      path: string;
      kind: ArtifactKind;
      title?: string;
      preview?: string;
      contentSnapshot?: string;
    }
  ) => AgentRun;
  attachArtifactToRunByConversationId: (
    conversationId: string,
    artifactInput: {
      stepId?: string | null;
      path: string;
      kind: ArtifactKind;
      title?: string;
      preview?: string;
      contentSnapshot?: string;
    }
  ) => Promise<void>;
  readArtifactSnapshot: (path: string) => Promise<string>;
  resolveArtifactSnapshotPath: (path: string) => string | null;
}

export const createArtifactSlice: StateCreator<
  ArtifactSlice & { runsByConversation: Record<string, AgentRun> },
  [],
  [],
  ArtifactSlice
> = (set, get) => ({
  createArtifact,
  attachArtifactToRun,

  attachArtifactToRunByConversationId: async (conversationId, artifactInput) => {
    const run = get().runsByConversation[conversationId];
    if (!run) {
      return;
    }

    let contentSnapshot: string | undefined;
    if (artifactInput.kind === 'file') {
      const resolvedPath = resolveArtifactSnapshotPath(artifactInput.path);
      if (resolvedPath) {
        try {
          contentSnapshot = await readArtifactSnapshot(resolvedPath);
        } catch {
          contentSnapshot = undefined;
        }
      }
    }

    const updatedRun = attachArtifactToRun(run, {
      ...artifactInput,
      contentSnapshot,
    });

    set((state) => ({
      runsByConversation: {
        ...state.runsByConversation,
        [conversationId]: updatedRun,
      },
    }));
  },

  readArtifactSnapshot,
  resolveArtifactSnapshotPath,
});
