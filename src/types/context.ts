export type ActiveContextType =
  | 'system'
  | 'model'
  | 'file'
  | 'project'
  | 'error'
  | 'log'
  | 'command'
  | 'memory'
  | 'skill'
  | 'download'
  | 'process'
  | 'service'
  | 'runtime'
  | 'voice'
  | 'diagnostic'
  | 'approval'
  | 'automation'
  | 'window';

export interface ActiveContext {
  type: ActiveContextType;
  id: string;
  label: string;
  summary: string;
  data: unknown;
  source: string;
  timestamp: number;
}
