import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import {
  AssistantCapabilities,
  AssistantChatMessage,
  nexaApi,
} from '@/lib/api';
import {
  parseRecurringFundingIntent,
  recurringIntentSummary,
} from '@/lib/nexaRecurringIntent';

type Props = {
  token: string;
  firstName?: string;
};

const STARTERS = [
  { icon: '☀️', text: 'Me ajude a organizar meu dia.' },
  { icon: '✓', text: 'Quais devem ser minhas prioridades hoje?' },
  { icon: '💰', text: 'Como está meu dinheiro hoje?' },
  { icon: '🏦', text: 'Quero trazer dinheiro de outro banco.' },
  { icon: '🔁', text: 'Traga R$ 2.000 do Itaú todo dia 8.' },
];

export default function NexaAssistantOpenFinance({ token, firstName }: Props) {
  const insets = useSafeAreaInsets();
  const [capabilities, setCapabilities] = useState<AssistantCapabilities | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const lastVoiceSentRef = useRef('');
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    let alive = true;
    nexaApi
      .assistantCapabilities(token)
      .then((data) => alive && setCapabilities(data))
      .catch(() => alive && setCapabilities(null));

    return () => {
      alive = false;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
      void Speech.stop();
    };
  }, [token]);

  useEffect(() => {
    const id = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(id);
  }, [messages, loading, error, voiceError]);

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    setVoiceError('');
  });

  useSpeechRecognitionEvent('end', () => setListening(false));

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = String(event.results?.[0]?.transcript || '').trim();
    if (!transcript) return;
    setInput(transcript);
    if (event.isFinal && transcript !== lastVoiceSentRef.current) {
      lastVoiceSentRef.current = transcript;
      void send(transcript, true);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    const code = String(event.error || '');
    if (code === 'not-allowed') {
      setVoiceError('Permita o uso do microfone para conversar por voz com a Nexa.');
      return;
    }
    if (code === 'no-speech' || code === 'speech-timeout') {
      setVoiceError('Não ouvi sua voz. Toque no microfone e tente novamente.');
      return;
    }
    setVoiceError('Não consegui ouvir agora. Você pode continuar digitando.');
  });

  const enabled = capabilities?.enabled === true;
  const greeting = useMemo(
    () =>
      `Olá${firstName ? `, ${firstName}` : ''}. Posso ajudar com sua rotina, seu dinheiro e também preparar ações Open Finance com sua confirmação.`,
    [firstName],
  );

  async function speak(text: string) {
    const clean = String(text || '').trim();
    if (!clean) return;
    await Speech.stop();
    Speech.speak(clean, { language: 'pt-BR', rate: 0.96, pitch: 1 });
  }

  async function startVoice() {
    if (!enabled || loading) return;
    setError('');
    setVoiceError('');
    lastVoiceSentRef.current = '';

    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceError('Permita o microfone para conversar por voz com a Nexa.');
        return;
      }
      await Speech.stop();
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        contextualStrings: [
          'Nexa',
          'Pix',
          'Open Finance',
          'recorrente',
          'Itaú',
          'Bradesco',
          'Santander',
          'Banco do Brasil',
          'Nubank',
          'USDC',
        ],
      });
    } catch {
      setVoiceError('Não consegui iniciar o microfone agora.');
    }
  }

  async function send(text?: string, fromVoice = false) {
    const message = String(text ?? input).trim();
    if (!message || loading || !enabled) return;

    const nextMessages: AssistantChatMessage[] = [
      ...messages,
      { role: 'user', content: message },
    ];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setVoiceError('');

    const recurringIntent = parseRecurringFundingIntent(message);
    if (recurringIntent) {
      const summary = recurringIntentSummary(recurringIntent);
      const bank = recurringIntent.bankHint
        ? ` do ${recurringIntent.bankHint}`
        : '';
      const response = `Entendi: ${summary}${bank}. Vou abrir a confirmação do aporte recorrente. Nenhuma movimentação acontece sem sua confirmação na Nexa e a autorização no seu banco.`;
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response },
      ]);
      if (autoSpeak || fromVoice) await speak(response);
      router.push({
        pathname: '/open-finance-recurring',
        params: {
          amount: String(recurringIntent.amountBrl),
          day: String(recurringIntent.dayOfMonth),
          bank: recurringIntent.bankHint || '',
        },
      });
      return;
    }

    if (/\b(trazer|traz|puxar|puxa)\b.*\b(dinheiro|saldo)\b/i.test(message)) {
      const response =
        'Vou abrir “Trazer dinheiro”. Você escolhe o banco e o valor; a autorização acontece no próprio banco.';
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response },
      ]);
      if (autoSpeak || fromVoice) await speak(response);
      router.push('/open-finance');
      return;
    }

    setLoading(true);
    try {
      const history = messages.slice(-12);
      const result = await nexaApi.assistantChat(token, message, history);
      const finalAnswer =
        String(result?.response || '').trim() ||
        'Não consegui responder agora. Tente novamente.';
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: finalAnswer },
      ]);
      if (autoSpeak || fromVoice) await speak(finalAnswer);
    } catch (err: any) {
      setError(
        err?.status === 503
          ? 'O Assistente Nexa ainda não foi ativado para esta conta.'
          : err?.status === 502
            ? 'O motor do assistente está se reconectando. Tente novamente em alguns segundos.'
            : 'Não consegui falar com o Assistente Nexa agora.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (capabilities && !enabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>ASSISTENTE NEXA</Text>
        <Text style={styles.title}>Vida, rotina e dinheiro</Text>
        <Text style={styles.subtitle}>
          O Assistente ainda não foi ativado para esta conta.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ASSISTENTE NEXA</Text>
          <Text style={styles.title}>Vida, rotina e dinheiro</Text>
          <Text style={styles.subtitle}>
            Converse por texto ou voz. A Nexa pode entender seu contexto e preparar ações para você revisar.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.voiceToggle, autoSpeak && styles.voiceToggleActive]}
          onPress={() => {
            setAutoSpeak((value) => !value);
            if (autoSpeak) void Speech.stop();
          }}
        >
          <Text style={styles.voiceToggleText}>{autoSpeak ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.safetyBox}>
        <Text style={styles.safetyText}>
          Movimentações financeiras só acontecem após sua confirmação na Nexa e, quando necessário, autorização no seu banco.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <>
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>{greeting}</Text>
            </View>
            <Text style={styles.sectionLabel}>EXPERIMENTE</Text>
            {STARTERS.map((starter) => (
              <TouchableOpacity
                key={starter.text}
                style={styles.starter}
                onPress={() => void send(starter.text)}
                disabled={loading || !enabled}
              >
                <Text style={styles.starterIcon}>{starter.icon}</Text>
                <Text style={styles.starterText}>{starter.text}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          messages.map((item, index) => (
            <View
              key={`${item.role}-${index}`}
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={item.role === 'user' ? styles.userText : styles.assistantText}
              >
                {item.content}
              </Text>
              {item.role === 'assistant' ? (
                <TouchableOpacity onPress={() => void speak(item.content)}>
                  <Text style={styles.listenAgain}>🔊 Ouvir</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
        {loading ? (
          <View style={[styles.bubble, styles.assistantBubble, styles.loading]}>
            <ActivityIndicator size="small" />
            <Text style={styles.assistantText}> Pensando…</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
      </ScrollView>

      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom + 6, 14) },
        ]}
      >
        <TouchableOpacity
          style={[styles.mic, listening && styles.micListening]}
          onPress={startVoice}
          disabled={!enabled || loading}
        >
          <Text style={styles.micText}>{listening ? '■' : '🎙️'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={listening ? 'Estou ouvindo…' : 'Pergunte qualquer coisa…'}
          placeholderTextColor="#64748b"
          multiline
          editable={enabled && !loading && !listening}
          maxLength={12000}
        />
        <TouchableOpacity
          style={[
            styles.send,
            (!enabled || loading || !input.trim()) && styles.disabled,
          ]}
          onPress={() => void send()}
          disabled={!enabled || loading || !input.trim()}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 2 },
  headerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  eyebrow: {
    color: '#8b5cf6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    marginTop: 4,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  voiceToggle: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  voiceToggleActive: { borderColor: '#7c3aed', backgroundColor: '#211241' },
  voiceToggleText: { fontSize: 18 },
  safetyBox: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
  },
  safetyText: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  messages: { flex: 1 },
  messagesContent: { paddingVertical: 8, paddingBottom: 16 },
  sectionLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginVertical: 8,
  },
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#0f172a',
    marginBottom: 8,
  },
  starterIcon: { fontSize: 17, width: 25, textAlign: 'center' },
  starterText: { flex: 1, color: '#cbd5e1', fontSize: 13 },
  bubble: {
    maxWidth: '90%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 9,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#243047',
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6d28d9' },
  assistantText: { color: '#e2e8f0', lineHeight: 20 },
  userText: { color: '#ffffff', lineHeight: 20 },
  listenAgain: { color: '#a78bfa', fontSize: 11, fontWeight: '700', marginTop: 9 },
  loading: { flexDirection: 'row', alignItems: 'center' },
  error: { color: '#fca5a5', marginTop: 6, lineHeight: 19 },
  voiceError: { color: '#fdba74', marginTop: 6, lineHeight: 19 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    borderTopColor: '#1e293b',
    borderTopWidth: 1,
    paddingTop: 10,
    backgroundColor: '#020617',
  },
  mic: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6d28d9',
    backgroundColor: '#20113d',
  },
  micListening: { backgroundColor: '#7c2d12', borderColor: '#fb923c' },
  micText: { fontSize: 19, color: '#ffffff' },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  send: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#7c3aed',
  },
  disabled: { opacity: 0.45 },
  sendText: { color: '#ffffff', fontWeight: '700' },
});
