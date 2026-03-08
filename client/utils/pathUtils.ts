/**
 * 路径处理工具
 */

/**
 * 规范化路径（统一使用正斜杠）
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * 获取文件名（不含扩展名）
 */
export function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  const fullName = parts[parts.length - 1] || '';
  return fullName.replace(/\.[^.]+$/, '');
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  const fullName = parts[parts.length - 1] || '';
  const dotIndex = fullName.lastIndexOf('.');
  return dotIndex > 0 ? fullName.slice(dotIndex + 1).toLowerCase() : '';
}

/**
 * 获取文件完整名称（含扩展名）
 */
export function getFileFullName(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * 获取父目录路径
 */
export function getParentDirectory(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * 连接路径
 */
export function joinPath(...parts: string[]): string {
  return parts
    .map((part, index) => {
      if (index === 0) {
        return normalizePath(part).replace(/\/+$/, '');
      }
      return normalizePath(part).replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean)
    .join('/');
}

/**
 * 根据文件扩展名获取语言
 */
export function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mjs: 'javascript',
    cjs: 'javascript',

    // Python
    py: 'python',
    pyw: 'python',
    pyx: 'python',

    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    sass: 'scss',

    // Vue/Svelte/Angular
    vue: 'vue',
    svelte: 'svelte',

    // Data formats
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    env: 'plaintext',

    // Markup
    md: 'markdown',
    mdx: 'markdown',
    rst: 'restructuredtext',

    // Systems programming
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    rs: 'rust',
    go: 'go',
    zig: 'zig',

    // JVM
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    groovy: 'groovy',

    // .NET
    cs: 'csharp',
    vb: 'vb',
    fs: 'fsharp',

    // Scripting
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    ps: 'powershell',
    bat: 'bat',
    cmd: 'bat',
    rb: 'ruby',
    lua: 'lua',
    pl: 'perl',
    pm: 'perl',

    // Functional
    hs: 'haskell',
    elm: 'elm',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',

    // Mobile
    swift: 'swift',
    m: 'objective-c',
    mm: 'objective-cpp',

    // Database
    sql: 'sql',

    // Config
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',

    // Other
    php: 'php',
    r: 'r',
    dart: 'dart',
    clj: 'clojure',
    cljs: 'clojure',
    coffee: 'coffeescript',
    sol: 'solidity',
    graphql: 'graphql',
    gql: 'graphql',

    // Text
    txt: 'plaintext',
    log: 'plaintext',
  };

  return languageMap[extension.toLowerCase()] || 'plaintext';
}

/**
 * 检查是否为绝对路径
 */
export function isAbsolutePath(path: string): boolean {
  // Windows: 以盘符开头或 UNC 路径
  if (/^[a-zA-Z]:/.test(path) || path.startsWith('\\\\')) {
    return true;
  }
  // Unix: 以 / 开头
  return path.startsWith('/');
}

/**
 * 获取相对路径
 */
export function getRelativePath(from: string, to: string): string {
  const fromParts = normalizePath(from).split('/');
  const toParts = normalizePath(to).split('/');

  // 找到公共前缀
  let commonLength = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  // 构建相对路径
  const upLevels = fromParts.length - commonLength - 1;
  const downPath = toParts.slice(commonLength).join('/');

  const relativeParts = [];
  for (let i = 0; i < upLevels; i++) {
    relativeParts.push('..');
  }
  if (downPath) {
    relativeParts.push(downPath);
  }

  return relativeParts.join('/') || '.';
}
