# 10 — Inscrições e formulários

Objetivo: preencher cadastros, inscricoes e solicitacoes web com revisao humana. MVP: extrair campos, mapear informacoes autorizadas, identificar dados ausentes, preparar formulario e mostrar previsualizacao completa. Submissao somente apos aprovar destino, termos e campos; guardar protocolo e evidencias. Captcha, MFA, assinatura, declaracoes pessoais, documento e credenciais permanecem sob controle do usuario. Criterios: logs redigidos, consentimento por site, nenhuma senha/OTP armazenada, a Maya nunca declara dados nao verificados.

## Gate de integracao
Desenvolver ferramentas e testes isolados. Proibir publicacao de OTA direta a partir desta branch. Exigir servidor autenticado, allowlist/seguranca de sites, permissoes do usuario, logs/auditoria e PR para integration/maya-actions-v148. Ver roadmap em docs/maya-actions-release-train.md da integracao e arquitetura em docs/maya-actions-web-agent.md.

**Estado inicial**: escopo preparado; nenhum navegador autonomo ou compra/inscricao/reserva real implantado. Nao anunciar funcionalidades como disponiveis aos clientes ate backend, seguranca, QA e OTA cumulativa comprovados.
