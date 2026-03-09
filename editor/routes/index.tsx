import { createBrowserRouter } from "react-router";
import { AppLayout } from "../components/layout/AppLayout";
import { HomeView } from "../components/views/HomeView";
import { EditorView } from "../components/views/EditorView";
import { AgentView } from "../components/views/AgentView";
import { SettingsView } from "../components/views/SettingsView";

export const router = createBrowserRouter([
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
