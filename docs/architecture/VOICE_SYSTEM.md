# Sistema de Voz Local

A integração de voz será 100% offline nativamente, usando binários ou bibliotecas empacotadas/baixadas sem telemetria.

## Speech-to-Text (STT)
A prioridade primária de backend é **faster-whisper**.
- Funciona via Sidecar Python ou binário standalone.
- Requer modelo base/small para transcrição em tempo real no Português.

## Text-to-Speech (TTS)
A prioridade é o **Piper**.
- Modelos `.onnx` leves.
- Vozes abertas pré-processadas.
- Rápida geração de som na RAM com delay abaixo de 300ms.

## Estados da UI
A interface receberá sinais do Rust `voiceStore.ts` com os seguintes estados:
- `Inativo`
- `Ouvindo` (Mostra visualizer na UI)
- `Detectando silêncio`
- `Transcrevendo`
- `Pensando` (Integra com a IA gerando resposta)
- `Falando`

## Fallback
Se os backends não puderem ser inicializados (ex: sem driver ALSA/Pipewire ou sem disco para download), o sistema usará a *Web Speech API* do Browser apenas com um alerta vermelho avisando sobre a nuvem e as limitações.
