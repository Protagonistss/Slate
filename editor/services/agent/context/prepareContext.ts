// Context Preparation - 上下文准备
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useEditorStore } from '@/stores/editorStore';
import { toolRegistry } from '../../tools';
import { buildConversationTitle } from '../internal/utils';
import type { MessageContext } from '../types';

/**
 * Prepares the context for a new goal
 */
export async function prepareNewGoalContext(content: string): Promise<MessageContext | null> {
  console.log('[prepareNewGoalContext] called with:', content);
  
  const conversationStore = useConversationStore.getState();
  const configStore = useConfigStore.getState();
  const authStore = useAuthStore.getState();
  const editorStore = useEditorStore.getState();

  const accessToken = authStore.accessToken;
  console.log('[prepareNewGoalContext] accessToken:', !!accessToken);
  if (!accessToken) {
    console.log('[prepareNewGoalContext] No access token, returning null');
    return null;
  }

  let conversationId = conversationStore.currentConversationId;
  const suggestedTitle = buildConversationTitle(content);
  console.log('[prepareNewGoalContext] conversationId:', conversationId, 'suggestedTitle:', suggestedTitle);

  const currentConversation = conversationId
    ? conversationStore.getConversation(conversationId)
    : undefined;

  if (!conversationId || !currentConversation) {
    conversationId = await conversationStore.createConversation(suggestedTitle);
    console.log('[prepareNewGoalContext] created conversationId:', conversationId);
  } else {
    const canReplacePlaceholderTitle =
      currentConversation &&
      currentConversation.messages.length === 0 &&
      /^新对话(?:\s+\d+)?$/.test(currentConversation.title);

    if (canReplacePlaceholderTitle) {
      conversationStore.renameConversation(conversationId, suggestedTitle);
    }
  }

  await useConversationStore.getState().addMessage(conversationId, {
    role: 'user',
    content,
  });

  const llmConfig = configStore.getCurrentLLMConfig();
  console.log('[prepareNewGoalContext] llmConfig:', llmConfig);
  if (!llmConfig.provider || !llmConfig.model) {
    console.log('[prepareNewGoalContext] No provider or model, returning null');
    return null;
  }

  const activeFile = editorStore.getActiveFile();

  const context = {
    conversationId,
    accessToken,
    llmConfig,
    externalTools: toolRegistry.getAllDefinitions(),
    toolContext: {
      workingDirectory: configStore.workingDirectory,
      openFiles: editorStore.openFiles.map((file) => file.path),
      activeFile: activeFile?.path,
      editorContent: activeFile?.content,
    },
    systemPrompt: configStore.llmConfigs[configStore.currentProvider]?.systemPrompt,
  };
  
  console.log('[prepareNewGoalContext] returning context:', context.conversationId);
  return context;
}

/**
 * Prepares the context for resuming an existing run
 */
export function prepareExistingContext(): MessageContext | null {
  const conversationStore = useConversationStore.getState();
  const configStore = useConfigStore.getState();
  const authStore = useAuthStore.getState();
  const editorStore = useEditorStore.getState();

  const accessToken = authStore.accessToken;
  const conversationId = conversationStore.currentConversationId;

  if (!accessToken || !conversationId) {
    return null;
  }

  const llmConfig = configStore.getCurrentLLMConfig();
  if (!llmConfig.provider || !llmConfig.model) {
    return null;
  }

  const activeFile = editorStore.getActiveFile();

  return {
    conversationId,
    accessToken,
    llmConfig,
    externalTools: toolRegistry.getAllDefinitions(),
    toolContext: {
      workingDirectory: configStore.workingDirectory,
      openFiles: editorStore.openFiles.map((file) => file.path),
      activeFile: activeFile?.path,
      editorContent: activeFile?.content,
    },
    systemPrompt: configStore.llmConfigs[configStore.currentProvider]?.systemPrompt,
  };
}
