import { create } from 'zustand';
import { ActiveContext } from '../types/context';

interface ContextStore {
  activeContext: ActiveContext | null;
  setActiveContext: (context: ActiveContext | null) => void;
  clearContext: () => void;
}

export const useContextStore = create<ContextStore>((set) => ({
  activeContext: null,
  setActiveContext: (context) => set({ activeContext: context }),
  clearContext: () => set({ activeContext: null })
}));
