import type { UiIconName } from '../components/common/AppIcons';

export type AiluNavigationView = 'chat' | 'ai-workspace' | 'llm-library';

export interface AiluNavigationItem {
  id: AiluNavigationView;
  label: string;
  icon: UiIconName;
  description: string;
}

export const AILU_NAVIGATION_ITEMS: AiluNavigationItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: 'message',
    description: 'Conversas persistentes, temporárias e projetos.',
  },
  {
    id: 'ai-workspace',
    label: 'AI Workspace',
    icon: 'spark',
    description: 'Planos, aprovações, contexto de projeto e módulos de produtividade.',
  },
  {
    id: 'llm-library',
    label: 'LLM Library',
    icon: 'book',
    description: 'Catálogo curado de modelos, papers, avaliação, inferência e segurança.',
  },
];
