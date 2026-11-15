import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import { aaveReserveEligibleForPlanning } from '@/lib/aaveReserveEligibility';
import { simulateAaveEducationalScenario, type AaveEducationalResult } from '@/lib/aaveEducationalSimulation';
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
type ApiReadResult = { data: any; status: number };
type Simulation = AaveEducationalResult;

const API = config.apiUrl.replace(/\/$/, '');
// Match Android identity headers used by Nexa API; missing values lead to HTTP 426.
const aaveRequestHeaders = (accessToken: string) => ({
  Authorization: 'Bearer ' + accessToken,
  'X-Nexa-App-Version': config.appVersion,
  'X-Nexa-App-Build': config.appBuild,
  'X-Nexa-Platform': Platform.OS,
});
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
  const [marketIssue, setMarketIssue] = useState('');
  const [positionIssue, setPositionIssue] = useState('');
  const [planIssue, setPlanIssue] = useState('');
  const [simulationIssue, setSimulationIssue] = useState('');
  const [collateral, setCollateral] = useState('1000');
  const [debt, setDebt] = useState('400');
  const [drop, setDrop] = useState('25');
  const [simulation, setSimulation] = useState<Simulation | null>(null);
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
      setMarketIssue(''); setPositionIssue(''); setPlanIssue('');
      try {
        const session = await loadNexaSession();
        if (!session?.accessToken) throw new Error('Entre na sua conta Nexa para consultar.');
        if (!API.startsWith('https://')) throw new Error('Conexão segura indisponível.');
        const headers = aaveRequestHeaders(session.accessToken);
        const read = async (route: string) => {
          const response = await fetch(API + '/invest-credit/' + route, { headers, signal: controller.signal });
          if (response.status === 426) throw new Error('Versão do aplicativo não autorizada pela API Nexa. Atualize o aplicativo de testes.');
          if (response.status === 401) throw new Error('Sessão Nexa expirada. Entre novamente para consultar o Aave.');
          if (!response.ok) return { data: null, status: response.status } as ApiReadResult;
          return { data: await response.json(), status: response.status } as ApiReadResult;
        };
        const statusResult = await read('aave/status');
        const rawStatus = statusResult.data;
        if (!rawStatus || rawStatus.success !== true || rawStatus.mode !== 'INFORMATION_ONLY' ||
          rawStatus.executionEnabled !== false || rawStatus.supplyEnabled !== false ||
          rawStatus.borrowEnabled !== false || rawStatus.repayEnabled !== false ||
          rawStatus.withdrawEnabled !== false) throw new Error('Consulta Aave não disponível.');
        if (controller.signal.aborted) return;
        setStatus(rawStatus as Status);
        if (!rawStatus.readOnlyConfigured) {
          setMarketIssue('O backend Nexa ainda não habilitou a leitura blockchain Aave nesta rede. A consulta real de mercados depende da validação de rede, RPC e Pool; nenhum dado será inventado.');
          setPositionIssue('A posição ainda não foi consultada: a leitura blockchain do servidor está desabilitada. Isso não significa que sua carteira tenha saldo zero.');
          return;
        }
        const [marketsResult, positionResult] = await Promise.all([read('aave/markets'), read('aave/me')]);
        const rawMarkets = marketsResult.data;
        const rawPosition = positionResult.data;
        if (controller.signal.aborted) return;
        if (rawMarkets?.informationalOnly === true && rawMarkets?.executionEnabled === false &&
          Array.isArray(rawMarkets.reserves)) {
          setMarkets(rawMarkets as MarketResponse);
        } else {
          setMarketIssue(marketsResult.status === 503
            ? 'Mercados Aave: leitura blockchain indisponível (HTTP 503). É preciso conferir a configuração RPC/Pool no backend de homologação.'
            : 'Mercados Aave: consulta não disponível (HTTP ' + marketsResult.status + ').');
        }
        if (rawPosition?.informationalOnly === true && rawPosition?.position?.source === 'AAVE_V3_POOL' &&
          rawPosition?.position?.executableQuote === false) {
          setPosition(rawPosition.position as Account);
        } else {
          setPositionIssue(positionResult.status === 403
            ? 'Minha posição: carteira Privy com titularidade verificada necessária (HTTP 403). Nenhum saldo foi inferido.'
            : positionResult.status === 503
              ? 'Minha posição: leitura RPC/Pool indisponível (HTTP 503). Nenhum saldo foi inferido.'
              : 'Minha posição: consulta não disponível (HTTP ' + positionResult.status + ').');
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

  function simulate() {
    // Educational local arithmetic: no API flag, wallet, oracle, protocol or transaction.
    setSimulation(null); setSimulationIssue('');
    if (!onlyAmount(collateral) || !onlyAmount(debt) ||
      !/^\\d{1,3}$/.test(drop) || Number(drop) > 100 || Number(collateral) <= 0) {
      setSimulationIssue('Confira os valores: garantia maior que zero, dívida não negativa e queda de 0 a 100%.');
      return;
    }
    try {
      setSimulation(simulateAaveEducationalScenario({
        collateralUsd: Number(collateral),
        borrowUsd: Number(debt),
        priceDropPercent: Number(drop),
        referenceLtvPercent: 60,
      }));
    } catch {
      setSimulationIssue('Não foi possível calcular este cenário com os valores informados.');
    }
  }

  async function preparePlan(reserve: Reserve) {
    setPlan(null); setPlanIssue('');
    if (!markets || !Number.isSafeInteger(markets.chainId) ||
        !Number.isInteger(reserve.decimals) || reserve.decimals < 0 || reserve.decimals > 36 ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
      setPlanIssue('Escolha um ativo e informe uma quantidade válida.'); return;
    }
    if (!aaveReserveEligibleForPlanning(reserve, action)) {
      setPlanIssue('Esta reserva não está elegível para a operação selecionada.'); return;
    }
    const [whole, frac = ''] = amount.split('.');
    if (frac.length > reserve.decimals || amount.length > 78) {
      setPlanIssue('Quantidade com casas decimais acima do permitido pelo ativo.'); return;
    }
    const baseUnits = BigInt(whole + frac.padEnd(reserve.decimals, '0'));
    if (baseUnits <= 0n || baseUnits > (1n << 256n) - 1n) {
      setPlanIssue('Quantidade fora do limite permitido.'); return;
    }
    setPlanning(true); setPlanIssue('');
    try {
      const session = await loadNexaSession();
      if (!session?.accessToken) throw new Error('Entre novamente na Nexa.');
      const response = await fetch(API + '/invest-credit/aave/plan', {
        method: 'POST',
        headers: { ...aaveRequestHeaders(session.accessToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, chainId: markets.chainId, asset: reserve.asset, amountBaseUnits: baseUnits.toString() }),
      });
      if (response.status === 426) throw new Error('Build de teste não aceito pela Nexa. Instale a versão de homologação atualizada.');
      if (!response.ok) throw new Error('Planejamento Aave indisponível (HTTP ' + response.status + ').');
      const data = await response.json();
      if (data?.success !== true || data?.informationalOnly !== true || data?.executionEnabled !== false ||
          data?.signatureRequired !== true || data?.state !== 'REQUIRES_FRESH_RISK_QUOTE_AND_WALLET_CONFIRMATION') {
        throw new Error('Resposta de segurança inesperada.');
      }
      setPlan(data as AavePlan);
    } catch (e) {
      setPlanIssue(e instanceof Error ? e.message : 'Não foi possível preparar.');
    } finally { setPlanning(false); }
  }

  const usable = markets?.reserves.filter((r) => r.active && !r.paused && !r.frozen) ?? [];
  // Aave V3 frozen reserves prevent new supply/borrow, not debt repayment or withdrawal.
  // Paused/inactive reserves remain unavailable for all four QA actions.
  const actionReserves = markets?.reserves.filter((r) =>
    aaveReserveEligibleForPlanning(r, action)
  ) ?? [];
  const chosen = actionReserves.find((r) => r.asset === selectedAsset) ?? actionReserves[0];
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
        ) : !loading && <Text style={styles.small}>{positionIssue || 'Ainda não há dados de posição disponíveis nesta consulta. Não foi confirmado saldo zero.'}</Text>}
        {message ? <Text style={styles.notice}>{message}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setReloadKey((v) => v + 1)}>
          <Text style={styles.buttonText}>Atualizar consultas</Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Mercados Aave observados</Text>
        <Text style={styles.small}>Informações lidas do protocolo; não são ofertas, cotação de juros nem autorização para investir.</Text>
        {marketIssue ? <Text style={styles.notice}>{marketIssue}</Text> : null}
        {usable.length ? usable.slice(0, 8).map((reserve) => (
          <View key={reserve.asset} style={styles.market}>
            <Text style={styles.detail}>{prettyAddress(reserve.asset)}</Text>
            <Text style={styles.small}>LTV: {reserve.ltvBps / 100}% · Limiar de liquidação: {reserve.liquidationThresholdBps / 100}%</Text>
            <Text style={styles.tag}>{reserve.borrowingEnabled ? 'Empréstimo previsto no protocolo' : 'Empréstimo desativado'}</Text>
          </View>
        )) : !loading && !marketIssue && <Text style={styles.small}>
          {markets ? 'Consulta concluída na rede ' + markets.chainId + ', mas nenhuma reserva ativa e disponível foi retornada.' : 'Mercados ainda não consultados nesta rede.'}
        </Text>}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Preparar uma operação</Text>
        <Text style={styles.small}>A Nexa verifica sua intenção com o backend. Nenhuma quantia é movimentada nem é solicitada assinatura.</Text>
        <View style={styles.grid}>
          {([['SUPPLY', 'Aplicar'], ['BORROW', 'Crédito'], ['REPAY', 'Amortizar'], ['WITHDRAW', 'Retirar']] as const).map(([key, title]) => (
            <Pressable key={key} accessibilityRole="button" onPress={() => { setAction(key); setPlan(null); setPlanIssue(''); }}
              style={[styles.option, action === key && { borderWidth: 1, borderColor: colors.cyan }]}>
              <Text style={styles.optionTitle}>{title}</Text>
            </Pressable>
          ))}
        </View>
        {actionReserves.slice(0, 8).map((reserve) => (
          <Pressable key={reserve.asset} accessibilityRole="button" style={styles.market}
            onPress={() => { setSelectedAsset(reserve.asset); setPlan(null); setPlanIssue(''); }}>
            <Text style={styles.detail}>{chosen?.asset === reserve.asset ? '◉' : '○'} {prettyAddress(reserve.asset)}</Text>
            <Text style={styles.small}>{reserve.decimals} casas decimais · rede {markets?.chainId}</Text>
          </Pressable>
        ))}
        <Text style={styles.detail}>Quantidade do ativo</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" accessibilityLabel="Quantidade de ativo"
          value={amount} onChangeText={(v) => { setAmount(v); setPlan(null); setPlanIssue(''); }} />
        <Pressable accessibilityRole="button" disabled={planning || !chosen} accessibilityState={{ disabled: planning || !chosen }}
          style={[styles.button, !chosen && styles.buttonDisabled]}
          onPress={() => { if (chosen) void preparePlan(chosen); }}>
          <Text style={styles.buttonText}>{planning ? 'Verificando…' : 'Verificar intenção'}</Text>
        </Pressable>
        {planIssue ? <Text style={styles.notice}>{planIssue}</Text> : null}
        {plan && <Text style={styles.notice}>Intenção validada. Para executar serão necessários cotação de risco atualizada, autorização expressa da carteira e habilitação do serviço. Nenhuma operação foi executada.</Text>}
        {!chosen && <Text style={styles.small}>{marketIssue
          ? 'Verificar intenção está desativado porque não há mercado real consultado. ' + marketIssue
          : 'Nenhuma reserva elegível para esta operação na consulta atual. Verificar intenção está desativado; execução também permanece desativada.'}</Text>}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Teste o risco antes de decidir</Text>
        <Text style={styles.small}>Simulação local educativa, disponível mesmo sem conexão com o Aave. Referência hipotética de LTV de 60%; não utiliza preços de mercado, oráculo Chainlink nem parâmetros reais de crédito.</Text>
        <Text style={styles.detail}>Garantia hipotética (USD)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={collateral} onChangeText={(v) => { setCollateral(v); setSimulation(null); setSimulationIssue(''); }} accessibilityLabel="Garantia em dólares" />
        <Text style={styles.detail}>Dívida hipotética (USD)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={debt} onChangeText={(v) => { setDebt(v); setSimulation(null); setSimulationIssue(''); }} accessibilityLabel="Dívida em dólares" />
        <Text style={styles.detail}>Queda simulada (%)</Text>
        <TextInput style={styles.input} keyboardType="number-pad" value={drop} onChangeText={(v) => { setDrop(v); setSimulation(null); setSimulationIssue(''); }} accessibilityLabel="Queda percentual" />
        <Pressable accessibilityRole="button" style={styles.button} onPress={simulate}>
          <Text style={styles.buttonText}>Simular cenário</Text>
        </Pressable>
        {simulationIssue ? <Text style={styles.notice}>{simulationIssue}</Text> : null}
        {simulation && <View style={styles.market}>
          <Text style={styles.optionTitle}>Resultado da simulação hipotética</Text>
          <Text style={styles.detail}>Garantia após queda: US$ {simulation.stressedCollateralUsd.toFixed(2)}</Text>
          <Text style={styles.detail}>LTV inicial: {simulation.originalLtvPercent.toFixed(1)}%</Text>
          <Text style={styles.detail}>LTV após queda: {simulation.stressedLtvPercent === null ? 'sem garantia restante para cobrir a dívida' : simulation.stressedLtvPercent.toFixed(1) + '%'}</Text>
          <Text style={styles.notice}>{simulation.outsideReferenceLtv ? 'O cenário ultrapassa a referência hipotética de 60%.' : 'O cenário está dentro da referência hipotética de 60%.'}</Text>
          <Text style={styles.small}>Não é cotação, recomendação de crédito ou cálculo real de liquidação Aave.</Text>
        </View>}
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
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  input: { color: colors.text, borderColor: '#475569', borderWidth: 1, borderRadius: 9, padding: 10, fontSize: 16 },
  market: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 11, gap: 4 },
  foot: { color: colors.text, opacity: 0.7, fontSize: 12, lineHeight: 19 },
});
