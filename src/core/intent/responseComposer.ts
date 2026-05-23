import { IntentResult } from './intentTypes';

export function composeResponse(intent: IntentResult, context?: Record<string, unknown>): string {
  switch (intent.type) {
    case 'conversation':
      if (intent.normalizedText.includes('tudo bem')) {
        return 'Tudo ótimo, operando 100% local no seu Arch Linux. O que vamos construir hoje?';
      }
      return 'Olá! Sou o Ailu, seu Operador Local. Como posso ajudar com diagnósticos, execução de scripts ou testes hoje?';
      
    case 'date_time': {
      const date = new Date().toLocaleString('pt-BR');
      if (intent.normalizedText.includes('so me diga')) {
        return date;
      }
      return `Hoje é ${date}.`;
    }

    case 'explanation':
      if (intent.entities?.topic === 'zram') {
        return 'zram é um módulo do kernel do Linux que cria um dispositivo de bloco na memória RAM onde os dados gravados são compactados dinamicamente. É muito usado no Arch Linux para aumentar a eficiência da memória RAM.';
      }
      return 'Posso buscar essa explicação no conhecimento local. Sobre o que exatamente você quer saber?';

    case 'diagnostic':
      return 'Isso pode ser causado por consumo alto de CPU ou falta de RAM. Quer que eu gere um plano para rodar `htop` ou verifique logs de sistema?';

    case 'model_question':
      return `O modelo ativo no momento é o ${context?.primaryModelId || 'Fallback Local'}. Você pode checar o painel de Modelos para ver a classificação de compatibilidade de hardware para sua RAM.`;

    case 'unknown':
    default:
      return 'Entendi o contexto. Posso te ajudar a transformar isso em uma explicação, em um diagnóstico do seu sistema Arch, ou em um plano de ação (via scripts locais). Me diga que direção você quer tomar.';
  }
}
