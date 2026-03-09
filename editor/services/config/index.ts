import { invoke } from '@tauri-apps/api/core';
import * as types from './types';

export async function getConfig(): Promise<{
  settings: types.Settings;
  config: types.Config;
  mcp: types.MCPConfig;
}> {
  return invoke('get_config');
}

export async function updateSettings(settings: types.Settings): Promise<void> {
  return invoke('update_settings', { settings });
}

export async function getConfigPath(): Promise<string> {
  return invoke('get_config_path');
}

export async function openConfigFolder(): Promise<void> {
  return invoke('open_config_folder');
}

export async function setProjectDir(path: string): Promise<void> {
  return invoke('set_project_dir', { path });
}

export async function getRecentProjects(): Promise<types.ProjectRecord[]> {
  return invoke('get_recent_projects');
}

export async function removeRecentProject(path: string): Promise<void> {
  return invoke('remove_recent_project', { path });
}

export async function getCurrentProjectPath(): Promise<string | null> {
  return invoke('get_current_project_path');
}

export * from './types';
