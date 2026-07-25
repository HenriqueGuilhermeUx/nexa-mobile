from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'nexa-mobile' / 'nexa-mobile' / 'App.js'
APP_JSON = ROOT / 'nexa-mobile' / 'nexa-mobile' / 'app.json'
PACKAGE_JSON = ROOT / 'nexa-mobile' / 'nexa-mobile' / 'package.json'

text = APP.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 trecho, encontrado {count}')
    text = text.replace(old, new, 1)

replace_once(
"""  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
""",
"""  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [withdrawalQuote, setWithdrawalQuote] = useState(null);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [legalDocuments, setLegalDocuments] = useState([]);
""",
'financial state',
)

replace_once(
"""        carregarCompliance();
        carregarAssinaturaRecorrente();
""",
"""        carregarCompliance();
        carregarDocumentosLegais();
        carregarAssinaturaRecorrente();
""",
'load legal documents',
)

replace_once(
"""  async function carregarCompliance() {
    if (!user?.id) return;
    try {
      const r = await fetch(API + '/legal/status?userId=' + user.id);
      const data = await r.json();
      setCompliance(data);
    } catch (e) {
      show('Erro compliance: ' + e.message);
    }
  }
""",
"""  async function carregarCompliance() {
    if (!user?.id) return;
    try {
      const r = await fetch(API + '/legal/status?userId=' + user.id);
      const data = await r.json();
      setCompliance(data);
    } catch (e) {
      show('Erro compliance: ' + e.message);
    }
  }

  async function carregarDocumentosLegais() {
    try {
      const r = await fetch(API + '/legal/documents');
      const data = await r.json();
      const documents = data.documents || data.requiredDocuments || [];
      setLegalDocuments(Array.isArray(documents) ? documents : []);
    } catch (e) {
      setLegalDocuments([]);
    }
  }
""",
'legal documents function',
)

old_withdraw = """  async function sacarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de sacar Pix');
      setPage('menuScreen');
      return;
    }
    if (!pixKey) {
      show('Informe a chave Pix');
      return;
    }
    const amount = parseAmount(valorBrl);
    if (!amount || amount <= 0) {
      show('Informe um valor válido em R$');
      return;
    }
    try {
      show('Processando saque Pix...');
      const r = await fetch(API + '/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: amount,
          pixKey,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.message || data.error || 'Erro ao solicitar saque Pix');
      }
      show(data);
      if (data.success) {
        setValorBrl('');
        setPixKey('');
        carregarDados();
        const receipt = {
          type: 'pix_withdraw',
          status: data.status || 'completed',
          transferId: data.paymentId || data.transactionId || 'pix_' + Date.now(),
          amountUsdc: data.debitedUSDC,
          amountBrl: data.amountBRL,
          destinationName: 'Chave Pix',
          destinationHandle: pixKey,
          fromHandle: getUsername(),
          date: getNowLabel(),
          message: data.message || 'Saque Pix solicitado',
        };
        setLastReceipt(receipt);
        setPage('receipt');
      }
    } catch (e) {
      show('Erro saque Pix: ' + e.message);
    }
  }
"""

