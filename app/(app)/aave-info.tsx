import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import { colors } from '@/theme';

type Status = {
  success: true;
  mode: 'INFORMATION_ONLY';
  readOnlyConfigured: boolean;
  executionEnabled: false;
  supplyEnabled: false;
  borrowEnabled: false;
  repayEnabled: false;
  withdrawEnabled: false;
};
type Reserve = {
  asset: string; decimals: number; ltvBps: number; liquidationThresholdBps: number;
  active: boolean; paused: boolean; frozen: boolean; borrowingEnabled: boolean;
};
type MarketResponse = {
  success: true; informationalOnly: true; executionEnabled: false;
  chainId: number; reserves: Reserve[];
};
type Account = {
  chainId: number; walletAddress: string; healthFactor: string | null;
  totalCollateralBase: string; totalDebtBase: string; availableBorrowsBase: string;
  ltvBps: number; currentLiquidationThresholdBps: number;
  source: 'AAVE_V3_POOL'; executableQuote: false;
};
type PositionResponse = {
  success: true; informationalOnly: true; position: Account;
};
type AavePlan = { success: true; informationalOnly: true; executionEnabled: false; signatureRequired: true; state: string; action: string; };
type Simulation = {
  success: true; informationalOnly: true; executionEnabled: false;
  stressedCollateralUsd: number; stressedLtvPercent: number | null;
  outsideReferenceLtv: boolean;
};

const API = config.apiUrl.replace(/\/$/, '');
const prettyAddress = (value: string) => value.length > 18 ? value.slice(0, 9) + '…' + value.slice(-6) : value;
const onlyAmount = (value: string) => /^\d{1,9}(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));

/** All protocol reads are mediated by the authenticated Nexa backend.
 * Never request a private key or signature; never enable financial execution. */
