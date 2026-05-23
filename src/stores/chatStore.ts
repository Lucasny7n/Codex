import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system' | 'ai';
  content: string;
  timestamp: number;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [
    {
      id: 'init-1',
      sender: 'system',
      content: 'Ailu Studio carregado. Modo Operador Local ativo. Posso conversar, diagnosticar, preparar planos seguros e gerenciar IA local.',
      timestamp: Date.now(),
    }
  ],
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { ...msg, id: Math.random().toString(36).substring(7), timestamp: Date.now() }]
  })),
  clearMessages: () => set({ messages: [] })
}));
