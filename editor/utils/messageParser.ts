/**
 * 解析消息中的代码块
 */
export interface CodeBlock {
  language: string;
  code: string;
  start: number;
  end: number;
}

export function parseCodeBlocks(text: string): CodeBlock[] {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return blocks;
}

/**
 * 解析消息中的链接
 */
export function parseLinks(text: string): { url: string; text: string }[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: { url: string; text: string }[] = [];
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
    });
  }

  return links;
}

/**
 * 提取纯文本（去除 markdown 格式）
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`([^`]+)`/g, '$1') // 移除行内代码
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // 移除加粗/斜体
    .replace(/#{1,6}\s/g, '') // 移除标题标记
    .replace(/>\s/g, '') // 移除引用标记
    .trim();
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
