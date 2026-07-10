import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';

function ActionButton({ title, onPress, secondary, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: secondary ? '#172554' : '#2563eb',
        borderWidth: 1,
        borderColor: secondary ? '#334155' : '#3b82f6',
        opacity: disabled ? 0.55 : 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginTop: 10,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function Field(props) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#64748b"
      style={{
        backgroundColor: '#020617',
        borderWidth: 1,
        borderColor: '#334155',
        color: '#fff',
        borderRadius: 12,
        padding: 13,
        marginTop: 10,
      }}
    />
  );
}

export default function CustodyScreen({ user, token, onBack, onBalanceRefresh }) {
  const [overview, setOverview] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [amount, setAmount] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };

  async function loadOverview() {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await fetch(
        API + '/custody/overview?userId=' + encodeURIComponent(user.id) + '&_=' + Date.now(),
        { headers: authHeaders },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Falha ao carregar custódia');
      }
      setOverview(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createReturnInstructions() {
    try {
      setLoading(true);
      setMessage('Gerando instruções de depósito...');
      const response = await fetch(
        API + '/custody/deposit-instructions?userId=' + encodeURIComponent(user.id),
        { headers: authHeaders },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Falha ao gerar endereço Nexa');
      }
      setInstructions(data);
      setMessage('Endereço Nexa gerado. Envie somente USDC na rede Polygon.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function moveToOwnWallet() {
    const amountUsdc = Number(String(amount).replace(',', '.'));
    if (!amountUsdc || amountUsdc <= 0) {
      setMessage('Informe um valor USDC válido.');
      return;
    }
    if (!otpCode) {
      setMessage('Informe o OTP de segurança para concluir o envio on-chain.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(API + '/custody/move-to-own-wallet', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: user.id,
          amountUsdc,
          otpCode,
          note: 'Custódia Inteligente Nexa - Modo Carteira Própria',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Falha ao mover para carteira');
      }
      setAmount('');
      setOtpCode('');
      setMessage('USDC enviado para sua Carteira Própria na Polygon.');
      await loadOverview();
      if (onBalanceRefresh) onBalanceRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmReturn() {
    if (!instructions?.depositId) {
      setMessage('Gere primeiro as instruções para trazer USDC.');
      return;
    }
    if (!txHash || !String(txHash).startsWith('0x')) {
      setMessage('Informe o hash da transação Polygon.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(API + '/custody/return-to-nexa', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: user.id,
          depositId: instructions.depositId,
          txHash: txHash.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Falha ao confirmar retorno');
      }
      setTxHash('');
      setInstructions(null);
      setMessage('USDC confirmado e liberado novamente no Modo Nexa.');
      await loadOverview();
      if (onBalanceRefresh) onBalanceRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [user?.id]);

  const nexaUsdc = Number(overview?.balances?.nexa?.USDC || 0);
  const ownUsdc = Number(overview?.balances?.ownWallet?.USDC || 0);
  const walletAddress = overview?.wallet?.address || '';
  const modeLabel =
    overview?.mode === 'hybrid'
      ? 'Híbrido'
      : overview?.mode === 'own_wallet'
        ? 'Carteira Própria'
        : 'Modo Nexa';

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
        <Text style={{ color: '#93c5fd', fontWeight: '800' }}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={{ color: '#fff', fontSize: 27, fontWeight: '900' }}>
        Custódia Inteligente Nexa™
      </Text>
      <Text style={{ color: '#94a3b8', marginTop: 6, lineHeight: 20 }}>
        Simplicidade no Modo Nexa e liberdade na sua Carteira Própria.
      </Text>

      <View style={{ backgroundColor: '#0f172a', borderRadius: 18, padding: 16, marginTop: 16 }}>
        <Text style={{ color: '#94a3b8' }}>Modo atual</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }}>
          {modeLabel}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={{ color: '#94a3b8' }}>Modo Nexa</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>
              {nexaUsdc.toFixed(8)}
            </Text>
            <Text style={{ color: '#60a5fa' }}>USDC</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={{ color: '#94a3b8' }}>Carteira Própria</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>
              {ownUsdc.toFixed(8)}
            </Text>
            <Text style={{ color: '#34d399' }}>USDC on-chain</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
        <ActionButton title="Atualizar saldos" secondary onPress={loadOverview} disabled={loading} />
      </View>

      <View style={{ backgroundColor: '#0f172a', borderRadius: 18, padding: 16, marginTop: 14 }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>
          Mover para Carteira Própria
        </Text>
        <Text style={{ color: '#94a3b8', marginTop: 5 }}>
          O USDC sai do saldo Nexa e é enviado on-chain para sua carteira Polygon.
        </Text>
        <Field placeholder="Valor em USDC" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field placeholder="Código OTP" value={otpCode} onChangeText={setOtpCode} keyboardType="numeric" />
        <ActionButton title="Mover para minha carteira" onPress={moveToOwnWallet} disabled={loading} />
        {walletAddress ? (
          <Text selectable style={{ color: '#64748b', fontSize: 11, marginTop: 10 }}>
            Sua carteira: {walletAddress}
          </Text>
        ) : null}
      </View>

      <View style={{ backgroundColor: '#0f172a', borderRadius: 18, padding: 16, marginTop: 14 }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>
          Trazer para o Modo Nexa
        </Text>
        <Text style={{ color: '#94a3b8', marginTop: 5 }}>
          Envie USDC Polygon para o endereço indicado e confirme pelo hash da transação.
        </Text>
        <ActionButton title="Gerar endereço Nexa" secondary onPress={createReturnInstructions} disabled={loading} />

        {instructions?.treasuryAddress ? (
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 12 }}>
              <QRCode value={instructions.treasuryAddress} size={190} />
            </View>
            <Text selectable style={{ color: '#fff', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              {instructions.treasuryAddress}
            </Text>
            <Text style={{ color: '#fbbf24', marginTop: 8, textAlign: 'center' }}>
              Rede Polygon • somente USDC
            </Text>
            <Field placeholder="Hash da transação 0x..." value={txHash} onChangeText={setTxHash} autoCapitalize="none" />
            <ActionButton title="Confirmar retorno para Nexa" onPress={confirmReturn} disabled={loading} />
          </View>
        ) : null}
      </View>

      {message ? (
        <View style={{ backgroundColor: '#111827', borderRadius: 14, padding: 13, marginTop: 14 }}>
          <Text style={{ color: '#e2e8f0' }}>{message}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
