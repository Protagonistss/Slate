import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/features/layout/components";
import { AgentView } from "@/features/agent/views";
import { OAuthCallbackView } from "@/features/auth/views";
import { EditorView } from "@/features/editor/views";
import { HomeView } from "@/features/home/views";
import { SettingsView } from "@/features/settings/views";

export function createAppRouter() {
  return createBrowserRouter([
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
}

