import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useApprovalStore } from '../../stores/approvalStore';
import { useModelStore } from '../../stores/modelStore';
import { invoke } from '@tauri-apps/api/core';

export function OperatorView() {
  const [input, setInput] = useState('');
  const { messages, addMessage } = useChatStore();

  const { requestApproval } = useApprovalStore();
  const { primaryModelId } = useModelStore();

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    addMessage({ sender: 'user', content: text });
    setInput('');
    
    setTimeout(async () => {
      const lower = text.toLowerCase();
      
      if (lower === 'oi') {
        addMessage({ sender: 'ai', content: 'Olá! Sou o Ailu, seu assistente operacional local. Como posso ajudar com seu sistema hoje?' });
      } 
      else if (lower.includes('o que é zram?')) {
        addMessage({ sender: 'ai', content: 'zram é um módulo do kernel do Linux que cria um dispositivo de bloco na memória RAM onde os dados gravados são compactados dinamicamente. É muito usado no Arch Linux e no Fedora para aumentar a eficiência da memória RAM sem precisar usar swap em disco.' });
      }
      else if (lower.includes('arruma meu bluetooth')) {
        addMessage({ sender: 'ai', content: 'Identifiquei que você está tendo problemas com bluetooth. Vou executar um diagnóstico seguro.' });
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
        addMessage({ sender: 'ai', content: `O modelo ativo no momento é o ${primaryModelId}. Você pode checar o painel de Modelos para ver a classificação exata para a sua RAM livre calculada pelo módulo de Hardware Rust.` });
      }
      else if (lower.includes('salva essa decisão')) {
        try {
          await invoke('create_memory', { content: 'Decisão de configuração do sistema', tags: 'config,decisão' });
          addMessage({ sender: 'system', content: '💾 Memória salva com sucesso no banco de dados SQLite local.' });
        } catch (e) {
          addMessage({ sender: 'system', content: 'Erro ao salvar memória: ' + String(e) });
        }
      }
      else {
        addMessage({ sender: 'ai', content: 'Comando não reconhecido por intent (MVP). Tente: "oi", "arruma meu bluetooth", "instala heroic" ou "salva essa decisão".' });
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