new_withdraw = """  async function cotarSaquePix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amountUsdc = parseAmount(valorUsdc);
    if (!amountUsdc || amountUsdc <= 0) {
      show('Informe a quantidade de USDC que deseja vender');
      return;
    }
    if (amountUsdc > Number(saldo.USDC || 0)) {
      show('O valor informado é maior que seu saldo USDC disponível');
      return;
    }
    try {
      setWithdrawalLoading(true);
      setWithdrawalQuote(null);
      show('Buscando a cotação real de venda...');
      const r = await fetch(API + '/withdrawal/pix-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountUsdc }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || data.error || 'Não foi possível cotar o saque');
      }
      setWithdrawalQuote(data);
      show('Cotação pronta. Confira o valor líquido antes de confirmar.');
    } catch (e) {
      show('Erro cotação saque: ' + e.message);
    } finally {
      setWithdrawalLoading(false);
    }
  }

  async function sacarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de sacar Pix');
      setPage('menuScreen');
      return;
    }
    if (!pixKey) {
      show('Informe a chave Pix');
      return;
    }
    if (!withdrawalQuote || !withdrawalQuote.success) {
      show('Faça uma cotação válida antes de confirmar o saque');
      return;
    }
    const amountUsdc = Number(withdrawalQuote.amountUsdc || withdrawalQuote.from?.amount || 0);
    const expectedNetBrl = Number(withdrawalQuote.netBrl || withdrawalQuote.to?.netBrl || withdrawalQuote.maximumWithdrawableBrl || 0);
    if (!amountUsdc || !expectedNetBrl) {
      show('Cotação inválida. Faça uma nova cotação.');
      setWithdrawalQuote(null);
      return;
    }
    try {
      setWithdrawalLoading(true);
      show('Registrando solicitação de saque Pix...');
      const r = await fetch(API + '/withdrawal/pix-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountUsdc,
          expectedNetBrl,
          pixKey,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setWithdrawalQuote(null);
        throw new Error(data.message || data.error || 'Erro ao solicitar saque Pix');
      }
      const finalNetBrl = Number(data.to?.netBrl || data.netBrl || expectedNetBrl);
      const receipt = {
        type: 'pix_withdraw',
        status: data.status || 'pending',
        transferId: data.referenceId || 'pix_' + Date.now(),
        amountUsdc,
        amountBrl: finalNetBrl,
        destinationName: 'Chave Pix',
        destinationHandle: pixKey,
        fromHandle: getUsername(),
        date: getNowLabel(),
        message: data.message || 'Saque Pix solicitado para processamento',
      };
      setLastReceipt(receipt);
      setValorUsdc('');
      setPixKey('');
      setWithdrawalQuote(null);
      carregarDados();
      setPage('receipt');
    } catch (e) {
      show('Erro saque Pix: ' + e.message);
    } finally {
      setWithdrawalLoading(false);
    }
  }
"""
replace_once(old_withdraw, new_withdraw, 'withdrawal flow')

replace_once(
"""        {page === 'deposit' && (
          <Card>
            <Text style={styles.title}>Depositar via Pix</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}
            <Input placeholder="Valor em R$" keyboardType="numeric" value={depositValue} onChangeText={setDepositValue} />
            <Button title="Depositar via Pix" onPress={depositarPix} />
""",
"""        {page === 'deposit' && (
          <Card>
            <Text style={styles.title}>Depositar via Pix</Text>
            <Text style={styles.itemText}>Seu Pix será convertido automaticamente para USDC pela Cotação Nexa vigente.</Text>
            <Text style={styles.rateText}>A cotação apresentada já considera custos do provedor, liquidez, execução e margem comercial da Nexa. O valor final em USDC é confirmado após a liquidação do Pix.</Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>Cotação Nexa atual</Text>
              <Text style={styles.totalBalance}>R$ {Number(buyRate || 0).toFixed(4)} / USDC</Text>
              {parseAmount(depositValue) > 0 ? (
                <Text style={styles.rateText}>Estimativa: {(parseAmount(depositValue) / Number(buyRate || 1)).toFixed(6)} USDC antes de eventuais tarifas externas identificadas na liquidação.</Text>
              ) : null}
            </View>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}
            <Input placeholder="Valor em R$" keyboardType="numeric" value={depositValue} onChangeText={setDepositValue} />
            <Button title="Gerar Pix com Cotação Nexa" onPress={depositarPix} />
""",
'deposit screen',
)

