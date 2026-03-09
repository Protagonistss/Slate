import React from 'react';
import { useConversationStore } from '../../stores';
import { MessageItem } from './MessageItem';
import './MessageList.css';

export const MessageList: React.FC = () => {
  const { getCurrentConversation } = useConversationStore();
  const conversation = getCurrentConversation();

  if (!conversation || conversation.messages.length === 0) {
    return (
      <div className="message-list-empty">
        <div className="welcome">
          <div className="welcome-icon">
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path
                fill="currentColor"
                d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
              />
            </svg>
          </div>
          <h2>欢迎使用 Slate</h2>
          <p>我是一个智能代码助手，可以帮你：</p>
          <ul>
            <li>编写和修改代码</li>
            <li>调试和修复问题</li>
            <li>解释代码逻辑</li>
            <li>执行终端命令</li>
            <li>管理项目文件</li>
          </ul>
          <p className="hint">输入消息开始对话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {conversation.messages
        .filter((msg) => msg.role !== 'system')
        .map((message, index) => (
          <MessageItem key={index} message={message} index={index} />
        ))}
    </div>
  );
};
