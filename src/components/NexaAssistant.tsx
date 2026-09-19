import React, { useEffect, useMemo, useState } from 'react';
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
  'Como está meu dinheiro hoje?',
  'Quais foram minhas últimas movimentações?',
  'Quanto tenho em cada ativo?',
  'Me ajude a organizar meus próximos pagamentos.',
];

export default function NexaAssistant({ token, firstName }: Props) {
  const [capabilities, setCapabilities] = useState<AssistantCapabilities | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    };
  }, [token]);

  const enabled = capabilities?.enabled === true;
  const greeting = useMemo(
    () => `Olá${firstName ? `, ${firstName}` : ''}. Como posso ajudar?`,
    [firstName],
  );

  async function send(text?: string) {
    const message = String(text ?? input).trim();
    if (!message || loading || !enabled) return;

    const history = messages.slice(-10);
    const nextMessages: AssistantChatMessage[] = [
      ...messages,
      { role: 'user', content: message },
    ];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const result = await nexaApi.assistantChat(token, message, history);
      const answer = String(result?.response || '').trim();
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: answer || 'Não consegui responder agora. Tente novamente.',
        },
      ]);
    } catch (err: any) {
      setError(
        err?.status === 503
          ? 'O Assistente Nexa ainda não foi ativado para esta versão.'
          : 'Não consegui falar com o Assistente Nexa agora.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (capabilities && !enabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Assistente Nexa</Text>
        <Text style={styles.subtitle}>
          Estamos preparando seu assistente pessoal dentro da Nexa.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Integração preparada com segurança</Text>
          <Text style={styles.cardText}>
            O assistente poderá ajudar com organização, contexto financeiro e preparação de ações. Pagamentos e movimentações continuam exigindo confirmação na Nexa.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Assistente Nexa</Text>
      <Text style={styles.subtitle}>
        Seu dia e seu dinheiro, organizados em uma conversa.
      </Text>

      <View style={styles.safetyBox}>
        <Text style={styles.safetyText}>
          O assistente pode explicar e preparar ações. Movimentações financeiras nunca são executadas pela conversa.
        </Text>
      </View>

      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <>
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>{greeting}</Text>
            </View>
            <View style={styles.starterGrid}>
              {STARTERS.map((starter) => (
                <TouchableOpacity
                  key={starter}
                  style={styles.starter}
                  onPress={() => send(starter)}
                  disabled={loading || !enabled}
                >
                  <Text style={styles.starterText}>{starter}</Text>
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
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={enabled ? 'Pergunte à Nexa…' : 'Assistente ainda desativado'}
          placeholderTextColor="#64748b"
          value={input}
          onChangeText={setInput}
          multiline
          editable={enabled && !loading}
          maxLength={12000}
        />
        <TouchableOpacity
          style={[styles.send, (!enabled || loading || !input.trim()) && styles.sendDisabled]}
          onPress={() => send()}
          disabled={!enabled || loading || !input.trim()}
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
    paddingTop: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    marginBottom: 14,
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
    padding: 12,
    marginBottom: 10,
  },
  safetyText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  messages: {
    flex: 1,
    minHeight: 320,
  },
  messagesContent: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  bubble: {
    maxWidth: '88%',
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
    marginTop: 4,
  },
  starter: {
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#0f172a',
  },
  starterText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopColor: '#1e293b',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 4,
  },
  input: {
    flex: 1,
    minHeight: 46,
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
    minHeight: 46,
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
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
  },
});
