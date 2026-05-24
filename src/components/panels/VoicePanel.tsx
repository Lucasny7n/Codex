import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VoiceBackends {
  stt: string[];
  tts: string[];
  has_mic: boolean;
}

import { useApprovalStore } from '../../stores/approvalStore';

export function VoicePanel() {
  const [backends, setBackends] = useState<VoiceBackends | null>(null);
  const [loading, setLoading] = useState(true);
  const { requestApproval } = useApprovalStore();

  useEffect(() => {
    invoke<VoiceBackends>('detect_voice_backends')
      .then(setBackends)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleInstallSTT = () => {
    requestApproval({
      id: `install-stt-${Date.now()}`,
      summary: 'Instalar Backend de Voz (STT)',
      reason: 'Para reconhecer sua voz localmente com privacidade, instalaremos o faster-whisper e suas dependências via pip.',
      totalRisk: 'Médio',
      requiresSudo: false,
      requiresInternet: true,
      backupRequired: false,
      skillId: 'install-stt',
      steps: [
        { order: 1, description: 'Instalar faster-whisper', command: 'pip', args: ['install', '--user', 'faster-whisper'], riskLevel: 'Médio', requiresSudo: false }
      ]
    });
  };

  const handleInstallTTS = () => {
    requestApproval({
      id: `install-tts-${Date.now()}`,
      summary: 'Instalar Sintetizador de Voz (TTS)',
      reason: 'Para o Ailu falar nativamente, instalaremos o piper-tts usando o pacman.',
      totalRisk: 'Médio',
      requiresSudo: true,
      requiresInternet: true,
      backupRequired: false,
      skillId: 'install-tts',
      steps: [
        { order: 1, description: 'Sincronizar e instalar piper', command: 'sudo', args: ['pacman', '-S', 'piper', '--noconfirm'], riskLevel: 'Médio', requiresSudo: true }
      ]
    });
  };

  if (loading) return <div className="p-6 text-gray-400">Analisando sistema de áudio...</div>;
  if (!backends) return <div className="p-6 text-red-400">Falha ao detectar backends de voz.</div>;

  return (
    <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--bg-main)', height: '100%', overflowY: 'auto' }}>
      <h2 className="app-section-title">Integração de Voz</h2>
      
      <div className="app-card-grid">
        <div className="app-panel">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            🎤 Microfone (STT)
          </h3>
          <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-input)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Detectado pelo sistema
            <span className={`app-badge ${backends.has_mic ? "app-badge-success" : "app-badge-danger"}`}>
              {backends.has_mic ? "Sim" : "Não encontrado"}
            </span>
          </p>
          
          <h4 style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Backends Instalados (Speech-to-Text)</h4>
          {backends.stt.length > 0 ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
              {backends.stt.map(b => <span key={b} className="app-badge app-badge-info">{b}</span>)}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234, 179, 8, 0.3)', marginBottom: 'var(--space-6)' }}>
              Nenhum backend STT real encontrado. Fallback apenas texto ativo.
            </p>
          )}

          {backends.stt.length > 0 ? (
            <button 
              disabled={!backends.has_mic}
              className="app-button app-button-primary" style={{ width: '100%' }}
            >
              Ouvir Agora
            </button>
          ) : (
            <button 
              onClick={handleInstallSTT}
              className="app-button app-button-secondary" style={{ width: '100%' }}
            >
              Criar Plano de Instalação (STT)
            </button>
          )}
        </div>

        <div className="app-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            🔊 Alto-falante (TTS)
          </h3>
          
          <h4 style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Backends Instalados (Text-to-Speech)</h4>
          {backends.tts.length > 0 ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
              {backends.tts.map(b => <span key={b} className="app-badge app-badge-success">{b}</span>)}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234, 179, 8, 0.3)', marginBottom: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
              Nenhum backend TTS local encontrado. Leitura em voz alta desativada.
            </p>
          )}

          {backends.tts.length > 0 ? (
            <button 
              className="app-button app-button-primary" style={{ width: '100%', marginTop: 'auto' }}
            >
              Testar Sintetizador
            </button>
          ) : (
            <button 
              onClick={handleInstallTTS}
              className="app-button app-button-secondary" style={{ width: '100%', marginTop: 'auto' }}
            >
              Criar Plano de Instalação (TTS)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