replace_once(
"""        {page === 'pix' && (
          <Card>
            <Text style={styles.title}>Sacar Pix</Text>
            <Input placeholder="Chave Pix" value={pixKey} onChangeText={setPixKey} />
            <Input placeholder="Valor em R$" keyboardType="numeric" value={valorBrl} onChangeText={setValorBrl} />
            <Button title="Solicitar Pix" onPress={sacarPix} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}
""",
"""        {page === 'pix' && (
          <Card>
            <Text style={styles.title}>Sacar Pix</Text>
            <Text style={styles.itemText}>Venda seu USDC pela cotação real disponível e receba o valor líquido via Pix.</Text>
            <Text style={styles.rateText}>O valor em reais pode ser menor que o valor originalmente depositado. Ele depende do livro de ofertas, liquidez, custos de execução, margem operacional e tarifa Pix.</Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>Saldo disponível</Text>
              <Text style={styles.totalBalance}>{Number(saldo.USDC || 0).toFixed(6)} USDC</Text>
            </View>
            <Input placeholder="Quantidade de USDC para vender" keyboardType="numeric" value={valorUsdc} onChangeText={function (value) { setValorUsdc(value); setWithdrawalQuote(null); }} />
            <Button title="Usar saldo total" onPress={function () { setValorUsdc(Number(saldo.USDC || 0).toFixed(6)); setWithdrawalQuote(null); }} />
            <Button title={withdrawalLoading ? 'Cotando...' : 'Calcular valor líquido'} onPress={cotarSaquePix} />
            {withdrawalQuote ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>Resumo da cotação</Text>
                <Text style={styles.rateText}>USDC vendido: {Number(withdrawalQuote.amountUsdc || withdrawalQuote.from?.amount || 0).toFixed(6)}</Text>
                <Text style={styles.rateText}>Cotação executável: R$ {Number(withdrawalQuote.executableRate || withdrawalQuote.sellRate || 0).toFixed(6)}</Text>
                <Text style={styles.rateText}>Valor bruto: R$ {formatMoney(withdrawalQuote.grossBrl || withdrawalQuote.to?.grossBrl || 0)}</Text>
                <Text style={styles.totalBalance}>Você receberá aproximadamente R$ {formatMoney(withdrawalQuote.netBrl || withdrawalQuote.to?.netBrl || withdrawalQuote.maximumWithdrawableBrl || 0)}</Text>
                <Text style={styles.rateText}>A cotação será validada novamente na confirmação. Se o mercado mudar, será necessário cotar de novo.</Text>
              </View>
            ) : null}
            <Input placeholder="Chave Pix" value={pixKey} onChangeText={setPixKey} />
            {withdrawalQuote ? <Button title="Confirmar solicitação de Pix" onPress={sacarPix} /> : null}
            <Button title="Voltar" onPress={function () { setWithdrawalQuote(null); setPage('menuScreen'); }} />
          </Card>
        )}
""",
'withdrawal screen',
)

replace_once(
"""        {page === 'legal' && (
          <Card>
            <Text style={styles.title}>Legal e Riscos</Text>
            <Button title="Aceitar Termos" onPress={aceitarDocumentosLegais} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}
""",
"""        {page === 'legal' && (
          <Card>
            <Text style={styles.title}>Legal, Cotações e Riscos</Text>
            <Text style={styles.itemText}>Antes de operar, leia e aceite os documentos vigentes.</Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>Entrada por Pix</Text>
              <Text style={styles.rateText}>O valor líquido, após custos do provedor Pix, é convertido pela Cotação Nexa. A cotação incorpora custos de liquidez, execução, risco e margem comercial, e pode diferir de referências públicas.</Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>Saída por Pix</Text>
              <Text style={styles.rateText}>O limite de saque corresponde ao valor líquido realizável na venda do USDC no momento da solicitação, descontadas tarifas, margem operacional e custos de execução. Não há garantia de recompra pelo valor depositado.</Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>Risco de mercado e liquidez</Text>
              <Text style={styles.rateText}>Os preços de compra e venda podem apresentar diferenças relevantes. A quantidade de reais recebida depende das ofertas efetivamente disponíveis.</Text>
            </View>
            {legalDocuments.map(function (document, index) {
              return (
                <View key={document.documentType || document.type || index} style={styles.item}>
                  <Text style={styles.itemText}>{document.title || document.documentType || document.type || 'Documento legal'}</Text>
                  <Text style={styles.rateText}>Versão {document.version || document.documentVersion || 'vigente'}</Text>
                  {document.content ? <Text style={styles.rateText}>{document.content}</Text> : null}
                </View>
              );
            })}
            <Button title="Atualizar documentos" onPress={carregarDocumentosLegais} />
            <Button title="Li e aceito os documentos vigentes" onPress={aceitarDocumentosLegais} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}
""",
'legal screen',
)

APP.write_text(text, encoding='utf-8')

app_config = json.loads(APP_JSON.read_text(encoding='utf-8'))
expo = app_config['expo']
expo['version'] = '1.4.7'
expo.setdefault('android', {})['versionCode'] = 27
expo.setdefault('ios', {})['buildNumber'] = '28'
plugins = expo.setdefault('plugins', [])
build_plugin = [
    'expo-build-properties',
    {'android': {'compileSdkVersion': 36, 'targetSdkVersion': 36, 'buildToolsVersion': '36.0.0'}},
]
plugins = [p for p in plugins if not (isinstance(p, list) and p and p[0] == 'expo-build-properties')]
plugins.append(build_plugin)
expo['plugins'] = plugins
APP_JSON.write_text(json.dumps(app_config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

package = json.loads(PACKAGE_JSON.read_text(encoding='utf-8'))
package['version'] = '1.4.7'
package.setdefault('dependencies', {})['expo-build-properties'] = '~1.0.10'
PACKAGE_JSON.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Nexa Mobile 1.4.7 preparada com fluxo financeiro, termos e Android API 36.')
