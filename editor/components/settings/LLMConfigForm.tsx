import React, { useState } from 'react';
import { useConfigStore } from '../../stores';
import type { LLMProvider } from '../../services/llm/types';
import { LLMFactory } from '../../services/llm';
import { Button } from '../common';
import './LLMConfigForm.css';

const providers: { id: LLMProvider; name: string; description: string }[] = [
  { id: 'anthropic', name: 'Anthropic Claude', description: 'Claude 3.5 / Claude 4 系列模型' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4 / GPT-3.5 系列模型' },
  { id: 'ollama', name: 'Ollama', description: '本地运行的模型' },
];

export const LLMConfigForm: React.FC = () => {
  const {
    currentProvider,
    setCurrentProvider,
    llmConfigs,
    setLLMConfig,
    apiKeys,
    setApiKey,
  } = useConfigStore();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const currentConfig = llmConfigs[currentProvider];
  const currentApiKey = apiKeys[currentProvider];

  const handleModelChange = (model: string) => {
    setLLMConfig(currentProvider, { model });
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(currentProvider, key || undefined);
    setTestResult(null);
  };

  const handleBaseUrlChange = (url: string) => {
    setLLMConfig(currentProvider, { baseUrl: url || undefined });
  };

  const handleTemperatureChange = (temp: number) => {
    setLLMConfig(currentProvider, { temperature: temp });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const config = {
        ...currentConfig,
        apiKey: currentApiKey,
      };

      const adapter = LLMFactory.createAdapter(config);
      const isValid = await adapter.validateConfig();

      setTestResult(isValid ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="llm-config-form">
      <div className="config-section">
        <h4>选择提供商</h4>
        <div className="provider-list">
          {providers.map((provider) => (
            <button
              key={provider.id}
              className={`provider-item ${currentProvider === provider.id ? 'active' : ''}`}
              onClick={() => setCurrentProvider(provider.id)}
            >
              <div className="provider-name">{provider.name}</div>
              <div className="provider-desc">{provider.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="config-section">
        <h4>API 配置</h4>

        {currentProvider !== 'ollama' && (
          <div className="form-group">
            <label>API Key</label>
            <div className="api-key-input">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={currentApiKey || ''}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={`输入 ${providers.find((p) => p.id === currentProvider)?.name} API Key`}
              />
              <button
                className="toggle-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                type="button"
              >
                {showApiKey ? (
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {currentProvider === 'ollama' && (
          <div className="form-group">
            <label>Ollama 地址</label>
            <input
              type="text"
              value={currentConfig.baseUrl || ''}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
        )}

        <div className="form-group">
          <label>模型</label>
          <input
            type="text"
            value={currentConfig.model}
            onChange={(e) => handleModelChange(e.target.value)}
            placeholder="输入模型名称"
          />
        </div>

        <div className="form-group">
          <label>Temperature: {currentConfig.temperature ?? 0.7}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={currentConfig.temperature ?? 0.7}
            onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
          />
        </div>

        <div className="form-actions">
          <Button onClick={handleTestConnection} loading={testing}>
            测试连接
          </Button>
          {testResult && (
            <span className={`test-result ${testResult}`}>
              {testResult === 'success' ? '连接成功' : '连接失败'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
