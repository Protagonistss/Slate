// ProviderEditor - Provider 编辑表单组件
import { cn } from "@/lib/utils";
import { getBackendBaseUrl } from "@/services/backend/auth";
import type { BackendLLMProvider } from "@/services/backend/llm";
import { REASONING_EFFORT_SELECT_OPTIONS, type ProviderDraft } from "./utils";

export interface ProviderEditorProps {
  provider: BackendLLMProvider;
  draft: ProviderDraft;
  onChange: (draft: ProviderDraft) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  pendingProvider: string | null;
}

export function ProviderEditor({
  provider,
  draft,
  onChange,
  onCancel,
  onSave,
  onDelete,
  pendingProvider,
}: ProviderEditorProps) {
  const isCustom = provider.source === "custom";
  const isPending = pendingProvider === provider.name;

  return (
    <div className="mt-2 mb-4 flex flex-col gap-4 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-4">
      <div>
        <h4 className="text-[13px] font-medium text-zinc-300">{provider.display_name}</h4>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {isCustom
            ? "OpenAI-compatible API endpoint"
            : "Built-in backend provider. Only local invocation defaults are editable here."}
        </p>
      </div>

      <div className="space-y-4">
        {isCustom ? (
          <>
            <ProviderFormField
              label="Provider Name"
              value={draft.displayName}
              onChange={(value) => onChange({ ...draft, displayName: value })}
              placeholder="e.g. DeepSeek"
            />

            <ProviderFormField
              label="Model Name"
              value={draft.modelText}
              onChange={(value) => onChange({ ...draft, modelText: value })}
              placeholder="e.g. deepseek-chat"
            />

            <ProviderFormField
              label="Base URL"
              value={draft.baseUrl}
              onChange={(value) => onChange({ ...draft, baseUrl: value })}
              placeholder="https://api.openai.com/v1"
            />

            <div className="flex items-center gap-4">
              <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">API Key</label>
              <div className="flex-1">
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(event) => onChange({ ...draft, apiKey: event.target.value })}
                  placeholder={provider.configured ? "********" : "sk-..."}
                  className="w-full border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                />
                {provider.configured && (
                  <p className="pt-1 text-[11px] text-zinc-600">留空表示保持当前 API Key。</p>
                )}
              </div>
            </div>

            <ReasoningEffortSelect draft={draft} onChange={onChange} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Base URL</label>
              <div className="flex-1 border-b border-white/10 pb-1.5 font-mono text-[12px] text-zinc-500">
                {provider.base_url || getBackendBaseUrl()}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Default Model</label>
              <div className="relative flex-1">
                <select
                  value={draft.model}
                  onChange={(event) => onChange({ ...draft, model: event.target.value })}
                  disabled={provider.models.length === 0}
                  className="w-full appearance-none border-b border-white/10 bg-transparent pb-1.5 pr-8 text-[12px] text-zinc-300 transition-colors focus:border-zinc-500 focus:outline-none disabled:text-zinc-600"
                >
                  {provider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <ReasoningEffortSelect draft={draft} onChange={onChange} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {onDelete && provider.deletable && (
            <button
              onClick={() => void onDelete()}
              disabled={isPending}
              className="text-[12px] text-red-400/70 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={() => void onSave()}
            disabled={isPending}
            className="text-[12px] font-medium text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProviderFormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}

function ReasoningEffortSelect({
  draft,
  onChange,
}: {
  draft: ProviderDraft;
  onChange: (draft: ProviderDraft) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4">
        <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">推理强度</label>
        <div className="relative flex-1">
          <select
            value={draft.reasoningEffort}
            onChange={(event) => onChange({ ...draft, reasoningEffort: event.target.value })}
            className="w-full appearance-none border-b border-white/10 bg-transparent pb-1.5 pr-8 text-[12px] text-zinc-300 transition-colors focus:border-zinc-500 focus:outline-none"
          >
            {REASONING_EFFORT_SELECT_OPTIONS.map((opt) => (
              <option key={opt.value || "default"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
      <p className="ml-28 text-[11px] text-zinc-600">
        对应 OpenAI 协议 <code className="font-mono text-zinc-500">reasoning_effort</code>；不支持的模型会忽略。
      </p>
    </div>
  );
}

function ProviderFormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: ProviderFormFieldProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}
