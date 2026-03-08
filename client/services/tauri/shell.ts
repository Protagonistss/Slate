/**
 * Tauri Shell API 封装
 */

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export interface ShellOutput {
  code: number;
  signal: number | null;
  stdout: string;
  stderr: string;
}

/**
 * 执行 Shell 命令
 */
export async function executeCommand(
  program: string,
  args: string[] = [],
  cwd?: string
): Promise<ShellOutput> {
  if (!isTauri) {
    throw new Error('Shell not available in browser');
  }

  const { Command } = await import('@tauri-apps/plugin-shell');

  const command = cwd
    ? Command.create(program, args, { cwd })
    : Command.create(program, args);

  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    command.on('close', (data) => {
      resolve({
        code: data.code,
        signal: data.signal ?? null,
        stdout: stdout.join('\n'),
        stderr: stderr.join('\n'),
      });
    });

    command.on('error', (error) => {
      reject(new Error(error));
    });

    command.stdout.on('data', (data) => {
      stdout.push(data);
    });

    command.stderr.on('data', (data) => {
      stderr.push(data);
    });

    command.spawn().catch(reject);
  });
}

/**
 * 在默认浏览器中打开 URL
 */
export async function openUrl(url: string): Promise<void> {
  if (!isTauri) {
    window.open(url, '_blank');
    return;
  }

  const { open } = await import('@tauri-apps/plugin-shell');
  return open(url);
}

/**
 * 检测命令是否存在
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    // 在浏览器环境中，我们无法检测命令是否存在
    if (!isTauri) {
      return false;
    }
    const result = await executeCommand(
      'where', // Windows
      [command]
    );
    return result.code === 0;
  } catch {
    return false;
  }
}
