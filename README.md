# Nexa Mobile

Aplicativo oficial da Nexa para Android e iOS, construído com Expo e Privy.

## Posicionamento

**Nexa. Cripto sem complicação.**

O app transforma a estratégia Primeiros Nexa em produto:

- entrada na comunidade antes da abertura financeira;
- login Nexa e verificação Privy usando o mesmo e-mail;
- carteira individual vinculada ao usuário;
- produto inicial Pix → USDC;
- cotação, ordem e liquidação apresentadas como estados diferentes;
- nenhuma promessa de lucro ou rendimento.

## Segurança

- JWT da Nexa armazenado em `expo-secure-store`;
- token da Privy não é salvo nem registrado em logs;
- vínculo da wallet usa:
  - `Authorization: Bearer <Nexa JWT>`;
  - `x-privy-access-token: Bearer <Privy token>`;
  - corpo somente com `privyWalletId` e `walletAddress`;
- o app não envia `privyUserId` informado pelo cliente;
- nenhum saldo mock é exibido;
- novas ordens continuam com `fundsMoved: false` enquanto o backend estiver em modo seguro;
- usuários Beta/Legacy não são migrados automaticamente.

## Configuração pública

O `app.json` contém somente valores públicos:

- Privy App ID;
- Privy Client ID;
- URL HTTPS da API.

Nunca adicione `PRIVY_APP_SECRET`, chaves privadas, seed phrases ou tokens ao repositório.

## Privy App Client

No Dashboard da Privy, o cliente móvel deve permitir:

- Android package: `br.com.trynexa.app`;
- iOS bundle identifier: `br.com.trynexa.app`;
- URL scheme: `nexa`;
- em desenvolvimento com Expo Go, os identificadores adicionais exigidos pela própria Privy.

## Desenvolvimento

```bash
npm install
npm run doctor
npm run typecheck
npm start
```

A integração Privy usa módulos nativos. Para validar o comportamento real, utilize development build:

```bash
npx eas build --profile development --platform android
```

## Produção Android

O identificador existente foi preservado e o `versionCode` inicial desta nova base é `26`.

```bash
npx eas build --profile production --platform android
```

O perfil de produção gera Android App Bundle. Publicação na Play Store só deve ocorrer depois de QA com usuário novo direto, carteira vinculada, auditoria aprovada e todas as flags financeiras ainda conferidas.
