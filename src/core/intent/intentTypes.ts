export type IntentType = 
  | 'conversation'
  | 'date_time'
  | 'explanation'
  | 'diagnostic'
  | 'action_plan'
  | 'memory_save'
  | 'model_question'
  | 'runtime_help'
  | 'voice_help'
  | 'unknown';

export interface IntentResult {
  type: IntentType;
  confidence: number;
  normalizedText: string;
  entities?: Record<string, string>;
  requiresApproval?: boolean;
  reason?: string;
}
