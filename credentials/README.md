# Credenciais Apple — Nexa iOS v145

Este diretório é somente para uso local/CI.

## App Store Connect API

- Team ID: KX826S9GK7
- Issuer ID: 802406ee-f4dc-436f-ad9b-b0d3e447408c
- Key ID: Q98GFR6N86
- Bundle ID: br.com.trynexa.app
- App: Nexa Wallet
- Versão: 2.0.42
- Build: 145

## Arquivo privado

O arquivo privado esperado pelo EAS Submit é:

`credentials/AuthKey_Q98GFR6N86.p8`

**Nunca faça commit desse arquivo.** O repositório ignora globalmente `*.p8`.

## Ainda falta antes da submissão

1. Criar/confirmar o registro Nexa no App Store Connect.
2. Copiar o Apple ID numérico do app (ascAppId).
3. Configurar uma vez as credenciais de assinatura no EAS:
   `eas credentials --platform ios`
4. Validar Distribution Certificate + App Store Provisioning Profile.
5. Gerar o IPA de produção.
6. Enviar para TestFlight/App Store Connect.

A chave da App Store Connect é usada para submissão. Ela não substitui o certificado de distribuição e o provisioning profile necessários para assinar o app.
