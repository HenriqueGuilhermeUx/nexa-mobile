import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { createMayaCommunicationDraft, MayaCommunicationKind, MayaCommunicationDraft } from '@/maya-actions/communicationDraft';
import { colors, spacing } from '@/theme';

const KINDS: Array<{ kind: MayaCommunicationKind; title: string }> = [
  { kind: 'message', title: 'Mensagem' },
  { kind: 'email', title: 'E-mail' },
  { kind: 'request', title: 'Solicitação' },
];

const SUGGESTIONS: Record<MayaCommunicationKind, { subject: string; body: string }> = {
  message: {
    subject: '',
    body: 'Olá! Gostaria de conversar com você sobre [assunto]. Quando podemos falar?',
  },
  email: {
    subject: 'Solicitação de informações',
    body: 'Olá,\n\nGostaria de obter mais informações sobre [assunto].\n\nAgradeço pela atenção.',
  },
  request: {
    subject: 'Pedido de atendimento',
    body: 'Olá,\n\nSolicito orientação sobre [assunto]. Poderiam informar os próximos passos?\n\nObrigado.',
  },
};

export default function MayaCommunicationScreen() {
  const params = useLocalSearchParams<{ request?: string }>();
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<MayaCommunicationKind>('message');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState<MayaCommunicationDraft | null>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState('Verificando sua sessão...');
  const requested = typeof params.request === 'string' ? params.request.slice(0, 500) : '';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) { if (active) router.replace('/sign-in'); return; }
        await nexaApi.me(session.accessToken);
        if (active) {
          setReady(true);
          setNotice('Rascunhos não são enviados nem armazenados pela Maya.');
        }
      } catch {
        if (active) setNotice('Não consegui confirmar sua sessão. Entre na Nexa novamente.');
      }
    })();
    return () => { active = false; };
  }, []);

  function chooseKind(nextKind: MayaCommunicationKind) {
    setKind(nextKind);
    setSubject('');
    setBody('');
    setDraft(null);
  }

  function applySuggestion() {
    const example = SUGGESTIONS[kind];
    setSubject(example.subject);
    setBody(example.body);
    setDraft(null);
  }

  function preview() {
    try {
      const candidate = createMayaCommunicationDraft({ kind, subject, body });
      setDraft(candidate);
      setNotice('Confira a prévia antes de escolher onde compartilhar.');
    } catch (error) {
      setDraft(null);
      setNotice(error instanceof Error ? error.message : 'Revise o texto e tente novamente.');
    }
  }

  async function share() {
    if (!draft || !ready || sharing) return;
    setSharing(true);
    try {
      // The user owns the final action in the target app. No recipient, payment,
      // attachments or network operation is chosen by Maya.
      const result = await Share.share({
        message: draft.shareText,
        ...(draft.kind === 'email' ? { title: draft.subject } : {}),
      });
      setNotice(result.action === Share.dismissedAction
        ? 'Compartilhamento cancelado. Nenhum envio foi realizado pela Maya.'
        : 'Escolha e confirme o destinatário no aplicativo aberto. A Maya não confirma a entrega.');
    } catch {
      setNotice('Não foi possível abrir o compartilhamento. Nenhum envio foi realizado pela Maya.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Maya · Comunicação</Text>
      <Text style={styles.secondary}>Prepare mensagens, e-mails e solicitações. Você revisa o texto e decide se quer compartilhar. A Maya não envia por conta própria.</Text>
      {!ready && <ActivityIndicator color={colors.primary} />}
      <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>

      {!!requested && (
        <View style={styles.panel}>
          <Text style={styles.title}>Seu pedido à Maya</Text>
          <Text style={styles.secondary}>{requested}</Text>
          <Text style={styles.notice}>Esse pedido não foi transformado automaticamente em uma mensagem. Escreva ou adapte o texto abaixo.</Text>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.title}>Tipo de comunicação</Text>
        <View style={styles.kindRow}>
          {KINDS.map(option => (
            <Pressable key={option.kind} accessibilityRole="radio"
              accessibilityState={{ selected: kind === option.kind }}
              onPress={() => chooseKind(option.kind)}
              style={[styles.kindButton, kind === option.kind && styles.active]}>
              <Text style={styles.kindText}>{option.title}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={applySuggestion} style={styles.secondaryButton}>
          <Text style={styles.link}>Usar um modelo editável</Text>
        </Pressable>
        {kind !== 'message' && (
          <>
            <Text style={styles.title}>Assunto</Text>
            <TextInput accessibilityLabel="Assunto do rascunho" value={subject}
              maxLength={120} onChangeText={value => { setSubject(value); setDraft(null); }}
              style={styles.input} placeholder="Assunto" placeholderTextColor={colors.muted} />
          </>
        )}
        <Text style={styles.title}>Texto</Text>
        <TextInput accessibilityLabel="Texto da comunicação" value={body}
          onChangeText={value => { setBody(value); setDraft(null); }}
          maxLength={3000} multiline textAlignVertical="top" style={[styles.input, styles.messageInput]}
          placeholder="Escreva aqui a mensagem que deseja revisar"
          placeholderTextColor={colors.muted} />
        <Pressable accessibilityRole="button" disabled={!ready || sharing}
          onPress={preview} style={[styles.button, (!ready || sharing) && styles.disabled]}>
          <Text style={styles.buttonText}>Preparar prévia</Text>
        </Pressable>
      </View>

      {!!draft && (
        <View style={styles.panel}>
          <Text style={styles.title}>Prévia — ainda não enviada</Text>
          <Text selectable style={styles.previewText}>{draft.shareText}</Text>
          <Text style={styles.notice}>O destinatário e o aplicativo de destino são escolhidos por você. Não inclua senhas, códigos ou dados que não deseja compartilhar.</Text>
          <Pressable accessibilityRole="button" disabled={sharing || !ready}
            onPress={() => { void share(); }}
            style={[styles.button, (sharing || !ready) && styles.disabled]}>
            <Text style={styles.buttonText}>{sharing ? 'Abrindo opções...' : 'Compartilhar após revisar'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setDraft(null)} style={styles.secondaryButton}>
            <Text style={styles.link}>Voltar e editar</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.secondary}>Nada é salvo nesta tela. Ao sair, seu rascunho será descartado. Enviar uma mensagem depende de sua confirmação no aplicativo escolhido.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  secondary: { color: colors.muted, lineHeight: 21 },
  notice: { color: '#E6BE7A', lineHeight: 21 },
  panel: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#35506B', gap: 12 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  kindButton: { borderColor: '#35506B', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  active: { borderColor: '#40BDF0', backgroundColor: '#102A41' },
  kindText: { color: colors.text, fontWeight: '600' },
  secondaryButton: { paddingVertical: 8 },
  link: { color: '#40BDF0', fontWeight: '700' },
  input: { borderColor: '#35506B', borderWidth: 1, borderRadius: 10, padding: 12, color: colors.text },
  messageInput: { minHeight: 140 },
  button: { borderRadius: 10, padding: 14, backgroundColor: '#2777CC', alignItems: 'center' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  previewText: { color: colors.text, lineHeight: 23 },
});
