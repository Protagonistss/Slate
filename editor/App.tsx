import { useEffect, useState } from "react";
import { RouterProvider, createBrowserRouter } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { HomeView } from "./components/views/HomeView";
import { EditorView } from "./components/views/EditorView";
import { AgentView } from "./components/views/AgentView";
import { SettingsView } from "./components/views/SettingsView";
import { useProjectStore } from "@/stores/projectStore";
import { useMcpStore } from "@/stores";

function App() {
  const [isReady, setIsReady] = useState(false);
  const { restoreLastProject } = useProjectStore();
  const { initialize: initializeMcp } = useMcpStore();

  useEffect(() => {
    const initialize = async () => {
      // 恢复上次的项目
      await restoreLastProject();
      await initializeMcp();
      setIsReady(true);
    };

    initialize();
  }, [initializeMcp, restoreLastProject]);

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
        { path: "editor", Component: EditorView },
        { path: "agent", Component: AgentView },
        { path: "settings", Component: SettingsView },
      ],
    },
  ]);

  return <RouterProvider router={appRouter} />;
}

export default App;
