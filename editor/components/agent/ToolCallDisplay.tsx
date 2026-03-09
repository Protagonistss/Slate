import React from 'react';
import type { ToolCallRecord } from '../../stores';
import './ToolCallDisplay.css';

interface ToolCallDisplayProps {
  toolCall: ToolCallRecord;
}

const statusIcons: Record<ToolCallRecord['status'], React.ReactNode> = {
  pending: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    </svg>
  ),
  running: (
    <svg viewBox="0 0 24 24" width="16" height="16" className="spinning">
      <path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  ),
};

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ toolCall }) => {
  const { name, input, status, result, error } = toolCall;

  return (
    <div className={`tool-call tool-call-${status}`}>
      <div className="tool-call-header">
        <div className="tool-call-icon">{statusIcons[status]}</div>
        <span className="tool-call-name">{name}</span>
        <span className={`tool-call-status status-${status}`}>
          {status === 'pending' && '等待中'}
          {status === 'running' && '执行中...'}
          {status === 'success' && '成功'}
          {status === 'error' && '失败'}
        </span>
      </div>

      {Object.keys(input).length > 0 && (
        <div className="tool-call-input">
          <div className="tool-call-label">参数:</div>
          <pre>{JSON.stringify(input, null, 2)}</pre>
        </div>
      )}

      {status === 'success' && result !== undefined && (
        <div className="tool-call-result">
          <div className="tool-call-label">结果:</div>
          <pre>
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {status === 'error' && error && (
        <div className="tool-call-error">
          <div className="tool-call-label">错误:</div>
          <pre>{error}</pre>
        </div>
      )}
    </div>
  );
};
