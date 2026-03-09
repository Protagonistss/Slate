import React from 'react';
import type { Message, ContentBlock } from '../../services/llm/types';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  index: number;
}

const UserIcon: React.FC = () => (
  <div className="message-avatar user">
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </svg>
  </div>
);

const AssistantIcon: React.FC = () => (
  <div className="message-avatar assistant">
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
      />
    </svg>
  </div>
);

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => (
  <div className="code-block">
    <div className="code-header">
      <span className="code-language">{language || 'code'}</span>
      <button
        className="code-copy"
        onClick={() => navigator.clipboard.writeText(code)}
        title="复制代码"
      >
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path
            fill="currentColor"
            d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
          />
        </svg>
      </button>
    </div>
    <pre>
      <code>{code}</code>
    </pre>
  </div>
);

const renderContent = (content: string | ContentBlock[]): React.ReactNode => {
  if (typeof content === 'string') {
    // 解析 Markdown 格式的代码块
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
        if (match) {
          const [, language, code] = match;
          return <CodeBlock key={index} code={code.trim()} language={language} />;
        }
      }

      // 处理普通文本
      return (
        <span key={index} className="text-content">
          {part}
        </span>
      );
    });
  }

  // 处理多内容块
  return content.map((block, index) => {
    if (block.type === 'text') {
      return <span key={index}>{block.text}</span>;
    }
    if (block.type === 'tool_result') {
      return (
        <div key={index} className="tool-result">
          <strong>Tool Result:</strong>
          <pre>{block.content}</pre>
        </div>
      );
    }
    return null;
  });
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`message-item ${isUser ? 'user' : 'assistant'}`}>
      {isUser ? <UserIcon /> : <AssistantIcon />}
      <div className="message-content">
        <div className="message-text">{renderContent(message.content)}</div>
      </div>
    </div>
  );
};
