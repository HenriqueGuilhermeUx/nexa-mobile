import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { colors, spacing } from '@/theme';

type ActionKind = 'reminder' | 'budget' | 'report';
const choices: { key: ActionKind; title: string; description: string }[] = [
  { key: 'reminder', title: 'Lembrete', description: 'Preparar um lembrete para uma conta ou compromisso.' },
  { key: 'budget', title: 'Orçamento', description: 'Organizar uma meta de gastos para revisar.' },
  { key: 'report', title: 'Relatório', description: 'Preparar um resumo do que você quer acompanhar.' },
];

export default function MayaActionsScreen() {
  const [kind, setKind] = useState<ActionKind>('reminder');
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState<{ kind: ActionKind; description: string } | null>(null);
  const selected = choices.find(item => item.key === kind)!;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Maya · Actions</Text>
      <Text style={styles.description}>Prepare uma tarefa com a Maya. Nesta primeira versão, nada é enviado, agendado ou executado automaticamente.</Text>
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
      {draft && (
        <View style={styles.preview}>
          <Text style={styles.title}>Rascunho — não executado</Text>
          <Text style={styles.description}>Tipo: {selected.title}</Text>
          <Text style={styles.description}>{draft.description}</Text>
          <Text style={styles.notice}>A criação real de tarefas exigirá conexão autenticada ao serviço, consentimento e confirmação. Nenhum lembrete foi agendado.</Text>
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
