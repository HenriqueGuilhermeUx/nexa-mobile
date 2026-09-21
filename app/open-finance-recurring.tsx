import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '@/config';
import {
  EfiRecurringPreview,
  efiOpenFinanceApi,
  participantIdOf,
  participantNameOf,
} from '@/lib/efiOpenFinance';
import { loadNexaSession } from '@/lib/session';

type Participant = Record<string, any>;

export default function OpenFinanceRecurringScreen() {
  const params = useLocalSearchParams<{
    amount?: string;
    day?: string;
    bank?: string;
  }>();
  const [token, setToken] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState(String(params.bank || ''));
  const [selected, setSelected] = useState<Participant | null>(null);
  const [amount, setAmount] = useState(String(params.amount || ''));
  const [day, setDay] = useState(String(params.day || ''));
  const [quantity, setQuantity] = useState('12');
  const [preview, setPreview] = useState<EfiRecurringPreview | null>(null);
  const [initiationEnabled, setInitiationEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!config.efiOpenFinanceEnabled) {
        setMessage('Open Finance não está habilitado neste build.');
        return;
      }

      try {
        setLoading(true);
        const session = await loadNexaSession();
        if (!session?.accessToken) {
          router.replace('/sign-in');
          return;
        }
        if (!mounted) return;
        setToken(session.accessToken);

        const [status, list] = await Promise.all([
          efiOpenFinanceApi.recurringStatus(session.accessToken),
          efiOpenFinanceApi.participants(session.accessToken),
        ]);
        if (!mounted) return;
        setInitiationEnabled(Boolean(status.initiationEnabled));
        setQuantity(String(status.defaultQuantity || 12));
        const valid = list.filter((item) => participantIdOf(item));
        setParticipants(valid);

        const hint = String(params.bank || '').trim().toLocaleLowerCase('pt-BR');
        if (hint) {
          const match = valid.find((item) =>
            participantNameOf(item).toLocaleLowerCase('pt-BR').includes(hint),
          );
          if (match) setSelected(match);
        }
      } catch (error: any) {
        if (mounted) {
          setMessage(error?.message || 'Não foi possível abrir o Pix recorrente.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return participants.slice(0, 40);
    return participants
      .filter((item) => participantNameOf(item).toLocaleLowerCase('pt-BR').includes(needle))
      .slice(0, 40);
  }, [participants, search]);

  function inputValues() {
    const amountBrl = Number(String(amount).replace(/\./g, '').replace(',', '.'));
    const dayOfMonth = Number(day);
    const quantityValue = Number(quantity || 12);
    const participantId = participantIdOf(selected || {});

    if (!Number.isFinite(amountBrl) || amountBrl < 1) {
      throw new Error('Informe um valor válido em reais.');
    }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      throw new Error('No piloto, escolha um dia entre 1 e 28.');
    }
    if (!participantId) {
      throw new Error('Escolha o banco de origem.');
    }

    return {
      amountBrl,
      dayOfMonth,
      quantity: quantityValue,
      participantId,
    };
  }

  async function preparePreview() {
    if (!token) return;
    try {
      setLoading(true);
      setMessage('');
      const data = await efiOpenFinanceApi.recurringPreview(token, inputValues());
      setPreview(data);
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível preparar a recorrência.');
    } finally {
      setLoading(false);
    }
  }

  async function authorize() {
    if (!token) return;
    if (!initiationEnabled) {
      setMessage(
        'A recorrência está pronta para validação, mas a autorização financeira continua bloqueada no piloto.',
      );
      return;
    }

    try {
      setLoading(true);
      const data = await efiOpenFinanceApi.recurringStart(token, inputValues());
      if (!data.redirectURI) throw new Error('A Efí não retornou a autorização bancária.');
      await Linking.openURL(data.redirectURI);
      setMessage('Autorize a recorrência no seu banco e depois volte para a Nexa.');
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível iniciar a autorização recorrente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Aporte recorrente</Text>
            <Text style={styles.subtitle}>Programe dinheiro entrando na Nexa todo mês.</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OPEN FINANCE · PIX RECORRENTE</Text>
          <Text style={styles.heroTitle}>Configure uma vez.</Text>
          <Text style={styles.heroText}>
            Escolha o banco, valor e dia. A Nexa prepara o cronograma e a autorização acontece no seu banco.
          </Text>
        </View>

        {message ? (
          <TouchableOpacity style={styles.notice} onPress={() => setMessage('')}>
            <Text style={styles.noticeText}>{message}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Valor mensal</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              setPreview(null);
            }}
            placeholder="R$ 2.000,00"
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Todo dia</Text>
          <TextInput
            style={styles.input}
            value={day}
            onChangeText={(value) => {
              setDay(value.replace(/\D/g, '').slice(0, 2));
              setPreview(null);
            }}
            placeholder="08"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Por quantos meses?</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={(value) => {
              setQuantity(value.replace(/\D/g, '').slice(0, 2));
              setPreview(null);
            }}
            placeholder="12"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Banco de origem</Text>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar banco"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />

          <View style={styles.bankList}>
            {filtered.map((item) => {
              const id = participantIdOf(item);
              const name = participantNameOf(item);
              const active = participantIdOf(selected || {}) === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.bankButton, active ? styles.bankButtonActive : null]}
                  onPress={() => {
                    setSelected(item);
                    setPreview(null);
                  }}
                >
                  <Text style={[styles.bankName, active ? styles.bankNameActive : null]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            disabled={loading || !selected}
            onPress={preparePreview}
            style={[styles.secondaryButton, loading || !selected ? styles.disabled : null]}
          >
            <Text style={styles.secondaryButtonText}>Revisar recorrência</Text>
          </TouchableOpacity>
        </View>

        {preview?.plan ? (
          <View style={styles.previewCard}>
            <Text style={styles.eyebrow}>CONFIRME O PLANO</Text>
            <Text style={styles.previewTitle}>{preview.confirmationText}</Text>
            <Text style={styles.previewLine}>Banco: {participantNameOf(selected || {})}</Text>
            <Text style={styles.previewLine}>Primeira execução: {preview.plan.startDate}</Text>
            <Text style={styles.previewLine}>Frequência: mensal</Text>
            <Text style={styles.previewLine}>Execução agora: não</Text>

            {!initiationEnabled ? (
              <Text style={styles.safetyNotice}>
                Piloto seguro: a criação real da recorrência está bloqueada no backend.
              </Text>
            ) : null}

            <TouchableOpacity
              disabled={loading || !initiationEnabled}
              onPress={authorize}
              style={[
                styles.primaryButton,
                loading || !initiationEnabled ? styles.disabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {initiationEnabled
                  ? 'Confirmar e autorizar no banco'
                  : 'Autorização bloqueada no piloto'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? <ActivityIndicator size="large" color="#60a5fa" style={{ marginTop: 18 }} /> : null}

        <Text style={styles.securityText}>
          A Nexa nunca pede sua senha bancária. Nenhuma recorrência é criada sem sua confirmação e autorização no banco.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 18, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  backText: { color: '#ffffff', fontSize: 31, lineHeight: 32 },
  title: { color: '#ffffff', fontSize: 25, fontWeight: '900' },
  subtitle: { color: '#94a3b8', marginTop: 2 },
  hero: {
    backgroundColor: '#0d1b32',
    borderWidth: 1,
    borderColor: '#244980',
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  eyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#ffffff', fontSize: 27, fontWeight: '900', marginTop: 8 },
  heroText: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 8 },
  notice: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#263650',
    borderRadius: 15,
    padding: 13,
    marginBottom: 14,
  },
  noticeText: { color: '#e2e8f0', fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  label: { color: '#cbd5e1', fontWeight: '800', fontSize: 12, marginTop: 10, marginBottom: 7 },
  input: {
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#263650',
    color: '#ffffff',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  bankList: { gap: 8, marginTop: 12, maxHeight: 260 },
  bankButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#263650',
  },
  bankButtonActive: { backgroundColor: '#12213e', borderColor: '#3b82f6' },
  bankName: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  bankNameActive: { color: '#ffffff' },
  previewCard: {
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: '#31517d',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  previewTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900', marginTop: 8, marginBottom: 10 },
  previewLine: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  safetyNotice: { color: '#fbbf24', fontSize: 11, lineHeight: 17, marginTop: 14 },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  secondaryButton: {
    backgroundColor: '#111c2f',
    borderWidth: 1,
    borderColor: '#263650',
    borderRadius: 15,
    paddingVertical: 14,
    marginTop: 18,
  },
  secondaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  securityText: { color: '#64748b', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 },
});
