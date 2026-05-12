# Quickstart

Rode os comandos a partir da raiz do projeto.

## 1. Instalar dependências

```bash
npm install
```

## 2. Abrir em desenvolvimento

Frontend:

```bash
npm run dev
```

App desktop:

```bash
npm run tauri dev
```

## 3. Validar ambiente

```bash
npm run healthcheck
```

## 4. Usar modelos locais

Instale e inicie Ollama fora do app. Depois valide:

```bash
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

No app, selecione `Local`, busque um modelo e baixe apenas quando confirmar a ação.

## 5. Usar modelos na nuvem

Selecione `Nuvem`, configure a API key/profile do provider e rode `Testar conexão`. Sem teste real, o provider não deve ficar pronto.

## 6. Rodar validação

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run icons:validate
git diff --check
cd src-tauri
cargo fmt --check
cargo check
cargo test
```
