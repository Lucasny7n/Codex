# Contribuição

Contribuições devem preservar a regra central do projeto: funcionalidade real antes de aparência e nenhum status pronto sem validação.

## Fluxo recomendado

1. Abra uma issue ou descreva claramente o objetivo.
2. Rode `git status` e trabalhe em branch pequena.
3. Faça mudanças por domínio.
4. Atualize testes e docs quando o comportamento mudar.
5. Rode a validação antes do PR.

## Estilo de commit

Use Conventional Commits:

```text
feat: add provider profile validation
fix: keep temporary chat out of persisted sessions
docs: clarify ollama setup
chore: reorganize repository structure
```

## Validação mínima

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

Rode `npm run screenshots` e `npm run test:visual` para mudanças de UI.

## Padrão visual

- Base escura e contraste alto.
- Acento azul consistente.
- Ações secundárias atrás de menu quando apropriado.
- Sem cards aninhados desnecessários.
- Sem texto técnico bruto na superfície principal.
- Estados de hover/focus acessíveis e discretos.

## Regras funcionais

- Provider cloud sem credencial ou login não é selecionável.
- Credencial salva sem teste não é `ready`.
- Local significa Ollama real.
- Modelo não instalado é candidato para baixar, não modelo pronto.
- Chat temporário usa provider real e não persiste.
- STT depende de permissão, captura e backend local.

## PR

Inclua no PR:

- Resumo.
- Arquivos principais alterados.
- Evidência de validação.
- Screenshots quando houver UI.
- Riscos e rollback.
