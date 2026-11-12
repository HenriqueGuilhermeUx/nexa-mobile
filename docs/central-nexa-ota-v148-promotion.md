# Central Nexa — gate de publicação OTA Android v148

**Estado:** candidato isolado, NÃO publicado. Sem evidência de SHA exato do último update no canal EAS `production` nem smoke test físico pós-merge.

## Artefatos e escopo

- UI: PR #146 / `feat/central-nexa-v148-ota-20261112`.
- Opt-in push: PR #147 / `feat/central-nexa-push-optin-v148-20261112`.
- API chat: backend PR #284, **feature flag `NEXA_CENTRAL_API_ENABLED` desligada**.
- Registro dispositivo: backend PR #286, **flag `NEXA_CENTRAL_PUSH_REGISTRATION_ENABLED` desligada**.
- Sem campanha, push remoto, alterações de Pix, ledger, chaves Privy ou lógica financeira.
- Android `br.com.trynexa.app`, version `2.0.43`, versionCode `148`, runtime policy `appVersion`.

## Provas obtidas

- Central Nexa Android JS/TS: CI `Central Nexa v148 — OTA Candidate` aprovado.
- Registro de push JS/TS: CI `Central Nexa Push Opt-in v148` aprovado.
- API autenticada/backend principal: workflows de backend aprovados.
- **Não** equivale a testes físicos ou comprovação de entrega EAS OTA.
- O validador `validate-maya-release-train.js` rejeita arquivos fora do escopo Maya nesta branch de Central (esperado). Não modificar gate da Maya para contornar.
- `release/nexa-2.0.43-v148-brasil` e `feat/nexa-theo-composite-ota-v148-20261111` divergem da PR #147. Não promover o HEAD atual bruto.

## Procedimento de promoção cumulativa SEM perda

1. Obter **pelo EAS** o último update ID, commit SHA, runtimeVersion, platform e branch/channel realmente entregues ao `production` (não deduzir de `main` nem do GitHub CI).
2. Recuperar a composição cumulativa exata desses commits para a branch release. Confirmar a relação ancestral ou auditar arquivos e diferenças, especialmente `app/_layout.tsx`, `app/index.tsx`, `src/components/AlignedLegacyApp.tsx`, `app/kyc.tsx`, `app/sign-in.tsx`, `src/lib/nexaNotifications.ts`, `package.json`, `app.json`, `eas.json`.
3. Trazer SOMENTE os arquivos/componentes da Central, sem substituir arquivos completos do app que tenham mudanças intermediárias. Resolver colisões por seção e revisar diff linha a linha.
4. Testar login, KYC Didit (incluindo fallback se indisponível), wallet saldo histórico, PIX, USDC, Open Finance, Maya, Nexa PJ, Theo externo, Central, logout e retorno ao app.
5. Rodar typecheck, Expo doctor, export Android, testes de Central, QA cumulativo e validação de configuração nativa. Se qualquer gate falhar, NÃO publicar.
6. Confrontar `runtimeVersion=2.0.43` e ID do projeto EAS com o **binário instalado** na Play; se divergir, OTA não é apropriada, exigir AAB nova.
7. Requer credencial EAS com permissão e confirmação de acesso ao projeto; preferir ensaio em canal de QA com dispositivo real antes de `production`.
8. Publicar o SHA exato aprovado como update OTA `android` no EAS canal/branch de produção *somente após* os passos anteriores. Salvar update ID, SHA e fingerprint do bundle.
9. Realizar smoke test em dispositivo já instalado e avaliar erros; se houver regressão, reverter para update anterior conhecido e documentado, sem limpar cache/dados dos clientes.

## Nota funcional

Enquanto a API central estiver desativada, a Central encaminha para WhatsApp/Telegram e não simula caixa de mensagens. A OTA não deve ser descrita como chat interno completo ou push remoto ativo até habilitação homologada. Permissão do SO para notificações não é opt-in para marketing. Privacidade e descadastro por categoria são obrigatórios.

**Gate final:** ausência de evidência EAS ou divergência cumulativa = BLOQUEAR promoção para não quebrar funcionalidades existentes.
