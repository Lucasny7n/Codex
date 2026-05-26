import type { PermissionRequest } from '../../types/domain';

export type ToolRisk = 'safe' | 'elevated';

/** Static metadata for an internal tool the assistant can use. */
export interface ToolDescriptor {
  id: string;
  description: string;
  /** Simple param schema: name -> human description. Empty when no params. */
  schema: Record<string, string>;
  /** safe = read-only; elevated = mutates the system and needs approval. */
  risk: ToolRisk;
  requiresApproval: boolean;
}

/** Structured result of running a tool. Never contains raw shell or secrets. */
export interface ToolResult {
  toolId: string;
  ok: boolean;
  /** Human-readable text shown in the chat. */
  summary: string;
  /** Structured payload for the UI/model, if any. */
  data?: unknown;
  /** Human error when the tool failed or is unavailable. */
  error?: string;
  /** True when an elevated tool created an approval request (did not execute). */
  approvalRequested?: boolean;
  /** Permission request the caller should surface in the approval flow. */
  permissionRequest?: PermissionRequest;
}

/** Dependencies a tool run may need from the app. */
export interface ToolContext {
  ensureSession: (seed: string) => Promise<string>;
}
