export interface Settings {
  appearance: {
    theme: string;
    language: string;
    fontSize: number;
  };
  editor: {
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    fontFamily: string;
  };
  ui: {
    sidebarWidth: number;
    panelWidth: number;
  };
}

export interface Config {
  llm: {
    defaultProvider: string;
    providers: Record<string, {
      model: string;
      maxTokens: number;
      temperature: number;
    }>;
  };
  workspace: {
    defaultDirectory: string;
    autoSave: boolean;
  };
}

export interface MCPConfig {
  mcpServers: MCPServer[];
}

export interface MCPServer {
  id: string;
  name: string;
  enabled: boolean;
  transport: {
    type: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
  };
}

export interface ProjectRecord {
  path: string;
  name: string;
  lastOpened: string;
  openFiles: string[];
  hasConfig: boolean;
}

export interface ProjectsConfig {
  recentProjects: ProjectRecord[];
  currentProject?: string;
}
