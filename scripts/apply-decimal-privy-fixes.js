const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  if (source.includes(replacement)) return source;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

const legacyParser = `  function parseAmount(value) {
    const text = String(value || '')
      .trim()
      .replace(/\\s/g, '')
      .replace(/R\\$/gi, '')
      .replace(/USDC/gi, '');
    if (!text) return 0;

    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    let normalized = text;

    if (lastComma >= 0 && lastDot >= 0) {
      const decimalSeparator = lastComma > lastDot ? ',' : '.';
      const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
      normalized = text.split(thousandsSeparator).join('');
      if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
    } else if (lastComma >= 0) {
      normalized = text.replace(/\\./g, '').replace(',', '.');
    } else if (lastDot >= 0) {
      const dotCount = (text.match(/\\./g) || []).length;
      normalized = dotCount === 1 ? text : text.replace(/\\.(?=.*\\.)/g, '');
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function formatInputAmount(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '';
    return number
      .toFixed(8)
      .replace(/0+$/, '')
      .replace(/\\.$/, '')
      .replace('.', ',');
  }

`;

for (const path of ['App.js', 'nexa-mobile/nexa-mobile/App.js']) {
  let source = read(path);
  source = replaceRange(
    source,
    '  function parseAmount(value) {',
    '  function getUsername()',
    legacyParser,
    `${path} parseAmount`,
  );
  source = source.replace(
    /setValorUsdc\(Number\(saldo\.USDC \|\| 0\)\.toFixed\(6\)\);/g,
    'setValorUsdc(formatInputAmount(saldo.USDC));',
  );

  if (!source.includes('const duplicatedProviderDomain =')) {
    const marker = '  async function cadastrar() {\n';
    const index = source.indexOf(marker);
    if (index < 0) throw new Error(`Could not locate registration in ${path}`);
    const validation = `  async function cadastrar() {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const duplicatedProviderDomain = /@((?:gmail|hotmail|outlook|yahoo|icloud)\\.com)\\1$/i.test(
      normalizedEmail,
    );
    const duplicatedCom = /\\.com\\.com$/i.test(normalizedEmail);
    const basicEmailValid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(
      normalizedEmail,
    );
    if (!basicEmailValid || duplicatedProviderDomain || duplicatedCom) {
      show('Confira o e-mail. Ele parece digitado incorretamente.');
      return;
    }
`;
    source = source.slice(0, index) + validation + source.slice(index + marker.length);
  }
  source = source.replace(
    /body: JSON\.stringify\(\{ email, password, cpf, fullName, phone \}\),/g,
    'body: JSON.stringify({ email: normalizedEmail, password, cpf, fullName, phone }),',
  );
  write(path, source);
}

const orderPath = 'app/(app)/new-order.tsx';
let order = read(orderPath);
const orderParser = `function parseAmount(value: string) {
  const text = value.trim().replace(/R\\$/gi, '').replace(/\\s/g, '');
  if (!text) return 0;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let normalized = text;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = text.split(thousandsSeparator).join('');
    if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
  } else if (lastComma >= 0) {
    normalized = text.replace(/\\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const dotCount = (text.match(/\\./g) || []).length;
    normalized = dotCount === 1 ? text : text.replace(/\\.(?=.*\\.)/g, '');
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

`;
order = replaceRange(
  order,
  'function parseAmount(value: string) {',
  'function profileFrom(',
  orderParser,
  'official parseAmount',
);
write(orderPath, order);

const onboardingPath = 'app/onboarding-wallet.tsx';
let onboarding = read(onboardingPath);
if (!onboarding.includes('const walletLinkSucceeded = true;')) {
  const startMarker = '      await nexaApi.linkWallet(session.accessToken, privyAccessToken, {';
  const start = onboarding.indexOf(startMarker);
  const endMarker = "      router.replace('/(app)');";
  const end = onboarding.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Could not locate blocking Privy audit');
  const after = end + endMarker.length;
  const replacement = `      await nexaApi.linkWallet(session.accessToken, privyAccessToken, {
        privyWalletId,
        walletAddress: wallet.address,
      });

      const walletLinkSucceeded = true;
      try {
        await nexaApi.auditWallet(session.accessToken);
      } catch (auditError) {
        console.warn(
          'A carteira foi vinculada, mas a auditoria complementar ficou pendente.',
          auditError instanceof Error ? auditError.message : auditError,
        );
      }

      const updated = await nexaApi.directProfile(session.accessToken);
      setProfile(valueFromProfile(updated));
      if (walletLinkSucceeded) router.replace('/(app)');`;
  onboarding = onboarding.slice(0, start) + replacement + onboarding.slice(after);
}
write(onboardingPath, onboarding);

const ciPath = '.github/workflows/mobile-ci.yml';
let ci = read(ciPath);
if (!ci.includes('Validate decimal and Privy onboarding fixes')) {
  const marker = `      - name: Validate TypeScript\n`;
  const step = `      - name: Validate decimal and Privy onboarding fixes\n        run: node scripts/validate-decimal-and-privy-onboarding.js\n`;
  if (!ci.includes(marker)) throw new Error('Could not locate mobile CI anchor');
  ci = ci.replace(marker, step + marker);
  write(ciPath, ci);
}

console.log('Mobile decimal and Privy onboarding source fixes applied.');
