const fs = require('fs');
const path = require('path');

const appPath = path.join(process.cwd(), 'App.js');
let text = fs.readFileSync(appPath, 'utf8');
let original = text;

function replaceRequired(label, from, to) {
  if (text.includes(to)) {
    console.log(`${label}: already applied`);
    return;
  }

  if (!text.includes(from)) {
    throw new Error(`${label}: expected block not found`);
  }

  text = text.replace(from, to);
  console.log(`${label}: applied`);
}

// 1) Allow the app to render the QR image returned by Woovi/backend.
replaceRequired(
  'react-native Image import',
  `  Linking,\n  AppState,\n} from 'react-native';`,
  `  Linking,\n  AppState,\n  Image,\n} from 'react-native';`,
);

// 2) Store the provider QR image separately from Pix copia e cola.
replaceRequired(
  'pix QR image state',
  `  const [depositValue, setDepositValue] = useState('');\n  const [pixCopyPaste, setPixCopyPaste] = useState('');\n  const [ticketUrl, setTicketUrl] = useState('');`,
  `  const [depositValue, setDepositValue] = useState('');\n  const [pixCopyPaste, setPixCopyPaste] = useState('');\n  const [pixQrImage, setPixQrImage] = useState('');\n  const [ticketUrl, setTicketUrl] = useState('');`,
);

// 3) Clear the QR image on logout as well.
replaceRequired(
  'logout clears pix QR image',
  `    setPixCopyPaste('');\n    setTicketUrl('');`,
  `    setPixCopyPaste('');\n    setPixQrImage('');\n    setTicketUrl('');`,
);

// 4) Do not throw the user back to the menu when KYC is pending.
replaceRequired(
  'deposit KYC stays on deposit screen',
  `    if (getKycStatus() !== 'approved') {\n      show('Conclua sua verificação de identidade antes de depositar Pix');\n      setPage('menuScreen');\n      return;\n    }`,
  `    if (getKycStatus() !== 'approved') {\n      show('Conclua sua verificação de identidade antes de depositar Pix. Status atual: ' + getKycStatusLabel());\n      return;\n    }`,
);

// 5) Clear stale Pix data before generating a new charge and keep all provider-returned payment options.
replaceRequired(
  'deposit response stores QR image and link',
  `    try {\n      show('Gerando Pix Nexa...');\n      const r = await fetch(API + '/fiat-deposit/woovi/create-charge', {`,
  `    try {\n      setPixCopyPaste('');\n      setPixQrImage('');\n      setTicketUrl('');\n      show('Gerando Pix Nexa...');\n      const r = await fetch(API + '/fiat-deposit/woovi/create-charge', {`,
);

replaceRequired(
  'deposit response robust extraction',
  `      const charge = data.charge || {};\n      const pix = charge.paymentMethods?.pix || {};\n      const brCode = pix.brCode || charge.brCode || '';\n      const qrImage = pix.qrCodeImage || charge.qrCodeImage || '';\n      const paymentLink = charge.paymentLinkUrl || '';\n      setPixCopyPaste(brCode);\n      setTicketUrl(paymentLink || qrImage);\n      show('Pix gerado com sucesso. Após o pagamento, a Nexa converte automaticamente para USDC.');`,
  `      const charge = data.charge || {};\n      const pix = charge.paymentMethods?.pix || {};\n      const brCode = pix.brCode || charge.brCode || data.copyPasteCode || data.brCode || '';\n      const qrImage = pix.qrCodeImage || charge.qrCodeImage || data.qrCodeImage || '';\n      const paymentLink = charge.paymentLinkUrl || data.paymentLinkUrl || '';\n\n      setPixCopyPaste(brCode);\n      setPixQrImage(qrImage);\n      setTicketUrl(paymentLink);\n\n      if (!brCode && !qrImage && !paymentLink) {\n        show({\n          success: false,\n          message: 'Pix gerado, mas a resposta não trouxe QR Code, Pix copia e cola ou link de pagamento.',\n          response: data,\n        });\n        return;\n      }\n\n      show('Pix gerado com sucesso. Use o QR Code, o Pix copia e cola ou o link de pagamento.');`,
);

// 6) Render provider QR image first. Only render QR locally when the Pix copia e cola is small enough.
replaceRequired(
  'deposit screen safe QR rendering',
  `            {pixCopyPaste ? (\n              <View style={styles.pixBox}>\n                <View style={styles.qrBox}><QRCode value={pixCopyPaste} size={180} /></View>\n                <Text style={styles.copyText}>{pixCopyPaste}</Text>\n              </View>\n            ) : null}`,
  `            {pixCopyPaste || pixQrImage || ticketUrl ? (\n              <View style={styles.pixBox}>\n                {pixQrImage ? (\n                  <Image\n                    source={{ uri: pixQrImage }}\n                    style={{\n                      width: 220,\n                      height: 220,\n                      alignSelf: 'center',\n                      borderRadius: 16,\n                      backgroundColor: 'white',\n                      marginBottom: 12,\n                    }}\n                    resizeMode="contain"\n                  />\n                ) : pixCopyPaste && pixCopyPaste.length <= 1000 ? (\n                  <View style={styles.qrBox}>\n                    <QRCode value={pixCopyPaste} size={180} />\n                  </View>\n                ) : (\n                  <View style={styles.receiptBox}>\n                    <Text style={styles.itemText}>QR Code muito grande para renderizar no app.</Text>\n                    <Text style={styles.rateText}>Use o Pix copia e cola abaixo ou abra o link de pagamento.</Text>\n                  </View>\n                )}\n\n                {pixCopyPaste ? (\n                  <>\n                    <Text style={styles.receiptSmallLabel}>Pix copia e cola</Text>\n                    <Text style={styles.copyText}>{pixCopyPaste}</Text>\n                  </>\n                ) : null}\n\n                {ticketUrl ? (\n                  <Button title="Abrir link de pagamento" onPress={function () { abrirLink(ticketUrl); }} />\n                ) : null}\n              </View>\n            ) : null}`,
);

if (text === original) {
  console.log('No changes needed. App.js already patched.');
  process.exit(0);
}

fs.writeFileSync(appPath, text);
console.log('App.js patched successfully.');
