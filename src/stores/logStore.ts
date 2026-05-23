import { create } from 'zustand';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'system' | 'chat' | 'approval' | 'runtime' | 'memory' | 'voice' | 'error';
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  relatedPlanId?: string;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (type: LogEntry['type'], level: LogEntry['level'], message: string, relatedPlanId?: string) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  addLog: (type, level, message, relatedPlanId) => set((state) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      type,
      level,
      message,
      relatedPlanId
    };
    return { logs: [newLog, ...state.logs].slice(0, 1000) }; // Keep last 1000
  }),
  clearLogs: () => set({ logs: [] })
}));
