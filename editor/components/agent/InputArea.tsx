import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore, useConversationStore } from '../../stores';
import './InputArea.css';

export const InputArea: React.FC = () => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isProcessing, sendMessage, stopGeneration } = useAgentStore();
  const { currentConversationId, createConversation } = useConversationStore();

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const message = input.trim();
    setInput('');

    // 确保有会话
    if (!currentConversationId) {
      createConversation();
    }

    await sendMessage(message);
  }, [input, isProcessing, currentConversationId, createConversation, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="input-area">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Shift+Enter 换行)"
          disabled={isProcessing}
          rows={1}
        />
        <div className="input-actions">
          {isProcessing ? (
            <button
              type="button"
              className="input-action-button input-action-stop"
              onClick={stopGeneration}
              title="停止生成"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M6 6h12v12H6z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="input-action-button input-action-send"
              onClick={handleSubmit}
              disabled={!input.trim()}
              title="发送消息"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="input-hint">
        提示：Agent 可以执行命令和修改文件，请仔细审查操作
      </p>
    </div>
  );
};
