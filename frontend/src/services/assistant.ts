import api from '../api';

export interface AgentStep {
  type: 'intent' | 'retrieval' | 'research' | 'compose' | string;
  label: string;
  detail?: string | null;
}

export interface CompanyResearch {
  name?: string;
  website?: string | null;
  overview?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  company_size?: string | null;
  products_services?: string[];
  culture_and_values?: string[];
  recent_highlights?: string[];
  careers_url?: string | null;
  jobs_url?: string | null;
  talking_points?: string[];
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  intent: string;
  steps: AgentStep[];
  sources: string[];
  company_research?: CompanyResearch | null;
  provider_used?: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string | null;
  steps: AgentStep[];
  sources: string[];
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStatus {
  indexed: boolean;
  doc_count: number;
  embedding_provider?: string | null;
  last_indexed?: string | null;
}

export const assistantService = {
  async chat(message: string, conversationId?: string | null): Promise<ChatResponse> {
    // Chat may run intent detection + live web research + composition —
    // allow well beyond the global 20s default.
    const res = await api.post(
      '/assistant/chat',
      { message, conversation_id: conversationId || undefined },
      { timeout: 120000 },
    );
    return res.data;
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await api.get('/assistant/conversations');
    return res.data;
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const res = await api.get(`/assistant/conversations/${conversationId}/messages`);
    return res.data;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/assistant/conversations/${conversationId}`);
  },

  async getKnowledgeStatus(): Promise<KnowledgeStatus> {
    const res = await api.get('/assistant/knowledge');
    return res.data;
  },

  async reindexKnowledge(): Promise<{ doc_count: number; embedding_provider?: string | null }> {
    const res = await api.post('/assistant/knowledge/reindex', undefined, { timeout: 60000 });
    return res.data;
  },
};
