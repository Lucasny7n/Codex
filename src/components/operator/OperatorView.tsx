import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useApprovalStore } from '../../stores/approvalStore';
import { useModelStore } from '../../stores/modelStore';
import { useLogStore } from '../../stores/logStore';
import { invoke } from '@tauri-apps/api/core';

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
      const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
      
      const isConversational = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'].some(word => lower === word || lower.startsWith(word));

      if (isConversational) {
        addMessage({ sender: 'ai', content: 'Olá! Sou o Ailu, seu Operador Local. Como posso ajudar com diagnósticos, execução de scripts ou testes hoje?' });
        addLog('chat', 'success', 'Intent detectado: conversation');
      } 
      else if (lower === 'tudo bem' || lower === 'tudo bem?') {
        addMessage({ sender: 'ai', content: 'Tudo ótimo, operando 100% local no seu Arch Linux. O que vamos construir hoje?' });
        addLog('chat', 'success', 'Intent detectado: conversation');
      }
      else if (lower.includes('que dia e hoje') || lower.includes('que dia hoje')) {
        const date = new Date().toLocaleString('pt-BR');
        if (lower.includes('so me diga')) {
           addMessage({ sender: 'ai', content: date });
        } else {
           addMessage({ sender: 'ai', content: `Hoje é ${date}.` });
        }
        addLog('chat', 'success', 'Intent detectado: date_time');
      }
      else if (lower.includes('o que e zram') || lower.includes('o que e o zram')) {
        addMessage({ sender: 'ai', content: 'zram é um módulo do kernel do Linux que cria um dispositivo de bloco na memória RAM onde os dados gravados são compactados dinamicamente. É muito usado no Arch Linux para aumentar a eficiência da memória RAM.' });
        addLog('chat', 'success', 'Intent detectado: explanation');
      }
      else if (lower.includes('meu pc esta lento') || lower.includes('pc lento')) {
        addMessage({ sender: 'ai', content: 'Isso pode ser causado por consumo alto de CPU ou falta de RAM. Quer que eu gere um plano para rodar `htop` ou verifique logs de sistema?' });
        addLog('chat', 'success', 'Intent detectado: diagnostic');
      }
      else if (lower.includes('arruma meu bluetooth')) {
        addMessage({ sender: 'ai', content: 'Identifiquei que você está tendo problemas com bluetooth. Vou preparar um diagnóstico seguro do sistema.' });
        addLog('chat', 'warn', 'Intent detectado: action_plan');
        requestApproval({
          id: 'diag-bt-' + Date.now(),
          summary: 'Diagnosticar Bluetooth',
          reason: 'O usuário solicitou ajuda com o bluetooth. Este script vai ler os logs e o status do serviço.',
          totalRisk: 'Seguro',
          requiresSudo: false,
          backupRequired: false,
          skillId: 'diagnose-bluetooth',
          steps: [
            { order: 1, description: 'Verificar status do serviço', command: 'systemctl', args: ['status', 'bluetooth'], riskLevel: 'Seguro', requiresSudo: false },
            { order: 2, description: 'Listar dispositivos bloqueados', command: 'rfkill', args: ['list', 'bluetooth'], riskLevel: 'Seguro', requiresSudo: false }
          ]
        });
      }
      else if (lower.includes('instala heroic')) {
        addMessage({ sender: 'ai', content: 'Entendido. Criando plano de instalação para o Heroic Games Launcher via pacman.' });
        addLog('chat', 'warn', 'Intent detectado: action_plan');
        requestApproval({
          id: 'inst-heroic-' + Date.now(),
          summary: 'Instalar Pacote: heroic',
          reason: 'O usuário pediu para instalar o heroic. Precisarei de privilégios para usar o pacman.',
          totalRisk: 'Médio',
          requiresSudo: true,
          requiresInternet: true,
          backupRequired: false,
          skillId: 'install-package',
          steps: [
            { order: 1, description: 'Sincronizar base e instalar', command: 'sudo', args: ['pacman', '-Syu', 'heroic', '--noconfirm'], riskLevel: 'Médio', requiresSudo: true }
          ]
        });
      }
      else if (lower.includes('esse modelo roda bem')) {
        addMessage({ sender: 'ai', content: `O modelo ativo no momento é o ${primaryModelId || 'Fallback Local'}. Você pode checar o painel de Modelos para ver a classificação de compatibilidade de hardware para sua RAM.` });
        addLog('chat', 'success', 'Intent detectado: model_question');
      }
      else if (lower.includes('salva essa decisao') || lower.includes('salvar memoria')) {
        addLog('chat', 'info', 'Tentando salvar memória no SQLite...');
        try {
          await invoke('create_memory', { content: 'Decisão de configuração do sistema salva via chat', tags: 'config,decisao' });
          addMessage({ sender: 'system', content: '💾 Memória salva com sucesso no banco de dados SQLite local.' });
          addLog('memory', 'success', 'Memória inserida via Chat com sucesso.');
        } catch (e) {
          addMessage({ sender: 'system', content: 'Erro ao salvar memória: ' + String(e) });
          addLog('memory', 'error', 'Falha ao salvar no SQLite: ' + String(e));
        }
      }
      else {
        addLog('chat', 'info', 'Intent detectado: unknown');
        addMessage({ sender: 'ai', content: 'Entendi o contexto. Posso te ajudar a transformar isso em uma explicação, em um diagnóstico do seu sistema Arch, ou em um plano de ação (via scripts locais). Me diga que direção você quer tomar.' });
      }
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
