import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import { colors } from '@/theme';

type AaveStatus = {
  success: true;
  product: string;
  mode: 'INFORMATION_ONLY';
  readOnlyConfigured: boolean;
  executionEnabled: false;
  supplyEnabled: false;
  borrowEnabled: false;
  repayEnabled: false;
  withdrawEnabled: false;
  message: string;
};

/** Preview-only screen. No signing, balances, approvals or transactions. */
export default function AaveInfoScreen() {
  const [status, setStatus] = useState<AaveStatus | null>(null);
  const [message, setMessage] = useState('Consultando a disponibilidade da Aave...');
  useEffect(() => {
    const controller = new AbortController();
    async function fetchStatus() {
      try {
        const session = await loadNexaSession();
        if (!session?.accessToken) throw new Error('Entre na sua conta Nexa para consultar.');
        const base = config.apiUrl.replace(/\/$/, '');
        if (!/^https:\/\//.test(base)) throw new Error('API segura indisponível.');
        const response = await fetch(base + '/invest-credit/aave/status', {
          headers: { Authorization: 'Bearer ' + session.accessToken },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Consulta indisponível neste momento.');
        const data: AaveStatus = await response.json();
        if (data.success !== true || data.mode !== 'INFORMATION_ONLY' ||
          data.executionEnabled !== false || data.supplyEnabled !== false ||
          data.borrowEnabled !== false || data.repayEnabled !== false ||
          data.withdrawEnabled !== false) {
          throw new Error('Resposta inesperada. Operações não disponíveis.');
        }
        if (!controller.signal.aborted) {
          setStatus(data);
          setMessage('Aplicações e empréstimos ainda não estão disponíveis.');
        }
      } catch {
        if (!controller.signal.aborted) setMessage('Aave em preparação. Nenhuma operação financeira está habilitada.');
      }
    }
    void fetchStatus();
    return () => controller.abort();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>NEXA INVEST & CREDIT</Text>
      <Text style={styles.heading}>Aave</Text>
      <Text style={styles.body}>Acompanhe a preparação das aplicações e empréstimos com ativos digitais.</Text>
      <View style={styles.options}>
        {[
          {title: 'Fazer render', description: 'Explore formas de aplicar seus ativos.'},
          {title: 'Obter crédito', description: 'Entenda as possibilidades de usar cripto como garantia.'},
          {title: 'Movimentar', description: 'Acompanhe aplicações, amortizações e retiradas.'},
          {title: 'Acompanhar', description: 'Consulte informações de posições, custos e riscos.'},
        ].map((option) => (
          <View key={option.title} style={styles.option}>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionText}>{option.description}</Text>
            <Text style={styles.optionStatus}>Em preparação</Text>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Disponibilidade</Text>
        {!status && <ActivityIndicator color={colors.cyan} />}
        <Text style={styles.body}>{message}</Text>
        <Text style={styles.detail}>Consultas informativas: {status?.readOnlyConfigured ? 'configuradas' : 'em preparação'}</Text>
        <Text style={styles.detail}>Aplicar • Emprestar • Amortizar • Retirar: indisponíveis</Text>
      </View>
      <Text style={styles.foot}>Nenhum valor é depositado, emprestado ou movimentado nesta tela. Não há rendimento garantido.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: colors.background, gap: 18 },
  eyebrow: { color: colors.cyan, fontSize: 12, letterSpacing: 1.5, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 36, fontWeight: '800' },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { width: '47%', minWidth: 130, flexGrow: 1, backgroundColor: '#0B2539', borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: '#23435D' },
  optionTitle: { color: colors.text, fontWeight: '700', fontSize: 17 },
  optionText: { color: colors.text, opacity: 0.8, fontSize: 13, lineHeight: 19 },
  optionStatus: { color: colors.cyan, fontSize: 12, fontWeight: '700' },
  panel: { borderWidth: 1, borderColor: '#334155', borderRadius: 16, padding: 20, gap: 12 },
  panelTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  detail: { color: colors.text, fontSize: 14 },
  foot: { color: colors.text, opacity: 0.7, fontSize: 13, lineHeight: 20 },
});