export default function AaveInfoScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [markets, setMarkets] = useState<MarketResponse | null>(null);
  const [position, setPosition] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [collateral, setCollateral] = useState('1000');
  const [debt, setDebt] = useState('400');
  const [drop, setDrop] = useState('25');
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [action, setAction] = useState<'SUPPLY' | 'BORROW' | 'REPAY' | 'WITHDRAW'>('SUPPLY');
  const [amount, setAmount] = useState('10');
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<AavePlan | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setMessage(''); setMarkets(null); setPosition(null);
      try {
        const session = await loadNexaSession();
        if (!session?.accessToken) throw new Error('Entre na sua conta Nexa para consultar.');
        if (!API.startsWith('https://')) throw new Error('Conexão segura indisponível.');
        const headers = { Authorization: 'Bearer ' + session.accessToken };
        const read = async (route: string) => {
          const response = await fetch(API + '/invest-credit/' + route, { headers, signal: controller.signal });
          if (!response.ok) return null;
          return response.json();
        };
        const rawStatus = await read('aave/status');
        if (!rawStatus || rawStatus.success !== true || rawStatus.mode !== 'INFORMATION_ONLY' ||
          rawStatus.executionEnabled !== false || rawStatus.supplyEnabled !== false ||
          rawStatus.borrowEnabled !== false || rawStatus.repayEnabled !== false ||
          rawStatus.withdrawEnabled !== false) throw new Error('Consulta Aave não disponível.');
        if (controller.signal.aborted) return;
        setStatus(rawStatus as Status);
        if (!rawStatus.readOnlyConfigured) {
          setMessage('Consultas blockchain em preparação. Nenhum investimento ou empréstimo está habilitado.');
          return;
        }
        const [rawMarkets, rawPosition] = await Promise.all([read('aave/markets'), read('aave/me')]);
        if (controller.signal.aborted) return;
        if (rawMarkets?.informationalOnly === true && rawMarkets?.executionEnabled === false &&
          Array.isArray(rawMarkets.reserves)) setMarkets(rawMarkets as MarketResponse);
        if (rawPosition?.informationalOnly === true && rawPosition?.position?.source === 'AAVE_V3_POOL' &&
          rawPosition?.position?.executableQuote === false) setPosition(rawPosition.position as Account);
        if (!rawMarkets && !rawPosition) {
          setMessage('Mercados indisponíveis ou carteira Privy ainda não verificada. Sem operação financeira.');
        }
      } catch (e) {
        if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : 'Consulta indisponível.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  async function simulate() {
    if (!onlyAmount(collateral) || !onlyAmount(debt) ||
      !/^\d{1,3}$/.test(drop) || Number(drop) > 100 || Number(collateral) <= 0) {
      setMessage('Confira valores da garantia, dívida e queda percentual.'); return;
    }
    setSimulating(true); setSimulation(null); setMessage('');
    try {
      const session = await loadNexaSession();
      if (!session?.accessToken) throw new Error('Entre novamente na Nexa.');
      const params = new URLSearchParams({
        collateralUsd: collateral, borrowUsd: debt,
        referenceLtvPercent: '60', priceDropPercent: drop,
      });
      const response = await fetch(API + '/invest-credit/simulate-collateral?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + session.accessToken },
      });
      if (!response.ok) throw new Error('Simulador ainda não habilitado.');
      const data = await response.json();
      if (data?.success !== true || data?.informationalOnly !== true || data?.executionEnabled !== false) {
        throw new Error('Resposta de simulação inválida.');
      }
      setSimulation(data as Simulation);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Simulação indisponível.');
    } finally { setSimulating(false); }
  }

  async function preparePlan(reserve: Reserve) {
    setPlan(null);
    if (!markets || !Number.isSafeInteger(markets.chainId) ||
        !Number.isInteger(reserve.decimals) || reserve.decimals < 0 || reserve.decimals > 36 ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
      setMessage('Escolha um ativo e informe uma quantidade válida.'); return;
    }
    const [whole, frac = ''] = amount.split('.');
    if (frac.length > reserve.decimals || amount.length > 78) {
      setMessage('Quantidade com casas decimais acima do permitido pelo ativo.'); return;
    }
    const baseUnits = BigInt(whole + frac.padEnd(reserve.decimals, '0'));
    if (baseUnits <= 0n || baseUnits > (1n << 256n) - 1n) {
      setMessage('Quantidade fora do limite permitido.'); return;
    }
    setPlanning(true); setMessage('');
    try {
      const session = await loadNexaSession();
      if (!session?.accessToken) throw new Error('Entre novamente na Nexa.');
      const response = await fetch(API + '/invest-credit/aave/plan', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, chainId: markets.chainId, asset: reserve.asset, amountBaseUnits: baseUnits.toString() }),
      });
      if (!response.ok) throw new Error('Planejamento não habilitado para esta conta.');
      const data = await response.json();
      if (data?.success !== true || data?.informationalOnly !== true || data?.executionEnabled !== false ||
          data?.signatureRequired !== true || data?.state !== 'REQUIRES_FRESH_RISK_QUOTE_AND_WALLET_CONFIRMATION') {
        throw new Error('Resposta de segurança inesperada.');
      }
      setPlan(data as AavePlan);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível preparar.');
    } finally { setPlanning(false); }
  }

  const usable = markets?.reserves.filter((r) => r.active && !r.paused && !r.frozen) ?? [];
  const chosen = usable.find((r) => r.asset === selectedAsset) ?? usable[0];
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>NEXA · INVESTIMENTOS E CRÉDITO</Text>
      <Text style={styles.heading}>Seu dinheiro, mais possibilidades</Text>
      <Text style={styles.body}>Explore investimentos, crédito com garantia e a sua posição Aave sem sair da Nexa.</Text>
      <View style={styles.grid}>
        {[['Fazer render', 'Consultar ativos e condições do mercado'],
          ['Obter crédito', 'Entender a garantia e o risco'],
          ['Movimentar', 'Aplicar, amortizar ou retirar — após habilitação'],
          ['Acompanhar', 'Ver posição e saúde da carteira']].map(([title, description]) => (
          <View key={title} style={styles.option}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.small}>{description}</Text>
            <Text style={styles.tag}>{title === 'Acompanhar' ? 'Consulta' : 'Sem execução'}</Text>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Minha posição na blockchain</Text>
        {loading && <ActivityIndicator color={colors.cyan} />}
        {position ? (
          <>
            <Text style={styles.detail}>Rede: {position.chainId} · Carteira: {prettyAddress(position.walletAddress)}</Text>
            <Text style={styles.detail}>Saúde da posição: {position.healthFactor ?? 'Sem dívida registrada'}</Text>
            <Text style={styles.small}>Garantia / dívida (unidades-base do protocolo): {position.totalCollateralBase} / {position.totalDebtBase}</Text>
          </>
        ) : !loading && <Text style={styles.small}>Nenhuma posição disponível para consulta nesta conta.</Text>}
        {message ? <Text style={styles.notice}>{message}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setReloadKey((v) => v + 1)}>
          <Text style={styles.buttonText}>Atualizar consultas</Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Mercados Aave observados</Text>
        <Text style={styles.small}>Informações lidas do protocolo; não são ofertas, cotação de juros nem autorização para investir.</Text>
        {usable.length ? usable.slice(0, 8).map((reserve) => (
          <View key={reserve.asset} style={styles.market}>
            <Text style={styles.detail}>{prettyAddress(reserve.asset)}</Text>
            <Text style={styles.small}>LTV: {reserve.ltvBps / 100}% · Limiar de liquidação: {reserve.liquidationThresholdBps / 100}%</Text>
            <Text style={styles.tag}>{reserve.borrowingEnabled ? 'Empréstimo previsto no protocolo' : 'Empréstimo desativado'}</Text>
          </View>
        )) : <Text style={styles.small}>Mercados ainda não disponíveis nesta rede.</Text>}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Preparar uma operação</Text>
        <Text style={styles.small}>A Nexa verifica sua intenção com o backend. Nenhuma quantia é movimentada nem é solicitada assinatura.</Text>
        <View style={styles.grid}>
          {([['SUPPLY', 'Aplicar'], ['BORROW', 'Crédito'], ['REPAY', 'Amortizar'], ['WITHDRAW', 'Retirar']] as const).map(([key, title]) => (
            <Pressable key={key} accessibilityRole="button" onPress={() => { setAction(key); setPlan(null); }}
              style={[styles.option, action === key && { borderWidth: 1, borderColor: colors.cyan }]}>
              <Text style={styles.optionTitle}>{title}</Text>
            </Pressable>
          ))}
        </View>
        {usable.slice(0, 8).map((reserve) => (
          <Pressable key={reserve.asset} accessibilityRole="button" style={styles.market}
            onPress={() => { setSelectedAsset(reserve.asset); setPlan(null); }}>
            <Text style={styles.detail}>{chosen?.asset === reserve.asset ? '◉' : '○'} {prettyAddress(reserve.asset)}</Text>
            <Text style={styles.small}>{reserve.decimals} casas decimais · rede {markets?.chainId}</Text>
          </Pressable>
        ))}
        <Text style={styles.detail}>Quantidade do ativo</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" accessibilityLabel="Quantidade de ativo"
          value={amount} onChangeText={(v) => { setAmount(v); setPlan(null); }} />
        <Pressable accessibilityRole="button" disabled={planning || !chosen} style={styles.button}
          onPress={() => { if (chosen) void preparePlan(chosen); }}>
          <Text style={styles.buttonText}>{planning ? 'Verificando…' : 'Verificar intenção'}</Text>
        </Pressable>
        {plan && <Text style={styles.notice}>Intenção validada. Para executar serão necessários cotação de risco atualizada, autorização expressa da carteira e habilitação do serviço. Nenhuma operação foi executada.</Text>}
        {!chosen && <Text style={styles.small}>Consulta de mercados indisponível nesta conta.</Text>}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Teste o risco antes de decidir</Text>
        <Text style={styles.small}>Simulação educativa com referência hipotética de LTV de 60%. Não utiliza o preço de mercado ao vivo.</Text>
        <Text style={styles.detail}>Garantia hipotética (USD)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={collateral} onChangeText={setCollateral} accessibilityLabel="Garantia em dólares" />
        <Text style={styles.detail}>Dívida hipotética (USD)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={debt} onChangeText={setDebt} accessibilityLabel="Dívida em dólares" />
        <Text style={styles.detail}>Queda simulada (%)</Text>
        <TextInput style={styles.input} keyboardType="number-pad" value={drop} onChangeText={setDrop} accessibilityLabel="Queda percentual" />
        <Pressable accessibilityRole="button" disabled={simulating} style={styles.button} onPress={() => void simulate()}>
          <Text style={styles.buttonText}>{simulating ? 'Calculando…' : 'Simular cenário'}</Text>
        </Pressable>
        {simulation && <Text style={styles.detail}>
          Garantia após queda: US$ {simulation.stressedCollateralUsd.toFixed(2)}. LTV projetado: {typeof simulation.stressedLtvPercent === 'number' && Number.isFinite(simulation.stressedLtvPercent) ? simulation.stressedLtvPercent.toFixed(1) + '%' : 'não calculável'}.
          {simulation.outsideReferenceLtv ? ' Acima da referência educativa.' : ' Dentro da referência educativa.'}
        </Text>}
      </View>
      <Text style={styles.foot}>Esta versão não assina transações, não aplica, não empresta e não movimenta ativos. Rendimento não é garantido. Crédito tem risco de liquidação. A disponibilidade do protocolo não representa aprovação regulatória ou elegibilidade pessoal.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 22, backgroundColor: colors.background, gap: 16 },
  eyebrow: { color: colors.cyan, fontSize: 12, letterSpacing: 1.3, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 29, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { width: '47%', minWidth: 135, flexGrow: 1, backgroundColor: '#102B40', padding: 13, borderRadius: 13, gap: 6 },
  optionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  small: { color: colors.text, opacity: 0.77, fontSize: 13, lineHeight: 20 },
  tag: { color: colors.cyan, fontSize: 12, fontWeight: '600' },
  panel: { borderWidth: 1, borderColor: '#334155', borderRadius: 16, padding: 16, gap: 12 },
  panelTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  detail: { color: colors.text, fontSize: 14, lineHeight: 22 },
  notice: { color: colors.cyan, fontSize: 13, lineHeight: 20 },
  button: { padding: 12, borderRadius: 10, backgroundColor: '#145A7B', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  input: { color: colors.text, borderColor: '#475569', borderWidth: 1, borderRadius: 9, padding: 10, fontSize: 16 },
  market: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 11, gap: 4 },
  foot: { color: colors.text, opacity: 0.7, fontSize: 12, lineHeight: 19 },
});
