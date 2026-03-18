// Internal Agent Tools - 内部工具定义
import type { ToolDefinition } from '../../llm/types';

// Internal tool names
export const INTERNAL_AGENT_TOOL_NAMES = {
  submitPlan: 'submit_plan',
  updateStepStatus: 'update_step_status',
  appendStepSummary: 'append_step_summary',
  attachArtifact: 'attach_artifact',
  appendReasoning: 'append_reasoning',
} as const;

export const INTERNAL_AGENT_TOOL_SET = new Set<string>(Object.values(INTERNAL_AGENT_TOOL_NAMES));

/**
 * Creates the planning tool definition for plan submission
 */
export function createPlanningTool(): ToolDefinition {
  return {
    name: INTERNAL_AGENT_TOOL_NAMES.submitPlan,
    description: 'Submit the execution plan for the current engineering goal.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the plan.',
        },
        steps_json: {
          type: 'string',
          description: 'JSON array string. Each item: {"title": string, "summary": string, "dependsOn": string[]}.',
        },
      },
      required: ['steps_json'],
    },
  };
}

/**
 * Creates the runtime tools for execution phase
 */
export function createExecutionRuntimeTools(): ToolDefinition[] {
  return [
    {
      name: INTERNAL_AGENT_TOOL_NAMES.updateStepStatus,
      description: 'Update the status of a plan step.',
      input_schema: {
        type: 'object',
        properties: {
          step_id: { type: 'string', description: 'Target step id, for example step_1.' },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'blocked', 'cancelled'],
            description: 'Next status for the step.',
          },
          summary: { type: 'string', description: 'Optional short summary for the status change.' },
        },
        required: ['step_id', 'status'],
      },
    },
    {
      name: INTERNAL_AGENT_TOOL_NAMES.appendStepSummary,
      description: 'Append a concise progress summary to a plan step.',
      input_schema: {
        type: 'object',
        properties: {
          step_id: { type: 'string', description: 'Target step id.' },
          summary: { type: 'string', description: 'Short progress summary for the step.' },
        },
        required: ['step_id', 'summary'],
      },
    },
    {
      name: INTERNAL_AGENT_TOOL_NAMES.attachArtifact,
      description: 'Attach a previewable artifact to the current run.',
      input_schema: {
        type: 'object',
        properties: {
          step_id: { type: 'string', description: 'Optional step id related to the artifact.' },
          path: { type: 'string', description: 'Display path for the artifact.' },
          kind: {
            type: 'string',
            enum: ['plan', 'file', 'tool_result', 'note'],
            description: 'Artifact type.',
          },
          title: { type: 'string', description: 'Optional display title.' },
          preview: { type: 'string', description: 'Optional preview text.' },
        },
        required: ['path', 'kind'],
      },
    },
    {
      name: INTERNAL_AGENT_TOOL_NAMES.appendReasoning,
      description: 'Append a concise in-progress reasoning note for the run. Do not use this for final summaries or output recaps.',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Short in-progress reasoning note, not a final summary or markdown recap.' },
          phase: {
            type: 'string',
            enum: ['planning', 'execution', 'tool'],
            description: 'Reasoning phase.',
          },
          step_id: { type: 'string', description: 'Optional step id.' },
        },
        required: ['text', 'phase'],
      },
    },
  ];
}
