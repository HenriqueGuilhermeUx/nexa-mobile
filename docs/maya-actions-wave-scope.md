# 09 — Pesquisa de preços e cotações

Objetivo: de pedido do usuario a um comparativo sustentado por URLs verificadas, estoque, variacao, prazo, frete e impostos. MVP: pesquisa somente leitura e criacao de lista de opcoes com fonte, preco total, moeda, disponibilidade, timestamp e incertezas. Evitar paginas com preco desatualizado e nao simular confirmacao de estoque. O backend precisa de provedores de pesquisa/comparacao ou navegador remoto isolado; app somente renderiza resultados recebidos. Criterios: fontes auditaveis, rejeicao de URLs inseguras, nunca enviar formularios, se passar de 24 horas atualizar precos antes de decidir.

## Gate de integracao
Desenvolver ferramentas e testes isolados. Proibir publicacao de OTA direta a partir desta branch. Exigir servidor autenticado, allowlist/seguranca de sites, permissoes do usuario, logs/auditoria e PR para integration/maya-actions-v148. Ver roadmap em docs/maya-actions-release-train.md da integracao e arquitetura em docs/maya-actions-web-agent.md.

**Estado inicial**: escopo preparado; nenhum navegador autonomo ou compra/inscricao/reserva real implantado. Nao anunciar funcionalidades como disponiveis aos clientes ate backend, seguranca, QA e OTA cumulativa comprovados.
