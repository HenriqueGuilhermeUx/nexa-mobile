# Maya × Nexa Agentics — Fase 3B (contratos de cliente; SEM execução)

Base de código: última Maya pública cumulativa Android 2.0.43/148 commit `47d09e55b3f8e4045e530402cb92c32327595031` (Fases 1, 2 e 3A já distribuídas via OTA).

## Não criar uma segunda Maya
Maya continua sendo entrada por texto/voz. A Nexa Agentics é camada opcional de orquestração, não substituição dos serviços financeiros da Nexa nem do Theo.

## Contrato preparado
`src/maya-actions/agenticsTaskContracts.ts` define tipagem dos status de tarefa, leitura ou ação não financeira autorizada, evidências HTTPS e aprovação específica. Uma resposta de tarefa é rejeitada na camada de apresentação caso falhe no usuário esperado, tipo, origem, datas, links ou escopo de autorização.

**Esta validação local não confere poderes nem executa trabalho**. Controles reais obrigatórios no servidor: autenticação de sessão, autorização por usuário/tenant, OAuth individual por conector, segregação de dados e propósito, idempotência, log imutável, cancelamento, retenção/eliminação de dados e checagem de resultados. Nenhum token ou senha de terceiros deve ser repassado ao modelo.

## Condições para a próxima OTA funcional
1. Confirmar os serviços reais da plataforma Agentics e o endereço de homologação autorizado. Não pressupor endpoint, URL, tabelas ou credenciais.
2. Definir contrato de API assinado com autenticação Nexa e resposta estruturada; endpoints de tarefas e eventos separados de pagamentos/Wallet.
3. Implementar no backend lifecycle com read-only inicial: criar pesquisa, acompanhar status, recuperar comprovantes, cancelar, com testes end-to-end.
4. UI Maya mostra claramente 'pronto para revisar', 'aguardando aprovação', 'em execução', 'concluído' ou 'falhou', e sempre distingue rascunhos de ações realizadas.
5. Rodar QA no binário Android oficial (além de export JS), verificar erros, rollback e somente então publicar OTA com as mesmas gates do runtime 2.0.43.
6. Conectores de calendário, e-mail, web e CRM: consentimento individual e revogação. Não afirmar serviços 'ativos' sem validação de tokens e permissões.
7. **Fase 4 transacional:** compras, reservas e operações financeiras só com provedores e APIs confiáveis, confirmação granular por operação, prova de execução, limites e compliance. Nunca deixar a Agentics movimentar recursos autonomamente por instrução em linguagem natural.

## Escopo desta branch
Apenas contratos e testes sem efeitos; nenhum fetch, nenhuma chamada a Agentics, nenhuma OTA e nenhum deploy de produção. Alterações da plataforma Agentics são mantidas na conversa/repositório próprios.
