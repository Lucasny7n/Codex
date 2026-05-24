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

      // V5: Runtime Check
      const lowerText = text.toLowerCase();
      const isTestRequest = lowerText.includes('teste o modelo') || lowerText.includes('faz uma pergunta para o modelo') || lowerText.includes('gerar texto');

      const { canGenerate } = await import('../../core/runtime/runtimeClient');
      const { useRuntimeStore } = await import('../../stores/runtimeStore');
      const { generateOllamaText } = await import('../../core/runtime/ollamaClient');
      const store = useRuntimeStore.getState();
      
      if (canGenerate()) {
         addMessage({ sender: 'ai', content: `Conectando ao AirLLM...` });
         addLog('runtime', 'info', `Sidecar chamado para geração. Modelo: ${store.status.selectedModelId}`);
         
         try {
           const res = await store.generateText(store.status.selectedModelId || '', text);
           if (res.ok && res.response) {
             addMessage({ sender: 'ai', content: res.response });
             addLog('runtime', 'success', `Geração concluída. Tokens/s: ${res.tokens_per_second}`);
           } else {
             addMessage({ sender: 'ai', content: `Falha na geração: ${res.message}` });
             addLog('runtime', 'error', `Sidecar erro: ${res.code} - ${res.message}`);
           }
         } catch(e) {
           addMessage({ sender: 'ai', content: `Erro crítico de sidecar: ${String(e)}` });
           addLog('runtime', 'error', `Erro ao chamar sidecar: ${String(e)}`);
         }
         return;
      }

      // Ollama Fallback
      if (store.status.ollamaAvailable && store.status.ollamaModels.length > 0 && (intent.type === 'unknown' || intent.type === 'explanation' || intent.type === 'conversation' || isTestRequest)) {
         const ollamaModel = store.status.ollamaModels[0]; // fallback to first model
         addMessage({ sender: 'ai', content: `*(via Ollama: ${ollamaModel})* Gerando resposta...` });
         addLog('runtime', 'info', `Fallback Ollama ativado. Modelo: ${ollamaModel}`);
         try {
            const ollamaRes = await generateOllamaText(ollamaModel, text);
            addMessage({ sender: 'ai', content: `*(via Ollama: ${ollamaModel})*\n\n${ollamaRes}` });
            addLog('runtime', 'success', `Geração via Ollama concluída.`);
         } catch (e) {
            addMessage({ sender: 'ai', content: `*(via Ollama)* Erro: ${String(e)}` });
            addLog('runtime', 'error', `Erro Ollama: ${String(e)}`);
         }
         return;
      }

      if (isTestRequest) {
        addMessage({ sender: 'ai', content: "AirLLM e Ollama não estão disponíveis. Posso criar um plano de instalação do ambiente se você pedir ou usar o painel Runtime." });
        addLog('chat', 'warn', 'Tentativa de uso de modelo com runtimes indisponíveis.');
        return;
      }

      // Default fallback local
      addLog('chat', 'info', 'Runtimes indisponíveis. Usando fallback local estático.');
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
