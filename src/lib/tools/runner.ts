import {
  detectLocalHardware,
  getAppHealthCheck,
  getLocalRuntimeState,
  listRunningProcesses,
  requestExecution,
} from '../api';
import { SYSTEM_UPDATE_COMMAND, formatHardware, formatHealth, formatModels, formatProcesses } from './registry';
import type { ToolContext, ToolResult } from './types';

function humanError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause ?? '');
  const firstLine = raw.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  if (!firstLine || /^[{[]/u.test(firstLine) || /panic|backtrace|stack/iu.test(firstLine)) {
    return 'A ferramenta falhou e não retornou um motivo legível.';
  }
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}

/**
 * Runs an internal tool by id. Safe tools read real data; the elevated update
 * tool only creates an approval request and never executes directly. Any
 * failure is returned as a human error, never a stack trace.
 */
export async function runTool(toolId: string, ctx: ToolContext): Promise<ToolResult> {
  try {
    switch (toolId) {
      case 'get_hardware_summary': {
        const snapshot = await detectLocalHardware();
        return { toolId, ok: true, summary: formatHardware(snapshot), data: snapshot };
      }
      case 'list_local_models': {
        const snapshot = await getLocalRuntimeState();
        return { toolId, ok: true, summary: formatModels(snapshot), data: snapshot.installedModels };
      }
      case 'get_health_status': {
        const health = await getAppHealthCheck();
        return { toolId, ok: true, summary: formatHealth(health), data: health };
      }
      case 'list_running_processes': {
        const report = await listRunningProcesses();
        return { toolId, ok: !report.error, summary: formatProcesses(report), data: report, error: report.error };
      }
      case 'request_system_update': {
        const sessionId = await ctx.ensureSession('Atualização do sistema');
        const response = await requestExecution({
          sessionId,
          command: SYSTEM_UPDATE_COMMAND,
          reason: 'Atualização do sistema solicitada no chat. Requer aprovação explícita.',
        });
        const summary = [
          'Plano: atualizar os pacotes do sistema.',
          `Comando pretendido: \`${SYSTEM_UPDATE_COMMAND}\``,
          response.approvalRequired
            ? 'Enviei para aprovação — nada roda até você aprovar no painel de permissões.'
            : 'Encaminhado ao fluxo de execução aprovado.',
          'Quando concluir, te trago o relatório do que mudou.',
        ].join('\n');
        return {
          toolId,
          ok: true,
          summary,
          data: response,
          approvalRequested: response.approvalRequired,
          permissionRequest: response.permissionRequest,
        };
      }
      default:
        return {
          toolId,
          ok: false,
          summary: '',
          error: 'Essa ação ainda não está disponível no Ailu. Posso te explicar um caminho seguro.',
        };
    }
  } catch (cause) {
    return { toolId, ok: false, summary: '', error: humanError(cause) };
  }
}
