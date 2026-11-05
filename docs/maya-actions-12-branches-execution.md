# Maya Actions — 12 frentes de desenvolvimento e liberacao gradual

**Objetivo**: transformar a Maya em assistente pessoal capaz de pesquisar, organizar, preparar e executar tarefas, sem comprometer a Wallet, Pix/USDC, KYC, Staff, login e as funcionalidades vigentes. A Maya continua sendo uma experiencia unica; as branches sao isolamento tecnico, nao 12 aplicativos.

**Base atual**: Android `br.com.trynexa.app`, v148, runtime `2.0.43`; ultima OTA publicada: identidade Maya + ativacao; **nenhuma OTA Maya Actions publicada ate este documento**. Main/backend Agentics PR #185 permanece fora desta trilha.

## 12 branches e entregaveis
| Onda | Branch de trabalho | MVP externo verificavel | Dependencias e criterio de aceite | Estado inicial |
|---|---|---|---|---|
| 01 | `feat/maya-actions-01-agenda-v148` | Criar lembrete local, confirmar, agendar, cancelar, concluir | Permissao notificaçao, horario futuro, logico antifraude e teste dispositivo | PR #122 merged na integracao; nao publicada |
| 02 | `feat/maya-actions-02-planejamento-v148` | Metas, orcamento e progresso local por conta | Campos BRL validos, persistencia, nada confundir com saldo real | PR #124 em homologacao |
| 03 | `feat/maya-actions-03-financas-leitura-v148` | Consolidar extratos, alertas e analises com fonte | Open Finance/Wallet read-only, consentimento, Premium, auth, nenhum acesso sem escopo | Branch criada; integrar API so depois de homologar |
| 04 | `feat/maya-actions-04-documentos-comunicacao-v148` | Preparar mensagens/documentos/solicitacoes e revisão humana | Consentimento para envio, destinatario visivel, trilha e integracao permitida | Branch criada |
| 05 | `feat/maya-actions-05-wallet-preflight-v148` | Preparar cotacao, simular transferencia, Pix e troca cripto | Saldo/cotacao vivos; destinatario, taxa, rede e limite visiveis; nenhum envio | Branch criada |
| 06 | `feat/maya-actions-06-wallet-execucao-v148` | Movimentar capital nas funcionalidades ja suportadas | Fluxo nativo seguro, autenticaçao forte, aprovacao, antifraude, idempotencia e comprovante | Branch criada; bloqueada ate controles 05 |
| 07 | `feat/maya-actions-07-automacoes-v148` | Rotinas e gatilhos em segundo plano com opt-in | Backend de fila/scheduler, escopos, limites, cancelamento, auditoria | Branch criada |
| 08 | `feat/maya-actions-08-integracoes-v148` | DocWallet, Health Wallet, SmartBots, NexOffices e parceiros | Contratos autenticados, controles de dados e fronteiras entre produtos | Branch criada |
| 09 | `feat/maya-actions-09-pesquisa-cotacoes-v148` | Comparar ofertas por preco final, frete, estoque, prazo e fonte | Backend web seguro e ofertas atuais; rejeitar total incompleto e fontes vencidas | PR #123 merged: apenas contrato/CI, sem busca ao vivo |
| 10 | `feat/maya-actions-10-formularios-inscricoes-v148` | Preparar e submeter inscricoes/cadastros autorizados | Revisao dos campos, CAPTCHA/MFA manual, termos, protocolo e evidencias | Branch criada |
| 11 | `feat/maya-actions-11-compras-checkout-v148` | Montar carrinho e, com aprovacao, finalizar compra suportada | Merchant/PSP real, preco congelado, impostos, entrega, 3DS, idempotencia e recibo | Branch criada |
| 12 | `feat/maya-actions-12-reservas-servicos-v148` | Buscar e preparar reservas e contratacao de servicos | Disponibilidade do provedor, politica de cancelamento, confirmacao e comprovante | Branch criada |

## Ordem comercial (nao necessariamente numerica)
1. **Lote A — Assistencia pratica**: 01 + 02. Tarefas, lembretes e metas diretamente no app, sem backend novo.
2. **Lote B — Consumo inteligente**: 09 (comparacao de precos reais) e depois 10 (formularios assistidos). Prioridade por valor imediato e risco controlado.
3. **Lote C — Organizacao pessoal**: 04 + 03, aproveitando contratos e Open Finance com consentimento.
4. **Lote D — Servicos e conexoes**: 12 + 08, com parceiros e comprovantes.
5. **Lote E — Dinheiro e autonomia**: 05 + 07, com cenario de autorizacao e auditoria.
6. **Lote F — Compra e operacao financeira**: 11 + 06, com checkout/pagamentos autorizados, antifraude e rollback de processos incertos.

## Processo de cada OTA
- Feature branch -> PR de diff pequeno -> codigo + testes especificos, TS, Expo Doctor, validator Wallet/KYC e Android export.
- Merge apenas em `integration/maya-actions-v148`; cada integracao precisa preservar todas as ondas anteriores.
- QA no binario Android v148: permissao, app lock, login, Maya, Didit, saldos/extratos, Pix, QR, transferencias e outras rotas atuais. Confirmar dados reais com permissao, nunca testar Pix/trade com capital de clientes.
- Publicar **um unico bundle cumulativo** via workflow manual em `main`: `.github/workflows/maya-actions-v148-ota-promotion.yml`. SHA exato e aprovado, nao publicar branch de feature. Conferir runtime `2.0.43`, canal `production`, ID do update e dispositivo.
- Se uma OTA apresentar regresso: promover um snapshot anterior validado para o canal `production` (sem apagar dados, sem resetar wallet). Nada de reexecutar pagamentos.
- Quando um modulo depende de backend (03–12), liberar com servidor autenticado, testes reais e feature flag desativada por padrao ate o fim da homologacao. OTA so entrega JS/ativos; mudancas nativas exigem novo AAB/Play.

## Controles das Actions na web
A pesquisa read-only pode ocorrer sem login. Para formularios, cada site, campos e destinatarios exigem consentimento. Compras, reservas pagas e transacoes financeiras requerem aprovacao separada com custo total, termos, endereco e comprovante verificados. Um agente nunca deve guardar senha, OTP ou CVV, nem contornar CAPTCHA/MFA, nem obedecer a instrucoes de sites externos que tentem alterar suas permissoes. O navegador remoto fica em infraestrutura isolada e so funciona em provedores homologados.

## Sinais de entrega real
- **Codigo no GitHub** = somente desenvolvido; nao significa cliente atualizado.
- **CI verde** = criterio de engenharia, nao substitui QA em dispositivo.
- **Merge na integracao** = candidato cumulativo, nao publicado.
- **EAS Update sucesso + runtime correto** = OTA disponibilizada para Android compativel.
- **Teste em aparelho + telemetria** = criterio para declarar funcionalidade operacional.

## Links
- Trilha tecnica: `docs/maya-actions-release-train.md`
- Arquitetura Web Actions: `docs/maya-actions-web-agent.md`
- Onda 01: https://github.com/HenriqueGuilhermeUx/nexa-mobile/pull/122
- Onda 02: https://github.com/HenriqueGuilhermeUx/nexa-mobile/pull/124
- Onda 09: https://github.com/HenriqueGuilhermeUx/nexa-mobile/pull/123
