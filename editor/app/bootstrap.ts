import { refreshBackendEnv } from "@/services/backend/base";
import { sessionStorage } from "@/services/storage";
import { isTauriEnv } from "@/services/tauri";
import { useAgentStore } from "@/features/agent/store/agentStore";
import { useAuthStore, useConversationStore, useMcpStore, useProjectStore } from "@/stores";

export async function bootstrapApp() {
  const { restoreLastProject, currentProject } = useProjectStore.getState();
  const { initialize: initializeMcp } = useMcpStore.getState();
  const { restoreSession } = useAuthStore.getState();
  const { loadFromStorage: loadConversations } = useConversationStore.getState();
  const { loadFromStorage: loadAgentRuns } = useAgentStore.getState();

  await restoreLastProject();
  await refreshBackendEnv({ projectPath: currentProject?.path ?? null });
  await initializeMcp();
  await restoreSession();

  if (isTauriEnv) {
    await sessionStorage.initialize();
    await Promise.all([loadConversations(), loadAgentRuns()]);
  }
}
