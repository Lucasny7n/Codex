import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VoiceBackends {
  stt: string[];
  tts: string[];
  has_mic: boolean;
}

export function VoicePanel() {
  const [backends, setBackends] = useState<VoiceBackends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<VoiceBackends>('detect_voice_backends')
      .then(setBackends)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-400">Analisando sistema de áudio...</div>;
  if (!backends) return <div className="p-6 text-red-400">Falha ao detectar backends de voz.</div>;

  return (
    <div className="p-6 bg-[var(--bg-main)] h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">Integração de Voz</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-panel)] p-6 rounded-xl border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            🎤 Microfone (STT)
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Detectado pelo sistema: <span className={backends.has_mic ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{backends.has_mic ? "Sim" : "Não encontrado"}</span>
          </p>
          
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Backends Instalados (Speech-to-Text)</h4>
          {backends.stt.length > 0 ? (
            <div className="flex gap-2 flex-wrap mb-4">
              {backends.stt.map(b => <span key={b} className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs border border-blue-900/50">{b}</span>)}
            </div>
          ) : (
            <p className="text-sm text-orange-400 bg-orange-900/20 p-3 rounded border border-orange-900/30 mb-4">
              Nenhum backend STT real encontrado. Fallback apenas texto.
            </p>
          )}

          <button 
            disabled={!backends.has_mic || backends.stt.length === 0}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            {backends.stt.length > 0 ? "Ouvir Agora" : "Requer Backend STT"}
          </button>
        </div>

        <div className="bg-[var(--bg-panel)] p-6 rounded-xl border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            🔊 Alto-falante (TTS)
          </h3>
          
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Backends Instalados (Text-to-Speech)</h4>
          {backends.tts.length > 0 ? (
            <div className="flex gap-2 flex-wrap mb-4">
              {backends.tts.map(b => <span key={b} className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs border border-green-900/50">{b}</span>)}
            </div>
          ) : (
            <p className="text-sm text-orange-400 bg-orange-900/20 p-3 rounded border border-orange-900/30 mb-4">
              Nenhum backend TTS local encontrado. Fallback: Leitura desativada.
            </p>
          )}

          <button 
            disabled={backends.tts.length === 0}
            className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            {backends.tts.length > 0 ? "Testar Sintetizador" : "Requer Backend TTS"}
          </button>
        </div>
      </div>
    </div>
  );
}
