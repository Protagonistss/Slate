import React, { useRef, useEffect } from 'react';
import { useConversationStore, useAgentStore } from '../../stores';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import './ChatPanel.css';

export const ChatPanel: React.FC = () => {
  const { currentConversationId, createConversation, getCurrentConversation } = useConversationStore();
  const { error, clearError } = useAgentStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取当前会话（用于监听消息变化）
  const conversation = getCurrentConversation();

  // 自动滚动到底部 - 当消息数量变化时滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  // 确保有当前会话
  useEffect(() => {
    if (!currentConversationId) {
      createConversation();
    }
  }, [currentConversationId, createConversation]);

  // 清除错误
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        <MessageList />
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="chat-error">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <InputArea />
    </div>
  );
};
