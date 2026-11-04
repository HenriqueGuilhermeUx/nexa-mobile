# Validação da comunicação de ativação Nexa

- Textos de boas-vindas e Didit preparados na PR #110.
- Dependências Expo SDK 57 corrigidas e lockfile atualizado.
- CI deve validar TypeScript, Expo Doctor e invariantes de segurança.
- OTA de produção bloqueada até confirmar runtimeVersion e versão efetivamente instalada na Play Store; `app.json` nesta branch usa 2.0.42 (145).
- Nenhuma alteração nos pagamentos, KYC ou automações SmartBots.
