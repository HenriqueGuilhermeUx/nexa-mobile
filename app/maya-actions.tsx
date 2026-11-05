import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { ensureNexaNotificationPermission, scheduleNexaReminder, cancelNexaReminder } from '@/lib/nexaNotifications';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { colors, spacing } from '@/theme';

type ActionKind = 'reminder' | 'budget' | 'report';
type SavedTask = { id: string; kind: ActionKind; description: string; done: boolean; remindAt?: string; notificationId?: string };

function parseBrazilianReminder(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const at = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (at.getFullYear() !== Number(year) || at.getMonth() !== Number(month) - 1 ||
      at.getDate() !== Number(day) || at.getHours() !== Number(hour) ||
      at.getMinutes() !== Number(minute) || at.getTime() <= Date.now() + 60_000) return null;
  return at;
}
const choices: { key: ActionKind; title: string; description: string }[] = [
  { key: 'reminder', title: 'Lembrete', description: 'Preparar um lembrete para uma conta ou compromisso.' },
  { key: 'budget', title: 'Orçamento', description: 'Organizar uma meta de gastos para revisar.' },
  { key: 'report', title: 'Relatório', description: 'Preparar um resumo do que você quer acompanhar.' },
];

export default function MayaActionsScreen() {
  const [kind, setKind] = useState<ActionKind>('reminder');
  const [description, setDescription] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ kind: ActionKind; description: string; remindAt?: string } | null>(null);
  const [storageKey, setStorageKey] = useState('');
  const [tasks, setTasks] = useState<SavedTask[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) { if (active) setStatus('Entre na Nexa para usar suas tarefas.'); return; }
        const profile = await nexaApi.me(session.accessToken);
        const user = profile?.user || profile || {};
        const userId = String(user.id || user.userId || user.email || '');
        if (!userId) { if (active) setStatus('Não foi possível identificar sua conta.'); return; }
        const key = 'maya-actions-v1:' + userId.toLowerCase();
        const raw = await AsyncStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!active) return;
        setStorageKey(key);
        setTasks(Array.isArray(parsed) ? parsed.filter((item: any) => item && typeof item.id === 'string' && typeof item.description === 'string' && (item.kind === 'reminder' || item.kind === 'budget' || item.kind === 'report')).slice(0, 50) : []);
      } catch { if (active) setStatus('Não foi possível carregar suas tarefas locais.'); }
    })();
    return () => { active = false; };
  }, []);
  async function persist(next: SavedTask[]): Promise<boolean> {
    if (!storageKey) return false;
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setTasks(next); setStatus('Tarefas salvas neste dispositivo.'); return true; }
    catch { setStatus('Falha ao salvar. Tente novamente.'); return false; }
  }
  async function confirmDraft() {
    if (!draft || !storageKey || busy || tasks.length >= 50) return;
    setBusy(true);
    let notificationId: string | undefined;
    try {
      let scheduled: Date | null = null;
      if (draft.kind === 'reminder') {
        scheduled = parseBrazilianReminder(draft.remindAt || '');
        if (!scheduled) { setStatus('Informe uma data futura válida (DD/MM/AAAA HH:mm).'); return; }
        const permission = await ensureNexaNotificationPermission();
        if (!permission.granted) { setStatus('Permissão negada. Não foi criado nenhum lembrete.'); return; }
        notificationId = await scheduleNexaReminder({
          title: 'Lembrete da Maya',
          body: 'Abra a Nexa para consultar seu lembrete.',
          at: scheduled,
          data: { source: 'maya_actions', taskType: 'reminder' },
        });
      }
      const task: SavedTask = {
        id: String(Date.now()) + '-' + Math.random().toString(36).slice(2),
        kind: draft.kind, description: draft.description, done: false,
        ...(scheduled ? { remindAt: scheduled.toISOString(), notificationId } : {}),
      };
      const saved = await persist([task, ...tasks]);
      if (!saved) {
        if (notificationId) await cancelNexaReminder(notificationId);
        return;
      }
      setDraft(null); setDescription(''); setRemindAt('');
      setStatus(scheduled ? 'Lembrete agendado neste aparelho.' : 'Tarefa salva neste aparelho.');
    } catch {
      if (notificationId) await cancelNexaReminder(notificationId).catch(() => undefined);
      setStatus('Não foi possível agendar. Nenhum lembrete foi salvo.');
    } finally { setBusy(false); }
  }
  async function setTaskDone(task: SavedTask) {
    if (busy) return;
    setBusy(true);
    try {
      const done = !task.done;
      const next = tasks.map(item => item.id === task.id ? { ...item, done } : item);
      const saved = await persist(next);
      if (saved && done && task.notificationId) await cancelNexaReminder(task.notificationId);
      if (saved && !done && task.notificationId) setStatus('Tarefa reaberta. O lembrete cancelado não é reagendado automaticamente.');
    } catch { setStatus('Tarefa atualizada, mas a notificação pode continuar ativa.'); }
    finally { setBusy(false); }
  }
  async function removeTask(task: SavedTask) {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await persist(tasks.filter(item => item.id !== task.id));
      if (saved && task.notificationId) await cancelNexaReminder(task.notificationId);
    } catch { setStatus('Tarefa excluída, mas a notificação pode continuar ativa.'); }
    finally { setBusy(false); }
  }
  const selected = choices.find(item => item.key === kind)!;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Maya · Actions</Text>
      <Text style={styles.description}>Crie tarefas ou agende lembretes locais com confirmação. Tudo permanece neste dispositivo; não há sincronização nem pagamentos automáticos.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/maya-shopping' as any)} style={styles.choice}>
        <Text style={styles.title}>Pesquisar preços na web</Text>
        <Text style={styles.description}>Abrir ofertas em lojas para comparar com sua revisão. Sem compras automáticas.</Text>
      </Pressable>
      {choices.map(item => (
        <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ selected: kind === item.key }} onPress={() => { setKind(item.key); setDraft(null); }} style={[styles.choice, kind === item.key && styles.active]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Pressable>
      ))}
      <Text style={styles.title}>O que você precisa?</Text>
      <TextInput accessibilityLabel="Descrição da tarefa" placeholder="Ex.: lembrar de pagar a internet dia 10" placeholderTextColor={colors.muted} value={description} onChangeText={value => { setDescription(value); setDraft(null); }} multiline maxLength={500} style={styles.input} />
      {kind === 'reminder' && (
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Quando devo lembrar?</Text>
          <TextInput accessibilityLabel="Data e hora do lembrete" placeholder="DD/MM/AAAA HH:mm" placeholderTextColor={colors.muted} value={remindAt} onChangeText={value => { setRemindAt(value); setDraft(null); }} keyboardType="numbers-and-punctuation" maxLength={16} style={styles.input} />
          <Text style={styles.description}>Data e hora locais; um lembrete futuro. Será necessário permitir notificações.</Text>
        </View>
      )}
      <Pressable accessibilityRole="button" disabled={!description.trim() || (kind === 'reminder' && !parseBrazilianReminder(remindAt))} onPress={() => setDraft({ kind, description: description.trim(), remindAt: kind === 'reminder' ? remindAt : undefined })} style={[styles.button, !description.trim() && styles.disabled]}>
        <Text style={styles.buttonText}>Preparar tarefa para revisão</Text>
      </Pressable>
      {!!status && <Text accessibilityRole="alert" style={styles.notice}>{status}</Text>}
      {tasks.map(task => (
        <View key={task.id} style={styles.preview}>
          <Text style={styles.title}>{task.done ? 'Concluída' : 'Pendente'} · {choices.find(item => item.key === task.kind)?.title}</Text>
          <Text style={styles.description}>{task.description}</Text>
          {task.remindAt && <Text style={styles.description}>Lembrete: {new Date(task.remindAt).toLocaleString('pt-BR')}</Text>}
          <Pressable accessibilityRole="button" onPress={() => { void setTaskDone(task); }}><Text style={styles.cancel}>{task.done ? 'Reabrir' : 'Marcar como concluída'}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { void removeTask(task); }}><Text style={styles.cancel}>Excluir tarefa</Text></Pressable>
        </View>
      ))}
      {draft && (
        <View style={styles.preview}>
          <Text style={styles.title}>Rascunho — não executado</Text>
          <Text style={styles.description}>Tipo: {selected.title}</Text>
          <Text style={styles.description}>{draft.description}</Text>
          {draft.kind === 'reminder' && <Text style={styles.description}>Data e hora: {draft.remindAt}</Text>}
          <Text style={styles.notice}>{draft.kind === 'reminder' ? 'Após sua confirmação, será agendada uma notificação local no aparelho.' : 'A tarefa será salva apenas neste dispositivo.'} Não executa pagamentos ou ações externas.</Text>
          <Pressable accessibilityRole="button" disabled={!storageKey || tasks.length >= 50 || busy} onPress={() => { void confirmDraft(); }} style={[styles.button, !storageKey && styles.disabled]}><Text style={styles.buttonText}>Confirmar e salvar tarefa</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setDraft(null)}><Text style={styles.cancel}>Descartar rascunho</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { color: colors.text, fontSize: 25, fontWeight: '800' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 21 },
  choice: { borderColor: '#34506B', borderWidth: 1, borderRadius: 12, padding: 14, gap: 5 },
  active: { borderColor: '#40BDF0', backgroundColor: '#102A41' },
  input: { minHeight: 105, borderColor: '#34506B', borderWidth: 1, borderRadius: 12, padding: 14, color: colors.text, textAlignVertical: 'top' },
  button: { backgroundColor: '#2777CC', borderRadius: 12, padding: 15, alignItems: 'center' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  preview: { borderWidth: 1, borderColor: '#34506B', borderRadius: 12, padding: 15, gap: 10 },
  notice: { color: '#E6BE7A', lineHeight: 20 },
  cancel: { color: '#40BDF0', fontWeight: '700' },
});
