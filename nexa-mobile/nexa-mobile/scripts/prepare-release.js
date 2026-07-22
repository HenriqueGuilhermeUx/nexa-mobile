const fs = require('fs');

const versionName = process.env.VERSION_NAME || '1.4.7';
const versionCode = Number(process.env.VERSION_CODE || 27);

if (!versionName) throw new Error('VERSION_NAME ausente');
if (!Number.isInteger(versionCode) || versionCode <= 26) {
  throw new Error('VERSION_CODE precisa ser inteiro e maior que 26 para a versão Android 16');
}

const pkgPath = './package.json';
const appPath = './app.json';
const appJsPath = './App.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function replaceRequired(label, from, to, text) {
  if (text.includes(to)) {
    console.log(`${label}: já aplicado`);
    return text;
  }
  if (!text.includes(from)) {
    throw new Error(`${label}: bloco esperado não encontrado`);
  }
  console.log(`${label}: aplicado`);
  return text.replace(from, to);
}

function replaceByRegexRequired(label, regex, to, text) {
  if (!regex.test(text)) {
    throw new Error(`${label}: padrão esperado não encontrado`);
  }
  console.log(`${label}: aplicado`);
  return text.replace(regex, to);
}

const pkg = readJson(pkgPath);
pkg.version = versionName;
pkg.dependencies = pkg.dependencies || {};
Object.assign(pkg.dependencies, {
  expo: '~54.0.0',
  'expo-font': '~14.0.0',
  react: '19.1.0',
  'react-native': '0.81.5',
  '@expo/vector-icons': '^15.0.0',
  '@react-native-async-storage/async-storage': '2.2.0',
  'expo-local-authentication': '~17.0.0',
  'expo-secure-store': '~15.0.0',
  'expo-status-bar': '~3.0.0',
  'react-native-safe-area-context': '5.6.0',
  'react-native-svg': '15.12.1',
});
pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies['@babel/core'] = pkg.devDependencies['@babel/core'] || '^7.25.2';
pkg.devDependencies['eas-cli'] = pkg.devDependencies['eas-cli'] || 'latest';
pkg.devDependencies['expo-doctor'] = pkg.devDependencies['expo-doctor'] || 'latest';
writeJson(pkgPath, pkg);

const app = readJson(appPath);
app.expo = app.expo || {};
app.expo.version = versionName;
app.expo.sdkVersion = '54.0.0';
// OTA/EAS Update não está ativo neste app. Removemos runtimeVersion para evitar
// erro do EAS: "use expo-updates >= 0.14.4 to use appVersion runtime policy".
delete app.expo.runtimeVersion;
app.expo.android = app.expo.android || {};
app.expo.android.package = 'br.com.trynexa.app';
app.expo.android.versionCode = versionCode;
app.expo.ios = app.expo.ios || {};
app.expo.ios.buildNumber = String(versionCode);
writeJson(appPath, app);

let text = fs.readFileSync(appJsPath, 'utf8');

if (!text.includes("  Image,\n} from 'react-native';") && !text.includes("  Image,\n  AppState,")) {
  text = replaceRequired(
    'Import Image',
    "  Linking,\n} from 'react-native';",
    "  Linking,\n  Image,\n} from 'react-native';",
    text,
  );
}

if (!text.includes('pixQrImage')) {
  text = replaceRequired(
    'Pix QR image state',
    "  const [depositValue, setDepositValue] = useState('');\n  const [pixCopyPaste, setPixCopyPaste] = useState('');\n  const [ticketUrl, setTicketUrl] = useState('');",
    "  const [depositValue, setDepositValue] = useState('');\n  const [pixCopyPaste, setPixCopyPaste] = useState('');\n  const [pixQrImage, setPixQrImage] = useState('');\n  const [ticketUrl, setTicketUrl] = useState('');",
    text,
  );
}

if (!text.includes("setPixQrImage('');")) {
  text = replaceRequired(
    'Logout clears pix image',
    "    setPixCopyPaste('');\n    setTicketUrl('');",
    "    setPixCopyPaste('');\n    setPixQrImage('');\n    setTicketUrl('');",
    text,
  );
}

text = text.replace(
  "      setRedeemQuote(data);\n      show(e.message);",
  "      setRedeemQuote(data);\n      show(data);",
);

