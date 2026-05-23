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
      const lower = text.toLowerCase();
      
      const isConversational = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem?', 'tudo bem', 'obrigado', 'obrigada', 'valeu', 'quem é você?', 'o que você faz?'].some(word => lower === word || lower.startsWith(word));

      if (isConversational) {
        addMessage({ sender: 'ai', content: 'Olá! Sou o Ailu, seu Operador Local. Estou focado em manter seu sistema Arch Linux funcionando de forma eficiente e segura. Como posso ajudar com diagnósticos, execução de scripts ou IA hoje?' });
        addLog('chat', 'success', 'Intent detectado: Conversação');
      } 
      else if (lower.includes('o que é zram?')) {
        addMessage({ sender: 'ai', content: 'zram é um módulo do kernel do Linux que cria um dispositivo de bloco na memória RAM onde os dados gravados são compactados dinamicamente. É muito usado no Arch Linux e no Fedora para aumentar a eficiência da memória RAM sem precisar usar swap em disco.' });
        addLog('chat', 'success', 'Intent detectado: Explicação técnica');
      }
      else if (lower.includes('arruma meu bluetooth')) {
        addMessage({ sender: 'ai', content: 'Identifiquei que você está tendo problemas com bluetooth. Vou preparar um diagnóstico seguro do sistema.' });
        addLog('chat', 'warn', 'Intent detectado: Ação/Diagnóstico (Bluetooth)');
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
        addLog('chat', 'warn', 'Intent detectado: Ação/Instalação (Heroic)');
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
      else if (lower.includes('esse modelo roda bem?')) {
        addMessage({ sender: 'ai', content: `O modelo ativo no momento é o ${primaryModelId || 'Fallback Local'}. Você pode checar o painel de Modelos para ver a classificação de compatibilidade de hardware para sua RAM.` });
        addLog('chat', 'success', 'Intent detectado: Dúvida sobre IA');
      }
      else if (lower.includes('salva essa decisão')) {
        addLog('chat', 'info', 'Tentando salvar memória no SQLite...');
        try {
          await invoke('create_memory', { content: 'Decisão de configuração do sistema salva via chat', tags: 'config,decisão' });
          addMessage({ sender: 'system', content: '💾 Memória salva com sucesso no banco de dados SQLite local.' });
          addLog('memory', 'success', 'Memória inserida via Chat com sucesso.');
        } catch (e) {
          addMessage({ sender: 'system', content: 'Erro ao salvar memória: ' + String(e) });
          addLog('memory', 'error', 'Falha ao salvar no SQLite: ' + String(e));
        }
      }
      else {
        addLog('chat', 'info', 'Fallback conversacional para texto não reconhecido ativado.');
        addMessage({ sender: 'ai', content: 'Entendi o contexto. Posso te ajudar a transformar isso em uma explicação, em um diagnóstico do seu sistema Arch, ou em um plano de ação (via scripts locais). Me diga que direção você quer tomar.' });
      }
    }, 400);
  };

  return (
    <div className="operator-view">
      <div className="chat-history">
        {messages.map(msg => (
          <div key={msg.id} className="chat-message" style={msg.sender === 'user' ? { alignSelf: 'flex-end', backgroundColor: 'var(--bg-input)' } : {}}>
            <div className="chat-message-sender" style={msg.sender === 'user' ? { color: 'var(--text-main)' } : {}}>
              {msg.sender === 'user' ? 'Você' : msg.sender === 'system' ? 'Sistema' : 'Ailu'}
            </div>
            <div className="chat-message-content">{msg.content}</div>
          </div>
        ))}
      </div>
      
      <div className="chat-input-area">
        <div className="chat-input-container">
          <button className="btn-icon">🎙️</button>
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
            className="chat-textarea"
            rows={2}
          />
          <button className="btn-primary" onClick={handleSend}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
