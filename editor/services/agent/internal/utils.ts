// Agent Execution Utils - 通用工具函数
import type { Message } from '../../llm/types';
import { INTERNAL_AGENT_TOOL_NAMES } from './tools';
import type { MessageContext } from '../types';

/**
 * Sanitizes a string to be used as a path segment
 */
export function sanitizePathSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

/**
 * Normalizes a title for comparison
 */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Builds a conversation title from content
 */
export function buildConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新对话';
  }
  const title = normalized.slice(0, 48);
  return normalized.length > 48 ? `${title}...` : title;
}

/**
 * Appends system prompt to messages
 */
export function appendSystemPrompt(messages: Message[], systemPrompt?: string): Message[] {
  if (!systemPrompt) {
    return messages;
  }
  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...messages,
  ];
}

/**
 * Sanitizes chat messages before sending them to the LLM gateway.
 */
export function sanitizeMessagesForLLM(messages: Message[], fallbackUserText?: string): Message[] {
  const sanitized: Message[] = [];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      const nextContent = message.content.trim();
      if (!nextContent) {
        continue;
      }

      sanitized.push({
        ...message,
        content: nextContent,
      });
      continue;
    }

    if (!Array.isArray(message.content) || message.content.length === 0) {
      continue;
    }

    const nextBlocks = message.content.filter((block) => {
      switch (block.type) {
        case 'text':
          return Boolean(block.text.trim());
        case 'image':
          return Boolean(block.source?.data?.trim());
        case 'tool_use':
          return Boolean(block.id.trim() && block.name.trim());
        case 'tool_result':
          return Boolean(block.tool_use_id.trim() && block.content.trim());
        default:
          return false;
      }
    });

    if (nextBlocks.length === 0) {
      continue;
    }

    if (message.role === 'system') {
      const nextContent = nextBlocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join('\n\n');

      if (!nextContent) {
        continue;
      }

      sanitized.push({
        role: 'system',
        content: nextContent,
      });
      continue;
    }

    sanitized.push({
      ...message,
      content: nextBlocks,
    });
  }

  const hasUserMessage = sanitized.some((message) => message.role === 'user');
  const nextFallback = fallbackUserText?.trim();

  if (!hasUserMessage && nextFallback) {
    sanitized.push({
      role: 'user',
      content: nextFallback,
    });
  }

  return sanitized;
}

/**
 * Builds workspace summary string for context
 */
export function buildWorkspaceSummary(context: MessageContext): string {
  const openFiles = Array.isArray(context.toolContext.openFiles) && context.toolContext.openFiles.length > 0
    ? context.toolContext.openFiles.join(', ')
    : 'none';

  return [
    `Working directory: ${context.toolContext.workingDirectory || 'not set'}`,
    `Active file: ${context.toolContext.activeFile || 'none'}`,
    `Open files: ${openFiles}`,
    `Available external tools: ${context.externalTools.length > 0 ? context.externalTools.map((tool) => tool.name).join(', ') : 'none'}`,
  ].join('\n');
}

/**
 * Builds the planning phase system prompt
 */
export function buildPlanningSystemPrompt(basePrompt: string | undefined, context: MessageContext): string {
  return [
    basePrompt?.trim() || '',
    'You are in Slate planning mode for an engineering execution agent.',
    'Do not execute external tools in this phase.',
    `You must call "${INTERNAL_AGENT_TOOL_NAMES.submitPlan}" exactly once.`,
    'Return 3 to 7 concrete execution steps.',
    'Each step must be observable and actionable inside the current workspace.',
    'Prefer discovery before edits, then implementation, then validation.',
    'Set "steps_json" to a JSON array string. Each item must be an object with:',
    '- "title": short step title',
    '- "summary": short expected outcome',
    '- "dependsOn": optional array of prior step titles',
    'Workspace context:',
    buildWorkspaceSummary(context),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Builds the execution phase system prompt
 */
export function buildExecutionSystemPrompt(
  basePrompt: string | undefined,
  context: MessageContext,
  run: { goal: string; steps: Array<{ id: string; title: string; status: string }> }
): string {
  const planLines = run.steps.map((step) => {
    return `- ${step.id}: ${step.title} [${step.status}]`;
  });

  const apiReasoningEnabled = Boolean(context.llmConfig.reasoningEffort);

  return [
    basePrompt?.trim() || '',
    'You are executing an approved Slate engineering plan.',
    `Goal: ${run.goal}`,
    'Execution rules:',
    `1. Before work starts on a step, call "${INTERNAL_AGENT_TOOL_NAMES.updateStepStatus}" with status="running".`,
    apiReasoningEnabled
      ? `2. The model gateway may stream API-level reasoning separately. Use "${INTERNAL_AGENT_TOOL_NAMES.appendReasoning}" only for short, step-scoped notes when needed (e.g. before external tool calls), and avoid repeating long reasoning already shown in the API stream.`
      : `2. Use "${INTERNAL_AGENT_TOOL_NAMES.appendReasoning}" to record your step-by-step thinking for EACH step.`,
    apiReasoningEnabled
      ? `   - Keep each note 1-3 sentences; do not use "${INTERNAL_AGENT_TOOL_NAMES.appendReasoning}" for final summaries or repeating file/tool output.`
      : `   - At minimum: one note when a step starts, and one note before each external tool call (what you are about to do and why).`,
    apiReasoningEnabled
      ? ''
      : `   - Keep notes focused on the current step, 1-4 sentences each.`,
    apiReasoningEnabled
      ? ''
      : `   - Do not use "${INTERNAL_AGENT_TOOL_NAMES.appendReasoning}" for final summaries or repeating file/tool output.`,
    `3. Use "${INTERNAL_AGENT_TOOL_NAMES.appendStepSummary}" whenever you have a meaningful result for a step.`,
    `4. Use "${INTERNAL_AGENT_TOOL_NAMES.attachArtifact}" for files, plans, or tool outputs worth showing in Live Artifacts.`,
    `5. When a step completes, call "${INTERNAL_AGENT_TOOL_NAMES.updateStepStatus}" with status="completed".`,
    `6. If blocked, call "${INTERNAL_AGENT_TOOL_NAMES.updateStepStatus}" with status="blocked" and include a short summary.`,
    '7. Keep only one step running at a time.',
    'Current plan:',
    ...planLines,
    'Workspace context:',
    buildWorkspaceSummary(context),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Serializes tool result to string
 */
export function serializeToolResult(toolResult: { success: boolean; data?: unknown; error?: string }): string {
  if (toolResult.data !== undefined) {
    return typeof toolResult.data === 'string'
      ? toolResult.data
      : JSON.stringify(toolResult.data, null, 2);
  }
  return toolResult.error || 'Tool execution failed';
}
