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
    <div className="p-6 bg-[var(--bg-main)] h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">Integração de Voz</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#161b22] p-6 rounded-xl border border-[#30363d]">
          <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
            🎤 Microfone (STT)
          </h3>
          <p className="text-sm text-gray-400 mb-4 bg-[#0d1117] p-3 rounded-lg border border-[#30363d] flex justify-between items-center">
            Detectado pelo sistema
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${backends.has_mic ? "bg-green-900/20 text-green-400 border-green-900/50" : "bg-red-900/20 text-red-400 border-red-900/50"}`}>
              {backends.has_mic ? "Sim" : "Não encontrado"}
            </span>
          </p>
          
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Backends Instalados (Speech-to-Text)</h4>
          {backends.stt.length > 0 ? (
            <div className="flex gap-2 flex-wrap mb-6">
              {backends.stt.map(b => <span key={b} className="px-2.5 py-1 bg-blue-900/20 text-blue-400 rounded-full text-xs border border-blue-900/50 font-medium">{b}</span>)}
            </div>
          ) : (
            <p className="text-sm text-orange-400 bg-orange-900/10 p-3 rounded-lg border border-orange-900/30 mb-6">
              Nenhum backend STT real encontrado. Fallback apenas texto ativo.
            </p>
          )}

          {backends.stt.length > 0 ? (
            <button 
              disabled={!backends.has_mic}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              Ouvir Agora
            </button>
          ) : (
            <button 
              onClick={handleInstallSTT}
              className="w-full py-2.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded-lg font-medium transition-colors"
            >
              Criar Plano de Instalação (STT)
            </button>
          )}
        </div>

        <div className="bg-[#161b22] p-6 rounded-xl border border-[#30363d]">
          <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
            🔊 Alto-falante (TTS)
          </h3>
          
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Backends Instalados (Text-to-Speech)</h4>
          {backends.tts.length > 0 ? (
            <div className="flex gap-2 flex-wrap mb-6">
              {backends.tts.map(b => <span key={b} className="px-2.5 py-1 bg-green-900/20 text-green-400 rounded-full text-xs border border-green-900/50 font-medium">{b}</span>)}
            </div>
          ) : (
            <p className="text-sm text-orange-400 bg-orange-900/10 p-3 rounded-lg border border-orange-900/30 mb-6 mt-16">
              Nenhum backend TTS local encontrado. Leitura em voz alta desativada.
            </p>
          )}

          {backends.tts.length > 0 ? (
            <button 
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors mt-auto"
            >
              Testar Sintetizador
            </button>
          ) : (
            <button 
              onClick={handleInstallTTS}
              className="w-full py-2.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded-lg font-medium transition-colors mt-auto"
            >
              Criar Plano de Instalação (TTS)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
