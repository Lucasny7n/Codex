import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useApprovalStore } from '../../stores/approvalStore';
import { useModelStore } from '../../stores/modelStore';
import { useLogStore } from '../../stores/logStore';
import { invoke } from '@tauri-apps/api/core';
import { routeIntent } from '../../core/intent/intentRouter';
import { createActionPlan } from '../../core/intent/actionPlanner';
import { composeResponse } from '../../core/intent/responseComposer';

export function OperatorView() {
  const [input, setInput] = useState('');
  const { messages, addMessage } = useChatStore();
  const { requestApproval } = useApprovalStore();
  const { primaryModelId } = useModelStore();
  const { addLog } = useLogStore();

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    addMessage({ sender: 'user', content: text });
    addLog('chat', 'info', `Usuário enviou: ${text}`);
    setInput('');
    
    setTimeout(async () => {
      const context = { primaryModelId };
      const intent = routeIntent(text);
      
      addLog('chat', 'success', `Intent detectado: ${intent.type}`);

      if (intent.type === 'action_plan') {
        const plan = createActionPlan(intent);
        if (plan) {
          addMessage({ sender: 'ai', content: `Gerando plano de ação para: ${plan.summary}...` });
          requestApproval(plan);
        } else {
          addMessage({ sender: 'ai', content: "Não encontrei uma skill segura para esta ação. Posso criar um rascunho de plano manual, mas ele exigirá revisão." });
        }
        return;
      }

      if (intent.type === 'memory_save') {
        addLog('chat', 'info', 'Tentando salvar memória no SQLite...');
        try {
          await invoke('create_memory', { content: 'Decisão de configuração do sistema salva via chat', tags: 'config,decisao' });
          addMessage({ sender: 'system', content: '💾 Memória salva com sucesso no banco de dados SQLite local.' });
          addLog('memory', 'success', 'Memória inserida via Chat com sucesso.');
        } catch (e) {
          addMessage({ sender: 'system', content: 'Erro ao salvar memória: ' + String(e) });
          addLog('memory', 'error', 'Falha ao salvar no SQLite: ' + String(e));
        }
        return;
      }

      // Default responses
      const response = composeResponse(intent, context);
      addMessage({ sender: 'ai', content: response });

    }, 400);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {messages.map(msg => (
          <div key={msg.id} className="app-card" style={msg.sender === 'user' ? { alignSelf: 'flex-end', backgroundColor: 'var(--bg-input)', maxWidth: '768px' } : { alignSelf: 'flex-start', maxWidth: '768px' }}>
            <div style={{ color: 'var(--text-active)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 'var(--space-2)' }} >
              {msg.sender === 'user' ? 'Você' : msg.sender === 'system' ? 'Sistema' : 'Ailu'}
            </div>
            <div style={{ color: 'var(--text-main)', lineHeight: 1.5, fontSize: '0.875rem' }}>{msg.content}</div>
          </div>
        ))}
      </div>
      
      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', display: 'flex', gap: 'var(--space-3)' }}>
          <button className="app-button app-button-secondary" style={{ padding: 'var(--space-3)' }}>🎙️</button>
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite um comando, pergunte algo ou peça para executar..."
            className="app-textarea"
            rows={2}
          />
          <button className="app-button app-button-primary" onClick={handleSend}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
