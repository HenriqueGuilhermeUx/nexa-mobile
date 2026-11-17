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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
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
            ? 'Mercados Aave indisponíveis nesta consulta (HTTP 503). Não exibimos taxas ou reservas sem confirmação.'
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
      !/^\d{1,3}$/.test(drop) || Number(drop) > 100 || Number(collateral) <= 0) {
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
      if (response.status === 426) throw new Error('Versão do aplicativo não autorizada pela Nexa. Instale a versão de homologação atualizada.');
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
      <Text style={styles.body}>Conheça formas de aproveitar suas criptos e teste situações de risco. A simulação educativa está disponível. Consultas reais dependem de validação da carteira e da rede; nenhuma movimentação Aave está habilitada.</Text>
      <View style={styles.grid}>
        {[['Fazer render', 'Explorar possibilidades de rendimento', 'Conheça como funciona'],
          ['Crédito com cripto', 'Entender empréstimos usando cripto como garantia', 'Conheça os riscos'],
          ['Simular riscos', 'Veja um exemplo antes de decidir', 'Simulador disponível'],
          ['Acompanhar', 'Consultar valores e empréstimos vinculados à carteira, quando a leitura for autorizada', 'Consulta condicionada à verificação']].map(([title, description, state]) => (
          <View key={title} style={styles.option}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.small}>{description}</Text>
            <Text style={styles.tag}>{state}</Text>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>E se minha cripto perder valor?</Text>
        <Text style={styles.small}>Imagine que você use criptomoedas como garantia de um empréstimo. Veja o que aconteceria se o valor delas caísse. É apenas um exemplo, sem preços reais ou oferta de crédito.</Text>
        <Text style={styles.detail}>Valor da cripto dada como garantia (US$)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={collateral} onChangeText={(v) => { setCollateral(v); setSimulation(null); setSimulationIssue(''); }} accessibilityLabel="Garantia em dólares" />
        <Text style={styles.detail}>Valor do empréstimo (US$)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={debt} onChangeText={(v) => { setDebt(v); setSimulation(null); setSimulationIssue(''); }} accessibilityLabel="Dívida em dólares" />
        <Text style={styles.detail}>Se a cripto perder (%)</Text>
        <TextInput style={styles.input} keyboardType="number-pad" value={drop} onChangeText={(v) => { setDrop(v); setSimulation(null); setSimulationIssue(''); }} accessibilityLabel="Queda percentual" />
        <Pressable accessibilityRole="button" style={styles.button} onPress={simulate}>
          <Text style={styles.buttonText}>Simular cenário</Text>
        </Pressable>
        {simulationIssue ? <Text style={styles.notice}>{simulationIssue}</Text> : null}
        {simulation && <View style={styles.market}>
          <Text style={styles.optionTitle}>Resultado do seu exemplo</Text>
          <Text style={styles.detail}>Sua garantia passaria a valer US$ {simulation.stressedCollateralUsd.toFixed(2)}</Text>
          <Text style={styles.detail}>Antes, a dívida representava {simulation.originalLtvPercent.toFixed(1)}% da garantia.</Text>
          <Text style={styles.detail}>Depois, ela representaria {simulation.stressedLtvPercent === null ? 'mais do que o valor restante da garantia' : simulation.stressedLtvPercent.toFixed(1) + '% da garantia'}.</Text>
          <Text style={styles.notice}>{simulation.outsideReferenceLtv
            ? 'Atenção: neste exemplo, a dívida superou a referência educativa de 60%.'
            : 'Neste exemplo, a dívida ficou abaixo da referência educativa de 60%, mas ainda existem riscos.'}</Text>
          <Text style={styles.small}>Referência de 60% apenas para aprendizado, não é um limite real de empréstimo ou liquidação da Aave.</Text>
        </View>}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Meus valores no Aave</Text>
        {loading && <ActivityIndicator color={colors.cyan} />}
        {position ? (
          <>
            <Text style={styles.detail}>Rede: {position.chainId} · Carteira: {prettyAddress(position.walletAddress)}</Text>
            <Text style={styles.detail}>Indicador de segurança da posição: {position.healthFactor ?? 'Sem dívida registrada'}</Text>
            <Text style={styles.small}>Informações do protocolo em unidades-base (não são valores em reais ou dólares): {position.totalCollateralBase} / {position.totalDebtBase}</Text>
          </>
        ) : !loading && <Text style={styles.small}>
          {positionIssue ? 'Ainda não conseguimos consultar sua posição. Isso não significa que sua carteira esteja vazia.' : 'Nenhuma posição foi confirmada nesta consulta.'}
        </Text>}
        {message ? <Text style={styles.notice}>{message}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setReloadKey((v) => v + 1)}>
          <Text style={styles.buttonText}>Tentar consultar novamente</Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Opções disponíveis no Aave</Text>
        <Text style={styles.small}>Aqui aparecerão as opções de mercado após validarmos a conexão. Por enquanto, não há nenhuma oferta disponível na Nexa.</Text>
        {marketIssue ? <Text style={styles.notice}>Ainda não conseguimos consultar os mercados. Não vamos mostrar valores ou oportunidades sem confirmação.</Text> : null}
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
        <Text style={styles.panelTitle}>Como funcionariam as operações</Text>
        <Text style={styles.small}>Você poderá explorar aplicar, pedir crédito, pagar ou retirar quando o serviço estiver habilitado. A Nexa não movimenta seu dinheiro nesta tela.</Text>
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
        {chosen ? <>
          <Text style={styles.detail}>Quantidade do ativo</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" accessibilityLabel="Quantidade de ativo"
            value={amount} onChangeText={(v) => { setAmount(v); setPlan(null); setPlanIssue(''); }} />
          <Pressable accessibilityRole="button" disabled={planning} accessibilityState={{ disabled: planning }}
            style={styles.button}
            onPress={() => void preparePlan(chosen)}>
            <Text style={styles.buttonText}>{planning ? 'Verificando…' : 'Verificar intenção'}</Text>
          </Pressable>
        </> : null}
        {planIssue ? <Text style={styles.notice}>{planIssue}</Text> : null}
        {plan && <Text style={styles.notice}>Intenção validada. Para executar serão necessários cotação de risco atualizada, autorização expressa da carteira e habilitação do serviço. Nenhuma operação foi executada.</Text>}
        {!chosen && <Text style={styles.small}>Ainda não é possível escolher um ativo ou preparar uma operação. Primeiro precisamos confirmar os mercados reais. Nenhum dinheiro será movimentado nesta tela.</Text>}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setShowTechnicalDetails((v) => !v)} style={styles.technicalToggle}>
        <Text style={styles.small}>{showTechnicalDetails ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos das consultas'}</Text>
      </Pressable>
      {showTechnicalDetails ? <View style={styles.panel}>
        <Text style={styles.panelTitle}>Diagnóstico técnico</Text>
        <Text style={styles.small}>{positionIssue || 'Posição: sem falhas de leitura registradas.'}</Text>
        <Text style={styles.small}>{marketIssue || 'Mercados: sem falhas de leitura registradas.'}</Text>
        <Text style={styles.small}>{message || 'Nenhuma falha geral registrada.'}</Text>
        <Text style={styles.small}>Aave V3: consultas somente leitura. Chainlink não alimenta este simulador e não substitui o oráculo de risco Aave.</Text>
      </View> : null}
      <Text style={styles.foot}>Versão de testes: não faz investimentos, empréstimos ou transferências. Rendimento não é garantido e crédito com cripto pode gerar perdas e liquidação. As condições reais dependem do mercado e das verificações necessárias.</Text>
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
  technicalToggle: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
});
