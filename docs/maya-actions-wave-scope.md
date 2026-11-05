# 11 — Compras assistidas em sites externos

Objetivo: montagens de carrinho e revisao de checkout com preco final e aprovacao. MVP: selecionar SKU/tamanho/cor, quantidade, validar disponibilidade, entrega, frete, impostos, cupom, devolucao; preparar carrinho. Compra somente via fluxo homologado de comerciante/PSP, autenticacao do usuario e aceite expresso sobre total congelado. Nao guardar cartao/CVV, nem permitir cliques finais sem aprovacao transacional. Criterios: receipts verificaveis, idempotencia, status incerto consulta o pedido antes de repetir, bloqueio em alteracoes de preco/endereco.

## Gate de integracao
Desenvolver ferramentas e testes isolados. Proibir publicacao de OTA direta a partir desta branch. Exigir servidor autenticado, allowlist/seguranca de sites, permissoes do usuario, logs/auditoria e PR para integration/maya-actions-v148. Ver roadmap em docs/maya-actions-release-train.md da integracao e arquitetura em docs/maya-actions-web-agent.md.

**Estado inicial**: escopo preparado; nenhum navegador autonomo ou compra/inscricao/reserva real implantado. Nao anunciar funcionalidades como disponiveis aos clientes ate backend, seguranca, QA e OTA cumulativa comprovados.
