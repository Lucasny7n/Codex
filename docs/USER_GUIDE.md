# User Guide

## Main layout

Ailu has three primary areas:

- Left sidebar: conversations, projects and app menu.
- Center: chat, temporary chat and composer.
- Settings and modals: model setup, health, STT and conversation management.

## Start a normal chat

1. Pick `Cloud` or `Local` from the model selector.
2. Select a ready model.
3. Type in the composer.
4. Send. Your message appears immediately, the composer clears immediately and a loading indicator appears while the provider responds.

Normal chats are persisted as sessions.

## Start a temporary chat

Use the temporary chat button in the top bar. Temporary chat uses the same real provider/model pipeline but does not create a persisted session, history entry or saved attachments.

## Attach files

Use the plus button in the composer and select a file. Ailu shows a chip for the attachment and sends safe structured context where supported.

## Local models

Local means Ollama only. Installed models appear from the real Ollama runtime. Search can show model candidates to download. Candidates are not usable until the download completes and a fresh Ollama snapshot confirms the model.

## Cloud providers

Cloud providers require credentials or login depending on the adapter. A masked saved key is not enough; run the provider test before expecting the model to be selectable.

## Voice input

Click the microphone button. Ailu tries WebView microphone capture first. If the WebView or portal denies capture, Ailu can try a short native capture fallback and transcribe with the local STT backend.

## Health

Open `Settings > Health` when something is not working. The panel uses simple labels:

- OK
- Attention
- Error

It separates provider status, Ollama runtime, STT backend and microphone capture so one broken layer does not hide another ready layer.
