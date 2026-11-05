# 12 — Reservas e servicos online

Objetivo: pesquisar agendas e disponibilidades, comparar cancelamento, prazo, taxas e preparar reservas. MVP: resultados de provedores em tempo real, selecao e revisao de local/data/horario/pessoas/valor/condicoes, conferencia de disponibilidade e comprovante. Nao inventar horarios, estoque ou confirmacao. Contratacoes irreversiveis e reservas pagas exigem aceite especifico. Criterios: nao duplicar reservas, condicoes visiveis, acompanhar protocolo e permitir handoff humano quando provedor bloquear automacao.

## Gate de integracao
Desenvolver ferramentas e testes isolados. Proibir publicacao de OTA direta a partir desta branch. Exigir servidor autenticado, allowlist/seguranca de sites, permissoes do usuario, logs/auditoria e PR para integration/maya-actions-v148. Ver roadmap em docs/maya-actions-release-train.md da integracao e arquitetura em docs/maya-actions-web-agent.md.

**Estado inicial**: escopo preparado; nenhum navegador autonomo ou compra/inscricao/reserva real implantado. Nao anunciar funcionalidades como disponiveis aos clientes ate backend, seguranca, QA e OTA cumulativa comprovados.
