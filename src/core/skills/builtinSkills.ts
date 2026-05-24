import { Skill } from './skillTypes';

export const builtinSkills: Skill[] = [
  {
    id: 'diagnose-bluetooth',
    name: 'Diagnóstico de Bluetooth',
    description: 'Lê o status do serviço bluetooth e lista os dispositivos bloqueados.',
    riskLevel: 'Seguro',
    requiresApproval: true,
    allowedCommands: ['systemctl', 'rfkill'],
    steps: [
      { order: 1, description: 'Verificar status do serviço', command: 'systemctl', args: ['status', 'bluetooth'], riskLevel: 'Seguro', requiresSudo: false },
      { order: 2, description: 'Listar dispositivos bloqueados', command: 'rfkill', args: ['list', 'bluetooth'], riskLevel: 'Seguro', requiresSudo: false }
    ]
  },
  {
    id: 'install-package',
    name: 'Instalação de Pacotes',
    description: 'Sincroniza a base de dados e instala pacotes com pacman.',
    riskLevel: 'Médio',
    requiresApproval: true,
    requiresInternet: true,
    allowedCommands: ['sudo', 'pacman'],
    steps: [] // Preenchido dinamicamente pelo action planner
  },
  {
    id: 'setup-airllm',
    name: 'Instalar Ambiente AirLLM',
    description: 'Cria venv seguro e instala pip e airllm sem poluir o sistema base.',
    riskLevel: 'Seguro',
    requiresApproval: true,
    requiresInternet: true,
    modifiesFiles: true,
    allowedCommands: ['python', 'pip', '~/.local/share/ailu/airllm-venv/bin/pip'],
    steps: [
      { order: 1, description: 'Criar diretório venv', command: 'python', args: ['-m', 'venv', '~/.local/share/ailu/airllm-venv'], riskLevel: 'Seguro', requiresSudo: false },
      { order: 2, description: 'Atualizar PIP local', command: '~/.local/share/ailu/airllm-venv/bin/pip', args: ['install', '--upgrade', 'pip'], riskLevel: 'Seguro', requiresSudo: false },
      { order: 3, description: 'Instalar AirLLM', command: '~/.local/share/ailu/airllm-venv/bin/pip', args: ['install', 'airllm'], riskLevel: 'Seguro', requiresSudo: false }
    ]
  },
  {
    id: 'setup-stt',
    name: 'Instalar Faster Whisper (STT)',
    description: 'Instala motor STT (faster-whisper) via pip user.',
    riskLevel: 'Médio',
    requiresApproval: true,
    requiresInternet: true,
    modifiesFiles: true,
    allowedCommands: ['pip'],
    steps: [
      { order: 1, description: 'Instalar faster-whisper', command: 'pip', args: ['install', '--user', 'faster-whisper'], riskLevel: 'Médio', requiresSudo: false }
    ]
  },
  {
    id: 'setup-tts',
    name: 'Instalar Piper (TTS)',
    description: 'Instala motor TTS via pacman.',
    riskLevel: 'Médio',
    requiresApproval: true,
    requiresInternet: true,
    modifiesFiles: true,
    allowedCommands: ['sudo', 'pacman'],
    steps: [
      { order: 1, description: 'Sincronizar e instalar piper', command: 'sudo', args: ['pacman', '-S', 'piper', '--noconfirm'], riskLevel: 'Médio', requiresSudo: true }
    ]
  }
];
