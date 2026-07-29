# Nexa Mobile

Aplicativo oficial da Nexa para Android e iOS, construído com Expo e Privy.

## Fonte oficial

A aplicação atual está na raiz deste repositório (`app/`, `src/`, `app.json` e `package.json`). A pasta histórica `nexa-mobile/nexa-mobile` permanece temporariamente apenas para auditoria da versão anterior e não deve ser usada em novos builds.

O projeto EAS existente foi preservado:

- EAS Project ID: `b3faabec-283a-4ba2-88b5-f096304e68aa`;
- Android package: `br.com.trynexa.app`;
- iOS bundle identifier: `br.com.trynexa.app`;
- próximo Android `versionCode`: `30`.

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
- novas ordens continuam sem movimentação enquanto o backend estiver em modo seguro;
- usuários Beta/Legacy não são migrados automaticamente.

## Configuração pública

O `app.json` contém somente valores públicos:

- Privy App ID;
- Privy Client ID;
- URL HTTPS da API;
- EAS Project ID.

Nunca adicione `PRIVY_APP_SECRET`, chaves privadas, frases de recuperação ou tokens ao repositório.

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

## Build nativo pelo GitHub

O workflow manual **EAS Native Build** permite disparar builds `development`, `preview` ou `production` para Android, iOS ou ambos.

Antes do primeiro uso, configure em **GitHub → Settings → Secrets and variables → Actions**:

```text
EXPO_TOKEN=<token da conta Expo vinculada ao projeto Nexa>
```

O workflow:

- exige confirmação adicional para o perfil `production`;
- executa validações de segurança, TypeScript e Expo Doctor antes do envio;
- usa `--non-interactive --no-wait`;
- apenas envia o build para o EAS;
- não publica automaticamente na Play Store ou App Store.

A Expo recomenda concluir ao menos um build interativo por plataforma antes de depender do modo não interativo em CI, para que credenciais e configurações nativas já estejam inicializadas.

## Produção Android

```bash
npx eas build --profile production --platform android
```

O perfil de produção gera Android App Bundle. Publicação na Play Store só deve ocorrer depois de QA com usuário novo direto, carteira vinculada, auditoria aprovada e todas as flags financeiras ainda conferidas.
