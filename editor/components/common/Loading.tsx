import React from 'react';
import './Loading.css';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const content = (
    <div className={`loading loading-${size}`}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-fullscreen">{content}</div>;
  }

  return content;
};

export const LoadingDots: React.FC = () => (
  <span className="loading-dots">
    <span>.</span>
    <span>.</span>
    <span>.</span>
  </span>
);
