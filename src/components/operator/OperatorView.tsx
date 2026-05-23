import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';

export function OperatorView() {
  const [input, setInput] = useState('');
  const { messages, addMessage } = useChatStore();

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage({ sender: 'user', content: input });
    setInput('');
    
    // Fake response for MVP testing
    setTimeout(() => {
      addMessage({ sender: 'ai', content: 'Entendido. Esta é uma resposta simulada do Ailu até o backend real ser conectado.' });
    }, 500);
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
