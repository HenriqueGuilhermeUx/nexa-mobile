import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

type Goal = { id: string; title: string; targetCents: number; savedCents: number; createdAt: string };
const MAX_GOALS = 20;

function parseBrlCents(value: string): number | null {
  const cleaned = value.trim();
  if (!/^\d{1,7}(?:,\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned.replace(',', '.')) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MayaPlanningScreen() {
  const [key, setKey] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [contributionFor, setContributionFor] = useState('');
  const [contribution, setContribution] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Carregando seu planejamento...');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) { if (active) router.replace('/sign-in'); return; }
        const response = await nexaApi.me(session.accessToken);
        const user = response?.user || response || {};
        const id = String(user.id || user.userId || user.email || '').trim().toLowerCase();
        if (!id) throw new Error('Account missing');
        const storageKey = 'maya-planning-v1:' + id;
        const raw = await AsyncStorage.getItem(storageKey);
        const data: unknown = raw ? JSON.parse(raw) : [];
        if (!active) return;
        setKey(storageKey);
        setGoals(Array.isArray(data) ? data.filter((item: any) =>
          item && typeof item.id === 'string' && typeof item.title === 'string' &&
          Number.isSafeInteger(item.targetCents) && item.targetCents > 0 &&
          Number.isSafeInteger(item.savedCents) && item.savedCents >= 0 &&
          item.savedCents <= item.targetCents && typeof item.createdAt === 'string'
        ).slice(0, MAX_GOALS) : []);
        setNotice('Metas salvas somente neste aparelho. Nenhum dinheiro é movimentado.');
      } catch { if (active) setNotice('Não foi possível carregar as metas. Tente entrar novamente.'); }
    })();
    return () => { active = false; };
  }, []);

  async function save(next: Goal[]): Promise<boolean> {
    if (!key || busy) return false;
    setBusy(true);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
      setGoals(next);
      setNotice('Planejamento atualizado neste aparelho. Não representa saldo real.');
      return true;
    } catch {
      setNotice('Falha ao salvar. Verifique o armazenamento deste aparelho.');
      return false;
    } finally { setBusy(false); }
  }

  async function addGoal() {
    const cents = parseBrlCents(target);
    if (!cents || title.trim().length < 3 || goals.length >= MAX_GOALS) {
      setNotice('Informe um nome (mínimo 3 caracteres) e uma meta em reais válida.');
      return;
    }
    const next: Goal = {
      id: String(Date.now()) + '-' + Math.random().toString(36).slice(2),
      title: title.trim().slice(0, 100), targetCents: cents, savedCents: 0,
      createdAt: new Date().toISOString()
    };
    if (await save([next, ...goals])) { setTitle(''); setTarget(''); }
  }

  async function registerProgress() {
    const cents = parseBrlCents(contribution);
    const item = goals.find(goal => goal.id === contributionFor);
    if (!item || !cents) { setNotice('Informe um valor positivo válido em reais.'); return; }
    const next = goals.map(goal => goal.id === item.id ?
      { ...goal, savedCents: Math.min(goal.targetCents, goal.savedCents + cents) } : goal);
    if (await save(next)) { setContributionFor(''); setContribution(''); }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Maya · Planejamento</Text>
      <Text style={styles.secondary}>Organize metas e acompanhe seu progresso. Valores informados manualmente; a Maya não faz depósitos nem conhece seu saldo bancário nesta tela.</Text>
      <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>
      <View style={styles.section}>
        <Text style={styles.headingSmall}>Nova meta</Text>
        <TextInput accessibilityLabel="Nome da meta" style={styles.input} value={title}
          placeholder="Ex.: reserva de emergência" placeholderTextColor={colors.muted}
          maxLength={100} onChangeText={setTitle} />
        <TextInput accessibilityLabel="Valor-alvo em reais" style={styles.input} value={target}
          placeholder="Valor-alvo em R$ (ex.: 1500,00)" placeholderTextColor={colors.muted}
          keyboardType="decimal-pad" maxLength={10} onChangeText={setTarget} />
        <Pressable accessibilityRole="button" disabled={!key || busy || !parseBrlCents(target)}
          onPress={() => { void addGoal(); }} style={[styles.button, (!key || busy || !parseBrlCents(target)) && styles.disabled]}>
          <Text style={styles.buttonLabel}>Criar meta</Text>
        </Pressable>
      </View>
      {goals.map(goal => {
        const percent = Math.round(100 * goal.savedCents / goal.targetCents);
        return (
          <View style={styles.section} key={goal.id}>
            <Text style={styles.headingSmall}>{goal.title}</Text>
            <Text style={styles.secondary}>{money(goal.savedCents)} de {money(goal.targetCents)} · {percent}%</Text>
            <View style={styles.bar}><View style={[styles.progress, { width: Math.min(100, percent) + '%' }]} /></View>
            <Pressable accessibilityRole="button" disabled={busy}
              onPress={() => { setContributionFor(goal.id); setContribution(''); }}
              style={styles.secondaryButton}><Text style={styles.actionText}>Registrar progresso manual</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy}
              onPress={() => Alert.alert('Excluir meta?', 'Os dados desta meta serão apagados somente deste dispositivo.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: () => { void save(goals.filter(x => x.id !== goal.id)); } }
              ])}><Text style={styles.deleteText}>Excluir meta</Text></Pressable>
          </View>
        );
      })}
      {!!contributionFor && (
        <View style={styles.section}>
          <Text style={styles.headingSmall}>Registrar progresso (não movimenta dinheiro)</Text>
          <TextInput accessibilityLabel="Valor para progresso da meta" style={styles.input}
            value={contribution} onChangeText={setContribution} placeholder="Valor em R$ (ex.: 100,00)"
            placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={10}/>
          <Pressable accessibilityRole="button" disabled={!parseBrlCents(contribution) || busy}
            style={[styles.button, (!parseBrlCents(contribution) || busy) && styles.disabled]}
            onPress={() => { void registerProgress(); }}><Text style={styles.buttonLabel}>Salvar progresso</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setContributionFor('')}><Text style={styles.actionText}>Cancelar</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  headingSmall: { color: colors.text, fontSize: 17, fontWeight: '700' },
  secondary: { color: colors.muted, lineHeight: 21 },
  notice: { color: '#E6BE7A', lineHeight: 21 },
  section: { borderColor: '#35506B', borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  input: { borderWidth: 1, borderColor: '#35506B', borderRadius: 10, padding: 13, color: colors.text },
  button: { borderRadius: 10, padding: 14, backgroundColor: '#2777CC', alignItems: 'center' },
  disabled: { opacity: 0.45 },
  buttonLabel: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { paddingVertical: 4 },
  actionText: { color: '#40BDF0', fontWeight: '700' },
  deleteText: { color: '#E6A9A9', fontWeight: '600' },
  bar: { backgroundColor: '#22364A', height: 10, borderRadius: 10, overflow: 'hidden' },
  progress: { backgroundColor: '#40BDF0', height: 10, borderRadius: 10 }
});