const newDepositFunction = `  async function depositarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de depositar Pix. Status atual: ' + getKycStatusLabel());
      return;
    }
    const amount = parseAmount(depositValue);
    if (!amount || amount < 10) {
      show('Depósito mínimo é R$ 10,00');
      return;
    }
    try {
      setPixCopyPaste('');
      setPixQrImage('');
      setTicketUrl('');
      show('Gerando Pix Nexa...');
      const r = await fetch(API + '/fiat-deposit/woovi/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: amount,
        }),
      });
      const data = await r.json();
      if (!data.success) {
        show(data);
        return;
      }
      const charge = data.charge || {};
      const pix = charge.paymentMethods?.pix || {};
      const brCode = pix.brCode || charge.brCode || data.copyPasteCode || data.brCode || '';
      const qrImage = pix.qrCodeImage || charge.qrCodeImage || data.qrCodeImage || '';
      const paymentLink = charge.paymentLinkUrl || data.paymentLinkUrl || '';

      setPixCopyPaste(brCode);
      setPixQrImage(qrImage);
      setTicketUrl(paymentLink);

      if (!brCode && !qrImage && !paymentLink) {
        show({
          success: false,
          message: 'Pix gerado, mas a resposta não trouxe QR Code, Pix copia e cola ou link de pagamento.',
          response: data,
        });
        return;
      }

      show('Pix gerado com sucesso. Use o QR Code, o Pix copia e cola ou o link de pagamento.');
    } catch (e) {
      show('Erro depósito Pix: ' + e.message);
    }
  }
`;

text = replaceByRegexRequired(
  'Deposit Pix function',
  /  async function depositarPix\(\) \{[\s\S]*?\n  async function converter\(\) \{/,
  `${newDepositFunction}\n  async function converter() {`,
  text,
);

const oldRender = `            {pixCopyPaste ? (
              <View style={styles.pixBox}>
                <View style={styles.qrBox}><QRCode value={pixCopyPaste} size={180} /></View>
                <Text style={styles.copyText}>{pixCopyPaste}</Text>
              </View>
            ) : null}`;

const newRender = `            {pixCopyPaste || pixQrImage || ticketUrl ? (
              <View style={styles.pixBox}>
                {pixQrImage ? (
                  <Image
                    source={{ uri: pixQrImage }}
                    style={{
                      width: 220,
                      height: 220,
                      alignSelf: 'center',
                      borderRadius: 16,
                      backgroundColor: 'white',
                      marginBottom: 12,
                    }}
                    resizeMode="contain"
                  />
                ) : pixCopyPaste && pixCopyPaste.length <= 1000 ? (
                  <View style={styles.qrBox}>
                    <QRCode value={pixCopyPaste} size={180} />
                  </View>
                ) : (
                  <View style={styles.receiptBox}>
                    <Text style={styles.itemText}>QR Code muito grande para renderizar no app.</Text>
                    <Text style={styles.rateText}>Use o Pix copia e cola abaixo ou abra o link de pagamento.</Text>
                  </View>
                )}

                {pixCopyPaste ? (
                  <>
                    <Text style={styles.receiptSmallLabel}>Pix copia e cola</Text>
                    <Text style={styles.copyText}>{pixCopyPaste}</Text>
                  </>
                ) : null}

                {ticketUrl ? (
                  <Button title="Abrir link de pagamento" onPress={function () { abrirLink(ticketUrl); }} />
                ) : null}
              </View>
            ) : null}`;

if (!text.includes('QR Code muito grande para renderizar no app.')) {
  text = replaceRequired('Deposit Pix render', oldRender, newRender, text);
}

fs.writeFileSync(appJsPath, text);

const finalText = fs.readFileSync(appJsPath, 'utf8');
const checks = ['Image,', 'pixQrImage', 'QR Code muito grande', 'Status atual'];
for (const check of checks) {
  if (!finalText.includes(check)) {
    throw new Error(`Validação falhou: App.js não contém ${check}`);
  }
}

console.log('Release Android 16 preparado com sucesso:', {
  versionName,
  versionCode,
  packageName: app.expo.android.package,
  sdkVersion: app.expo.sdkVersion,
  expo: pkg.dependencies.expo,
  react: pkg.dependencies.react,
  reactNative: pkg.dependencies['react-native'],
  easProjectId: app.expo.extra?.eas?.projectId,
  runtimeVersionRemoved: !app.expo.runtimeVersion,
});
