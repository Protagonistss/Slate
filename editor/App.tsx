import { useEffect, useState } from "react";
import { RouterProvider, createBrowserRouter } from "react-router";
import { AppLayout } from "./features/layout/components";
import { ToastContainer } from "./components/common";
import { HomeView } from "@/features/home/views";
import { EditorView } from "@/features/editor/views";
import { AgentView } from "@/features/agent/views";
import { OAuthCallbackView } from "@/features/auth/views";
import { SettingsView } from "@/features/settings/views";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore, useMcpStore, useConversationStore } from "@/stores";
import { useAgentStore } from "@/features/agent/store/agentStore";
import { sessionStorage } from "@/services/storage";
import { isTauriEnv } from "@/services/tauri";

function App() {
  const [isReady, setIsReady] = useState(false);
  const { restoreLastProject } = useProjectStore();
  const { initialize: initializeMcp } = useMcpStore();
  const { restoreSession } = useAuthStore();
  const { loadFromStorage: loadConversations } = useConversationStore();
  const { loadFromStorage: loadAgentRuns } = useAgentStore();

  useEffect(() => {
    const initialize = async () => {
      await restoreLastProject();
      await initializeMcp();
      await restoreSession();

      if (isTauriEnv) {
        await sessionStorage.initialize();
        await Promise.all([loadConversations(), loadAgentRuns()]);
      }

      setIsReady(true);
    };

    initialize();
  }, [initializeMcp, restoreLastProject, restoreSession, loadConversations, loadAgentRuns]);

  if (!isReady) {
    return (
      <div className="h-screen w-full bg-obsidian flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          <span className="text-sm text-zinc-500">Loading...</span>
        </div>
      </div>
    );
  }

  // 创建路由配置
  const appRouter = createBrowserRouter([
    {
      path: "/",
      Component: AppLayout,
      children: [
        { index: true, Component: HomeView },
        { path: "auth/callback", Component: OAuthCallbackView },
        { path: "editor", Component: EditorView },
        { path: "agent/:conversationId?", Component: AgentView },
        { path: "settings", Component: SettingsView },
      ],
    },
  ]);

  return (
    <>
      <RouterProvider router={appRouter} />
      <ToastContainer />
    </>
  );
}

export default App;
