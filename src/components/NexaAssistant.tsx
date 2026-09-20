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

type Props = {
  token: string;
  firstName?: string;
};

const STARTERS = [
  { icon: '☀️', text: 'Me ajude a organizar meu dia.' },
  { icon: '✓', text: 'Quais devem ser minhas prioridades hoje?' },
  { icon: '🗓️', text: 'Me ajude a planejar minha semana.' },
  { icon: '🎯', text: 'Quero organizar uma meta pessoal.' },
  { icon: '💰', text: 'Como está meu dinheiro hoje?' },
  { icon: '◇', text: 'Quanto tenho em cada ativo?' },
];

export default function NexaAssistant({ token, firstName }: Props) {
  const insets = useSafeAreaInsets();
  const [capabilities, setCapabilities] = useState<AssistantCapabilities | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const lastVoiceSentRef = useRef('');
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    let alive = true;
    nexaApi
      .assistantCapabilities(token)
      .then((data) => {
        if (alive) setCapabilities(data);
      })
      .catch(() => {
        if (alive) setCapabilities(null);
      });
    return () => {
      alive = false;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
      void Speech.stop();
    };
  }, [token]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages, loading, error]);

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    setVoiceError('');
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
  });

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
    if (code === 'no-speech' || code === 'speech-timeout') {
      setVoiceError('Não ouvi sua voz. Toque no microfone e tente novamente.');
      return;
    }
    if (code === 'not-allowed') {
      setVoiceError('Permita o uso do microfone para conversar por voz.');
      return;
    }
    setVoiceError('Não consegui ouvir agora. Você pode continuar digitando.');
  });

  const enabled = capabilities?.enabled === true;
  const greeting = useMemo(
    () => `Olá${firstName ? `, ${firstName}` : ''}. Posso ajudar com seu dia, sua organização e também com sua vida financeira na Nexa.`,
    [firstName],
  );

  async function speak(text: string) {
    const clean = String(text || '').trim();
    if (!clean) return;
    await Speech.stop();
    Speech.speak(clean, {
      language: 'pt-BR',
      rate: 0.96,
      pitch: 1,
    });
  }

  async function startVoice() {
    if (!enabled || loading) return;
    setVoiceError('');
    setError('');
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
        contextualStrings: ['Nexa', 'Pix', 'USDC', 'Bitcoin', 'Ethereum', 'XAUT'],
      });
    } catch {
      setVoiceError('Não consegui iniciar o microfone agora.');
    }
  }

  async function send(text?: string, fromVoice = false) {
    const message = String(text ?? input).trim();
    if (!message || loading || !enabled) return;

    const history = messages.slice(-12);
    const nextMessages: AssistantChatMessage[] = [
      ...messages,
      { role: 'user', content: message },
    ];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setVoiceError('');
    setLoading(true);

    try {
      const result = await nexaApi.assistantChat(token, message, history);
      const answer = String(result?.response || '').trim();
      const finalAnswer = answer || 'Não consegui responder agora. Tente novamente.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: finalAnswer,
        },
      ]);
      if (autoSpeak || fromVoice) {
        await speak(finalAnswer);
      }
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
        <Text style={styles.eyebrow}>ASSISTENTE PESSOAL</Text>
        <Text style={styles.title}>Sua vida mais organizada</Text>
        <Text style={styles.subtitle}>
          Rotina, prioridades, organização e contexto financeiro em um só lugar.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Integração preparada com segurança</Text>
          <Text style={styles.cardText}>
            Pagamentos e movimentações financeiras sempre continuam exigindo confirmação dentro da Nexa.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <View style={styles.introRow}>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>ASSISTENTE PESSOAL</Text>
          <Text style={styles.title}>Seu dia, sua rotina e seu dinheiro</Text>
          <Text style={styles.subtitle}>
            Converse por texto ou voz. A Nexa ajuda você a organizar a vida e entende seu contexto financeiro quando isso for útil.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.voiceMode, autoSpeak && styles.voiceModeActive]}
          onPress={() => {
            setAutoSpeak((current) => !current);
            if (autoSpeak) void Speech.stop();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.voiceModeIcon}>{autoSpeak ? '🔊' : '🔇'}</Text>
          <Text style={styles.voiceModeText}>Voz</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.safetyBox}>
        <Text style={styles.safetyText}>
          O assistente pode orientar e preparar ações. Movimentações financeiras só acontecem após sua confirmação na Nexa.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <>
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>{greeting}</Text>
            </View>
            <Text style={styles.sectionLabel}>EXPERIMENTE</Text>
            <View style={styles.starterGrid}>
              {STARTERS.map((starter) => (
                <TouchableOpacity
                  key={starter.text}
                  style={styles.starter}
                  onPress={() => send(starter.text)}
                  disabled={loading || !enabled}
                  activeOpacity={0.82}
                >
                  <Text style={styles.starterIcon}>{starter.icon}</Text>
                  <Text style={styles.starterText}>{starter.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
                style={
                  item.role === 'user' ? styles.userText : styles.assistantText
                }
              >
                {item.content}
              </Text>
              {item.role === 'assistant' ? (
                <TouchableOpacity
                  style={styles.readAgain}
                  onPress={() => speak(item.content)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.readAgainText}>🔊 Ouvir</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
        {loading ? (
          <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
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
          activeOpacity={0.8}
        >
          <Text style={styles.micText}>{listening ? '■' : '🎙️'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={
            listening
              ? 'Estou ouvindo…'
              : enabled
                ? 'Pergunte qualquer coisa…'
                : 'Assistente ainda desativado'
          }
          placeholderTextColor="#64748b"
          value={input}
          onChangeText={setInput}
          multiline
          editable={enabled && !loading && !listening}
          maxLength={12000}
        />
        <TouchableOpacity
          style={[styles.send, (!enabled || loading || !input.trim()) && styles.sendDisabled]}
          onPress={() => send()}
          disabled={!enabled || loading || !input.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 2,
  },
  introRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  introCopy: {
    flex: 1,
  },
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
  voiceMode: {
    minWidth: 58,
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  voiceModeActive: {
    borderColor: '#7c3aed',
    backgroundColor: '#211241',
  },
  voiceModeIcon: {
    fontSize: 17,
  },
  voiceModeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#243047',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#cbd5e1',
    lineHeight: 20,
  },
  safetyBox: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
  },
  safetyText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
    paddingBottom: 16,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 8,
  },
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
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6d28d9',
  },
  assistantText: {
    color: '#e2e8f0',
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
    lineHeight: 20,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starterGrid: {
    gap: 8,
    marginTop: 2,
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
  },
  starterIcon: {
    fontSize: 17,
    width: 25,
    textAlign: 'center',
  },
  starterText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
  },
  readAgain: {
    alignSelf: 'flex-start',
    marginTop: 9,
  },
  readAgainText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
  },
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
  micListening: {
    backgroundColor: '#7c2d12',
    borderColor: '#fb923c',
  },
  micText: {
    fontSize: 19,
    color: '#ffffff',
  },
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
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  error: {
    color: '#fca5a5',
    marginTop: 6,
    lineHeight: 19,
  },
  voiceError: {
    color: '#fdba74',
    marginTop: 6,
    lineHeight: 19,
  },
});
