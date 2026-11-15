import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

// Only existing authenticated, account-scoped data is read. This screen never
// modifies saved reminders, notifications, goals or balances.
type LocalTask = { id: string; kind: 'reminder' | 'budget' | 'report'; description: string; done: boolean; remindAt?: string };
type LocalGoal = { id: string; title: string; targetCents: number; savedCents: number; createdAt: string };

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function parseTasks(value: string | null): LocalTask[] {
  try {
    const raw: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(raw)) return [];
    return raw.filter((t: any): t is LocalTask =>
      t && typeof t.id === 'string' && typeof t.description === 'string' &&
      t.description.length <= 500 && typeof t.done === 'boolean' &&
      ['reminder', 'budget', 'report'].includes(t.kind) &&
      (t.remindAt === undefined || typeof t.remindAt === 'string')
    ).slice(0, 50);
  } catch { return []; }
}

function parseGoals(value: string | null): LocalGoal[] {
  try {
    const raw: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(raw)) return [];
    return raw.filter((g: any): g is LocalGoal =>
      g && typeof g.id === 'string' && typeof g.title === 'string' &&
      Number.isSafeInteger(g.targetCents) && g.targetCents > 0 &&
      Number.isSafeInteger(g.savedCents) && g.savedCents >= 0 &&
      g.savedCents <= g.targetCents && typeof g.createdAt === 'string'
    ).slice(0, 20);
  } catch { return []; }
}

export default function MayaTodayScreen() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [goals, setGoals] = useState<LocalGoal[]>([]);
  const [status, setStatus] = useState('Carregando seu dia...');
  const [ready, setReady] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) { if (active) router.replace('/sign-in'); return; }
        const result = await nexaApi.me(session.accessToken);
        const user = result?.user || result || {};
        const id = String(user.id || user.userId || user.email || '').trim().toLowerCase();
        if (!id) throw new Error('missing user identity');
        const [taskData, goalData] = await Promise.all([
          AsyncStorage.getItem('maya-actions-v1:' + id),
          AsyncStorage.getItem('maya-planning-v1:' + id),
        ]);
        if (!active) return;
        setTasks(parseTasks(taskData));
        setGoals(parseGoals(goalData));
        setReady(true);
        setStatus('Seus dados abaixo estão salvos somente neste aparelho.');
      } catch {
        if (active) { setReady(false); setTasks([]); setGoals([]); setStatus('Não conseguimos carregar os dados deste aparelho. Entre novamente e tente abrir Meu dia.'); }
      }
    })();
    return () => { active = false; };
  }, []));

  const pending = tasks.filter(t => !t.done);
  const completed = tasks.length - pending.length;
  const scheduled = pending.filter(t => t.remindAt && !Number.isNaN(Date.parse(t.remindAt)))
    .sort((a, b) => Date.parse(a.remindAt!) - Date.parse(b.remindAt!));
  const others = pending.filter(t => !scheduled.includes(t));
  const visible = [...scheduled, ...others].slice(0, 8);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>MAYA · NEXA</Text>
      <Text style={styles.heading}>Meu dia</Text>
      <Text style={styles.subhead}>Suas tarefas e metas num só lugar, com você no controle.</Text>
      <Text accessibilityRole="alert" style={styles.notice}>{status}</Text>
      {ready && (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryItem}><Text style={styles.number}>{pending.length}</Text><Text style={styles.muted}>tarefas pendentes</Text></View>
            <View style={styles.summaryItem}><Text style={styles.number}>{completed}</Text><Text style={styles.muted}>concluídas</Text></View>
            <View style={styles.summaryItem}><Text style={styles.number}>{goals.length}</Text><Text style={styles.muted}>metas locais</Text></View>
          </View>

          <View style={styles.section}>
            <View style={styles.headingRow}><Text style={styles.sectionTitle}>Tarefas</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/maya-actions')}><Text style={styles.link}>Abrir tarefas ›</Text></Pressable>
            </View>
            {visible.length === 0 ? <Text style={styles.muted}>Nenhuma tarefa pendente neste aparelho.</Text> :
              visible.map(item => (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.itemText}>{item.description}</Text>
                  {item.remindAt && !Number.isNaN(Date.parse(item.remindAt)) &&
                    <Text style={styles.muted}>Lembrete: {new Date(item.remindAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>}
                </View>
              ))}
            {pending.length > visible.length && <Text style={styles.muted}>Há mais tarefas na lista completa.</Text>}
            <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push('/maya-actions')}>
              <Text style={styles.actionText}>Criar ou revisar tarefa</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.headingRow}><Text style={styles.sectionTitle}>Metas</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/maya-planning')}><Text style={styles.link}>Abrir metas ›</Text></Pressable>
            </View>
            {goals.length === 0 ? <Text style={styles.muted}>Nenhuma meta criada neste aparelho.</Text> :
              goals.slice(0, 4).map(goal => {
                const progress = Math.min(100, Math.round(100 * goal.savedCents / goal.targetCents));
                return (
                  <View key={goal.id} style={styles.item}>
                    <Text style={styles.itemText}>{goal.title}</Text>
                    <Text style={styles.muted}>{money(goal.savedCents)} de {money(goal.targetCents)} · {progress}% informado manualmente</Text>
                    <View style={styles.bar}><View style={[styles.progress, { width: `${progress}%` as `${number}%` }]} /></View>
                  </View>
                );
              })}
            <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push('/maya-planning')}>
              <Text style={styles.actionText}>Planejar ou atualizar meta</Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>Esta visão não sincroniza dados entre aparelhos e não representa saldo, depósitos ou investimentos reais. Nenhuma movimentação é executada.</Text>
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 36, gap: 10 },
  eyebrow: { color: colors.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heading: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subhead: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  notice: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  summary: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  summaryItem: { flex: 1, backgroundColor: '#0f172a', borderRadius: 13, padding: 10 },
  number: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  section: { borderColor: '#243449', borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, backgroundColor: '#0b1625' },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  link: { color: colors.cyan, fontSize: 12, fontWeight: '700' },
  item: { borderTopWidth: 1, borderColor: '#25324a', paddingTop: 9, gap: 4 },
  itemText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  action: { padding: 12, backgroundColor: '#16456C', borderRadius: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bar: { height: 7, borderRadius: 8, backgroundColor: '#25324a', overflow: 'hidden' },
  progress: { height: '100%', backgroundColor: colors.cyan, borderRadius: 8 },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
