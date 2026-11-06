import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { normalizeMayaReadOnlyActivity, MayaReadOnlyActivity } from '@/maya-actions/financeReadOnly';
import { colors, spacing } from '@/theme';

type ActivitySource = {
  id: 'fiat_deposits' | 'pix_redemptions' | 'orders';
  title: string;
  result: MayaReadOnlyActivity | null;
  error?: string;
};

const SOURCES: Array<{ id: ActivitySource['id']; title: string }> = [
  { id: 'fiat_deposits', title: 'Entradas em reais na Nexa' },
  { id: 'pix_redemptions', title: 'Resgates via Pix na Nexa' },
  { id: 'orders', title: 'Ordens de conversão Nexa' },
];

export default function MayaReadOnlyFinanceScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<ActivitySource[]>([]);
  const [notice, setNotice] = useState('Verificando sua conta...');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) { if (alive) router.replace('/sign-in'); return; }
        await nexaApi.me(session.accessToken);
        if (alive) {
          setAuthenticated(true);
          setNotice('Toque para consultar registros da sua conta Nexa. A Maya não inicia transações.');
        }
      } catch {
        if (alive) setNotice('Sessão não verificada. Entre novamente na Nexa.');
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function consult() {
    if (!authenticated || busy) return;
    setBusy(true);
    setSources([]);
    setNotice('Consultando somente os registros de sua conta Nexa...');
    try {
      const session = await loadNexaSession();
      if (!session) {
        setAuthenticated(false);
        router.replace('/sign-in');
        return;
      }
      // Recheck the currently authenticated identity on every explicit refresh.
      await nexaApi.me(session.accessToken);
      const response = await Promise.allSettled([
        nexaApi.listFiatDeposits(session.accessToken),
        nexaApi.listPixRedemptions(session.accessToken),
        nexaApi.listOrders(session.accessToken),
      ]);
      const summaries: ActivitySource[] = SOURCES.map((source, index) => {
        const settled = response[index];
        if (settled.status !== 'fulfilled') {
          return { ...source, result: null, error: 'Não foi possível consultar esta origem.' };
        }
        const normalized = normalizeMayaReadOnlyActivity(settled.value);
        return {
          ...source,
          result: normalized,
          ...(normalized ? {} : { error: 'Formato de resposta não disponível para resumo.' }),
        };
      });
      setSources(summaries);
      setNotice('Consulta concluída. Mostramos apenas os registros que a API retornou, sem estimar saldos.');
    } catch {
      setSources([]);
      setNotice('Não foi possível confirmar sua sessão ou consultar as movimentações. Nenhum dado foi alterado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Maya · Movimentações</Text>
      <Text style={styles.description}>Consulte depósitos, resgates Pix e ordens que já constam na Nexa. É uma leitura pontual, sem envio de dinheiro, transferências ou criação de cobranças.</Text>
      <Text style={styles.warning}>Esta tela não mostra saldo consolidado, rendimento nem contas de outros bancos. A conexão Open Finance depende de ativação e consentimento próprios.</Text>
      <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>
      {checking && <ActivityIndicator color={colors.primary} />}
      <Pressable accessibilityRole="button" disabled={!authenticated || busy}
        onPress={() => { void consult(); }} style={[styles.button, (!authenticated || busy) && styles.disabled]}>
        <Text style={styles.buttonText}>{busy ? 'Consultando...' : 'Consultar minha atividade Nexa'}</Text>
      </Pressable>
      {sources.map(source => (
        <View style={styles.panel} key={source.id}>
          <Text style={styles.title}>{source.title}</Text>
          {source.error ? (
            <Text style={styles.warning}>{source.error}</Text>
          ) : source.result ? (
            <>
              <Text style={styles.description}>Registros retornados nesta consulta: {source.result.returnedCount}</Text>
              {source.result.returnedCount === 0 && (
                <Text style={styles.description}>Nenhum registro retornado por esta origem; isso não representa seu saldo.</Text>
              )}
              {source.result.recent.map((item, index) => (
                <View key={index} style={styles.entry}>
                  <Text style={styles.entryText}>Registro {index + 1} · {item.status}</Text>
                  {item.dateLabel && <Text style={styles.description}>Data informada: {item.dateLabel}</Text>}
                </View>
              ))}
            </>
          ) : null}
        </View>
      ))}
      <Text style={styles.description}>Dados exibidos somente durante esta consulta no aparelho. A Maya não salva extratos neste módulo nem compartilha seus registros com sites externos.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 21 },
  warning: { color: '#E6BE7A', lineHeight: 21 },
  notice: { color: '#40BDF0', lineHeight: 21 },
  panel: { borderWidth: 1, borderColor: '#35506B', borderRadius: 12, padding: 14, gap: 10 },
  entry: { borderTopWidth: 1, borderTopColor: '#27405B', paddingTop: 8 },
  entryText: { color: colors.text },
  button: { backgroundColor: '#2777CC', padding: 14, alignItems: 'center', borderRadius: 10 },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
