import React, { useRef, useEffect } from 'react';
import { useConversationStore, useAgentStore } from '../../stores';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { LoadingDots } from '../common';
import './ChatPanel.css';

export const ChatPanel: React.FC = () => {
  const { currentConversationId, createConversation, getCurrentConversation } = useConversationStore();
  const { status, error, clearError } = useAgentStore();
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
      <div className="chat-header">
        <h3>AI 助手</h3>
        {status !== 'idle' && (
          <div className="chat-status">
            {status === 'thinking' && (
              <>
                <span className="status-dot thinking"></span>
                <span>思考中<LoadingDots /></span>
              </>
            )}
            {status === 'streaming' && (
              <>
                <span className="status-dot streaming"></span>
                <span>生成中...</span>
              </>
            )}
            {status === 'tool_call' && (
              <>
                <span className="status-dot tool"></span>
                <span>执行工具...</span>
              </>
            )}
            {status === 'error' && (
              <>
                <span className="status-dot error"></span>
                <span className="error-text">出错了</span>
              </>
            )}
          </div>
        )}
      </div>

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
