# Maya Actions QA A — checkpoint de evidencias e CI (2026-11-16)

Escopo: somente QA A, ondas 01/02. Este checkpoint nao constitui aprovacao de release nem evidencia fisica.

## Referencias verificadas
- Integracao: `integration/maya-actions-v148` em `19725132972c8dc943d90a51b60a35e251934081`.
- Candidato QA A imutavel: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`; runtime `2.0.43`; branch EAS `maya-actions-v148-qa`; Android update `01a1a975-d85f-794f-9d67-cf2ac961fbb7`.
- Branch de evidencias QA diverge da integracao: 174 ahead / 17 behind na consulta de 16/11. Nao fazer merge integral.
- Commit de testes consultado: `4932cecccf2b11915275b16981c704d40e2a4e25`. Status combinado `statuses=[]`; workflow runs associados `workflow_runs=[]`. A consulta de runs do conector filtra PRs e apenas primeira pagina; **vazio nao prova ausencia global de CI**, nem sucesso.
- Workflow presente na branch QA: `.github/workflows/maya-actions-wave-a-evidence-ci.yml`, com push nessa branch, PR para integracao e disparo manual. Sua presenca nao comprova execucao.
- Issue #157 relata OTA canary 10% em production de 15/11, update `01a1e138-3ac9-76e4-bbd7-be068a9c39da`, fonte `cac9ea18a995f5d63c434ed92d07096ca77f2378`. Nao confundir com a QA A congelada nem assumir rollout ainda ativo; verificar EAS e telemetria antes de qualquer decisao.

## Checklist para desbloquear (sem operar producao)
1. Abrir Actions do repositorio e localizar execucao do workflow QA A no SHA exato; registrar URL, conclusao, jobs e artefatos. Se inexistente, investigar permissao/configuracao e disparar somente em QA com autorizacao e rastreabilidade.
2. Executar offline em Node 20: `node --test scripts/qa/maya-actions-wave-a-evidence-gate.test.js scripts/qa/maya-actions-wave-a-cli-failclosed.test.js scripts/qa/maya-actions-wave-a-cardinality.test.js`. Registrar comando, versao Node, resultado e SHA. Testes sinteticos nao sao prova fisica.
3. Coletar em dispositivo compativel A01-A16 com referencias unicas, timestamp, dispositivo e identidade EAS exata, sem credenciais ou dados de clientes; executar o gate sobre manifesto privado/redigido. Nao comitar evidencias sensiveis.
4. Confirmar regressao login/Didit/Wallet/Pix/USDC/Staff e identidade do binario Play sem transacoes reais; consultar telemetria e estado atual do canary separadamente.
5. Apenas com CI + QA fisico + compatibilidade + aprovacao explicita considerar integracao seletiva de commits aprovados. Production permanece NO-GO para esta branch.

## Estado das ondas
01/02: QA fisico A01-A16 pendente; 03/04: integradas historicamente, sem novo aceite; 09: backend de cotacoes reais nao homologado; 10: revisao sem submissao; 05-08/11-12: sem liberacao nova. Nenhum envio externo, reserva, compra ou pagamento autorizado por este documento.

## Verificacao adicional de CI — 2026-11-16
- Consulta direta da colecao GitHub Actions filtrada por `head_branch=qa/maya-actions-wave-a-evidence-20261111` identificou execucoes reais que nao apareciam na consulta limitada a PRs. Corrige a incerteza de CI acima, sem alterar o historico daquela consulta.
- SHA `af39d7ee8f1b6de0b257fd2a55cb3008612b2e15`: workflow QA A offline **success**, run https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/43951749774.
- SHA `7099b1f6d011030ac50f66be4d0863c626cc8d2f`: **success**, run https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/43951733060.
- SHA `b1fdee763f1e44e83173cc18d6fd46955c0479fd`: **success**, run https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/43942334296.
- SHA `37bca614b50180264dc0c73810d92d161682006f`: **success**, run https://github.com/HenriqueGuilhermeUx/nexa-mobile/actions/runs/43921057958.
- Integracao permanece no SHA `19725132972c8dc943d90a51b60a35e251934081`; comparacao atual: branch QA 180 ahead / 17 behind. Nao promover a branch integralmente.
- **Limite da prova:** resultados sao exclusivamente do workflow sintetico/offline; A01-A16 fisicos, regressao em dispositivo, telemetria, EAS production e backend real da onda 09 continuam sem aprovacao comprovada. Nenhum merge ou OTA autorizado.
