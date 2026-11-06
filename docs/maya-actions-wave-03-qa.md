# Maya Actions — onda 03: leitura da atividade Nexa

Esta etapa entrega **consulta de registros da própria Nexa**, sem conexão com bancos externos. Não é o Open Finance Premium: esse módulo só poderá ser ativado depois de consentimento explícito e contrato homologado.

## Como testar
- Android v148: iniciar sessão de teste, abrir Maya → Actions → **Consultar minhas movimentações**.
- Confirmar que **nenhuma** leitura de extrato acontece até tocar em **Consultar minha atividade Nexa**; a primeira chamada ao servidor é apenas a verificação de autenticação.
- Após o toque, confirmar que três APIs já existentes são consultadas com token da conta: `/fiat-deposit/list`, `/payment/user`, `/direct-settlement/orders`.
- Testar conta com respostas vazias e outra com histórico; a tela informa **quantidade de itens retornados**, não volume financeiro nem saldo.
- Derrubar uma das APIs: as outras fontes continuam apresentadas; a origem indisponível não deve aparecer como zero transações.
- Testar payload inesperado e status de autenticação expirado: nenhum dado deve ser inferido ou permanecer indevidamente exibido.
- Verificar não persistência de dados em storage, ausência de exportação automática, e tela informando que Open Finance **não** é abrangido.
- Regressão de Wallet, Pix, compra/venda USDC, KYC/Didit, Staff, lembretes e metas. Nenhuma transferência real durante o QA.

## Publicação
- CI exige `node scripts/validate-maya-financas-leitura-v1.js`, checagens gerais do Android v148, TypeScript, testes de segurança e export Android.
- Integrar apenas após CI verde. Liberar via OTA cumulativa de QA depois de validar o lote C, jamais publicar uma feature branch isolada sobre `production`.
- Nenhum valor financeiro retornado por endpoints de natureza incerta é usado para consolidar saldo ou criar orientação automática. A fase posterior de Open Finance Premium terá consentimentos, provedores e autorização separados.
