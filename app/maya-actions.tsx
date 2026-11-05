import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { colors, spacing } from '@/theme';

type ActionKind = 'reminder' | 'budget' | 'report';
type SavedTask = { id: string; kind: ActionKind; description: string; done: boolean };
const choices: { key: ActionKind; title: string; description: string }[] = [
  { key: 'reminder', title: 'Lembrete', description: 'Preparar um lembrete para uma conta ou compromisso.' },
  { key: 'budget', title: 'Orçamento', description: 'Organizar uma meta de gastos para revisar.' },
  { key: 'report', title: 'Relatório', description: 'Preparar um resumo do que você quer acompanhar.' },
];

export default function MayaActionsScreen() {
  const [kind, setKind] = useState<ActionKind>('reminder');
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState<{ kind: ActionKind; description: string } | null>(null);
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
  async function persist(next: SavedTask[]) {
    if (!storageKey) return;
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setTasks(next); setStatus('Tarefas salvas neste dispositivo.'); }
    catch { setStatus('Falha ao salvar. Tente novamente.'); }
  }
  const selected = choices.find(item => item.key === kind)!;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Maya · Actions</Text>
      <Text style={styles.description}>Prepare uma tarefa com a Maya. Salve e conclua tarefas neste dispositivo. Não há sincronização, envio externo ou agendamento automático.</Text>
      {choices.map(item => (
        <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ selected: kind === item.key }} onPress={() => { setKind(item.key); setDraft(null); }} style={[styles.choice, kind === item.key && styles.active]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Pressable>
      ))}
      <Text style={styles.title}>O que você precisa?</Text>
      <TextInput accessibilityLabel="Descrição da tarefa" placeholder="Ex.: lembrar de pagar a internet dia 10" placeholderTextColor={colors.muted} value={description} onChangeText={value => { setDescription(value); setDraft(null); }} multiline maxLength={500} style={styles.input} />
      <Pressable accessibilityRole="button" disabled={!description.trim()} onPress={() => setDraft({ kind, description: description.trim() })} style={[styles.button, !description.trim() && styles.disabled]}>
        <Text style={styles.buttonText}>Preparar tarefa para revisão</Text>
      </Pressable>
      {!!status && <Text accessibilityRole="alert" style={styles.notice}>{status}</Text>}
      {tasks.map(task => (
        <View key={task.id} style={styles.preview}>
          <Text style={styles.title}>{task.done ? 'Concluída' : 'Pendente'} · {choices.find(item => item.key === task.kind)?.title}</Text>
          <Text style={styles.description}>{task.description}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void persist(tasks.map(item => item.id === task.id ? { ...item, done: !item.done } : item)); }}><Text style={styles.cancel}>{task.done ? 'Reabrir' : 'Marcar como concluída'}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { void persist(tasks.filter(item => item.id !== task.id)); }}><Text style={styles.cancel}>Excluir tarefa</Text></Pressable>
        </View>
      ))}
      {draft && (
        <View style={styles.preview}>
          <Text style={styles.title}>Rascunho — não executado</Text>
          <Text style={styles.description}>Tipo: {selected.title}</Text>
          <Text style={styles.description}>{draft.description}</Text>
          <Text style={styles.notice}>A tarefa será salva apenas neste dispositivo. Não gera notificações, pagamentos nem ações externas.</Text>
          <Pressable accessibilityRole="button" disabled={!storageKey || tasks.length >= 50} onPress={() => { void persist([{ id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), kind: draft.kind, description: draft.description, done: false }, ...tasks]); setDraft(null); setDescription(''); }} style={[styles.button, !storageKey && styles.disabled]}><Text style={styles.buttonText}>Confirmar e salvar tarefa</Text></Pressable>
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
