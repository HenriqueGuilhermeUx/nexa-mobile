# Maya Actions QA A — checklist de 16 evidências físicas (modelo, não executado)

Release OTA QA A congelado: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`; runtime Android `2.0.43`; build `148`; update `01a1a975-d85f-794f-9d67-cf2ac961fbb7`.

Este checklist usa **exatamente os IDs A01–A16** aceitos por `scripts/maya-qa-a-evidence-check.cjs` e pelo registro `docs/maya-actions-qa-a-evidence-record-v148.md`. Não misturar IDs de protocolos anteriores (P01/R01) nem contar duas vezes um mesmo caso.

Preencher antes dos testes: aparelho/Android ___; pacote ___; build ___; canal EAS ___; update ID efetivamente instalado ___; SHA ___; data/hora ___; testador ___; session ID anonimizado ___.

**Separação obrigatória:** `br.com.trynexa.mayaqa` é APK standalone e deve usar `standalone_sem_ota`; `br.com.trynexa.app` deve provar instalação da OTA QA A exata. O APK não comprova a OTA. Nunca utilizar saldo ou dados de clientes.

| ID | Verificação física | Resultado | Evidência anonimizada |
| --- | --- | --- | --- |
| A01 | Criar lembrete futuro; conferir título e horário | NOT_RUN | — |
| A02 | Recusar horário passado | NOT_RUN | — |
| A03 | Permissão concedida: notificação recebida no horário | NOT_RUN | — |
| A04 | Permissão negada: aviso sem crash | NOT_RUN | — |
| A05 | Cancelar lembrete; nenhuma notificação posterior | NOT_RUN | — |
| A06 | Concluir lembrete sem duplicidade | NOT_RUN | — |
| A07 | Reiniciar app; lembretes persistem | NOT_RUN | — |
| A08 | Criar meta BRL válida e conferir progresso | NOT_RUN | — |
| A09 | Rejeitar valores vazios, negativos ou inválidos | NOT_RUN | — |
| A10 | Persistência e isolamento de metas entre duas contas de teste | NOT_RUN | — |
| A11 | Login/logout e restauração de sessão | NOT_RUN | — |
| A12 | Wallet e extrato: navegação somente leitura | NOT_RUN | — |
| A13 | Pix e QR: navegação sem pagamento | NOT_RUN | — |
| A14 | USDC: consulta sem trade/transferência | NOT_RUN | — |
| A15 | Didit/KYC: navegação sem submissão | NOT_RUN | — |
| A16 | Staff/PJ: fronteiras de acesso com perfis de teste | NOT_RUN | — |

Resultados permitidos: `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`. Cada PASS exige evidência física distinta, timestamp com fuso, e identidade de sessão/dispositivo/revisor consistente. Em FAIL/BLOCKED, registrar reprodução e issue, sem segredos, OTP, dados financeiros ou identificadores de clientes.

**Gate NO-GO:** até CI verificável do SHA, 16/16 PASS físicos, compatibilidade do binário EAS QA, regressões e aprovação explícita. O validador faz apenas preflight; não aprova release. Nenhuma OTA production ou operação financeira autorizada por este documento.

Protocolo detalhado: `docs/maya-actions-qa-a-device-protocol.md`. Registro de execução: `docs/maya-actions-qa-a-evidence-record-v148.md`.
