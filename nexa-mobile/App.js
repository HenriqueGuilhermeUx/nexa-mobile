import React, { useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
const TEST_EMAIL = 'app@nexa.com';
const TEST_PASSWORD = '123456';

export default function App() {
  const [page, setPage] = useState('home');
  const [saldo, setSaldo] = useState({ BRL: 0, USDC: 0 });
  const [extrato, setExtrato] = useState([]);

  const [valorBrl, setValorBrl] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [username, setUsername] = useState('');
  const [valorUsdc, setValorUsdc] = useState('');
  const [wallet, setWallet] = useState('');
  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  const [user, setUser] = useState(null);
  const [msg, setMsg] = useState('');

  function show(data) {
    setMsg(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  async function login() {
    try {
      const response = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      });

      const data = await response.json();

      if (data.accessToken) {
        setUser(data.user);
        show('Login realizado: ' + data.user.fullName);
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro login: ' + e.message);
    }
  }

  async function carregarDados() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/ledger/statement?userId=' + user.id);
      const data = await r.json();

      var brl = 0;
      var usdc = 0;

      if (data.statement) {
        setExtrato(data.statement);

        data.statement.forEach(function (item) {
          var sinal = item.direction === 'credit' ? 1 : -1;
          if (item.asset === 'BRL') brl += Number(item.amount) * sinal;
          if (item.asset === 'USDC') usdc += Number(item.amount) * sinal;
        });
      }

      setSaldo({
        BRL: Number(brl.toFixed(2)),
        USDC: Number(usdc.toFixed(6)),
      });

      show('Saldo atualizado');
    } catch (e) {
      show('Falha ao carregar dados: ' + e.message);
    }
  }

  async function depositarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/banking/mercadopago/pix-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          amountBrl: Number(depositValue),
        }),
      });

      const data = await r.json();

      setPixCopyPaste(data.pixCopyPasteCode || '');
      setTicketUrl(data.ticketUrl || '');

      if (data.success) {
        show('Pix gerado com sucesso. Pague pelo copia e cola abaixo.');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro depósito Pix: ' + e.message);
    }
  }

  async function converter() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/swap/brl-to-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountBrl: Number(valorBrl) }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setValorBrl('');
        carregarDados();
      }
    } catch (e) {
      show('Erro conversão: ' + e.message);
    }
  }

  async function sacarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountBrl: Number(valorBrl), pixKey: pixKey }),
      });

      const data = await r.json();
      show(data);
    } catch (e) {
      show('Erro Pix: ' + e.message);
    }
  }

  async function enviarUsername() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/internal-transfer/send-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: user.id, toUsername: username, amountUsdc: Number(valorUsdc), note: 'envio app' }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setUsername('');
        setValorUsdc('');
        carregarDados();
      }
    } catch (e) {
      show('Erro envio: ' + e.message);
    }
  }

  async function enviarWallet() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/wallet/send-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, toAddress: wallet, amountUsdc: Number(valorUsdc), note: 'envio externo app' }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setWallet('');
        setValorUsdc('');
        carregarDados();
      }
    } catch (e) {
      show('Erro wallet: ' + e.message);
    }
  }

  function Card(props) {
    return <View style={styles.card}>{props.children}</View>;
  }

  function Button(props) {
    return (
      <TouchableOpacity style={styles.button} onPress={props.onPress}>
        <Text style={styles.buttonText}>{props.title}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Pix + USDC + @username</Text>

        <Card>
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusText}>{msg || 'Aguardando ação...'}</Text>
        </Card>

        {page === 'home' && (
          <>
            <Card>
              <Text style={styles.welcome}>👋 Olá, {user ? user.fullName : 'visitante'}</Text>

              {!user && <Button title="Entrar na Nexa" onPress={login} />}

              <Text style={styles.smallLabel}>Saldo BRL</Text>
              <Text style={styles.bigBalance}>R$ {saldo.BRL.toFixed(2)}</Text>

              <Text style={styles.smallLabel}>Saldo USDC</Text>
              <Text style={styles.bigBalance}>{saldo.USDC} USDC</Text>

              <Button title="Atualizar saldo" onPress={carregarDados} />
            </Card>

            <Card>
              <Text style={styles.title}>Ações rápidas</Text>
              <Button title="Depositar Pix" onPress={function () { setPage('deposit'); }} />
              <Button title="Converter para USDC" onPress={function () { setPage('convert'); }} />
              <Button title="Enviar USDC" onPress={function () { setPage('send'); }} />
              <Button title="Sacar Pix" onPress={function () { setPage('pix'); }} />
            </Card>

            <Card>
              <Text style={styles.title}>Últimas movimentações</Text>

              {extrato.length === 0 && (
                <Text style={styles.itemText}>Nenhuma movimentação carregada ainda.</Text>
              )}

              {extrato.slice(0, 5).map(function (item) {
                return (
                  <View key={item.id} style={styles.item}>
                    <Text style={styles.itemText}>{item.description}</Text>
                    <Text style={styles.itemText}>
                      {item.direction === 'credit' ? '+' : '-'} {item.amount} {item.asset}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {page === 'deposit' && (
          <Card>
            <Text style={styles.title}>Depositar Pix</Text>

            <TextInput
              style={styles.input}
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={depositValue}
              onChangeText={setDepositValue}
            />

            <Button title="Gerar Pix Mercado Pago" onPress={depositarPix} />

{pixCopyPaste ? (
  <View style={styles.pixBox}>

    <Text style={styles.itemText}>
      QR Code Pix
    </Text>

    <View
      style={{
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        alignSelf: 'center',
        marginBottom: 15,
      }}
    >
      <QRCode
        value={pixCopyPaste}
        size={180}
      />
    </View>

    <Text style={styles.itemText}>
      Pix copia e cola:
    </Text>

    <Text style={styles.copyText}>
      {pixCopyPaste}
    </Text>

  </View>
) : null}

            {ticketUrl ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>Link de pagamento:</Text>
                <Text style={styles.copyText}>{ticketUrl}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {page === 'pix' && (
          <Card>
            <Text style={styles.title}>Sacar Pix</Text>
            <TextInput style={styles.input} placeholder="Chave Pix" value={pixKey} onChangeText={setPixKey} />
            <TextInput style={styles.input} placeholder="Valor em R$" keyboardType="numeric" value={valorBrl} onChangeText={setValorBrl} />
            <Button title="Solicitar Pix" onPress={sacarPix} />
          </Card>
        )}

        {page === 'convert' && (
          <Card>
            <Text style={styles.title}>Converter BRL para USDC</Text>
            <TextInput style={styles.input} placeholder="Valor em R$" keyboardType="numeric" value={valorBrl} onChangeText={setValorBrl} />
            <Button title="Converter" onPress={converter} />
          </Card>
        )}

        {page === 'send' && (
          <Card>
            <Text style={styles.title}>Enviar USDC</Text>
            <TextInput style={styles.input} placeholder="@username" value={username} onChangeText={setUsername} />
            <TextInput style={styles.input} placeholder="Valor USDC" keyboardType="numeric" value={valorUsdc} onChangeText={setValorUsdc} />
            <Button title="Enviar para @username" onPress={enviarUsername} />

            <TextInput style={styles.input} placeholder="Carteira 0x..." value={wallet} onChangeText={setWallet} />
            <Button title="Enviar para carteira" onPress={enviarWallet} />
          </Card>
        )}

        {page === 'extrato' && (
          <Card>
            <Text style={styles.title}>Extrato</Text>
            <Button title="Atualizar extrato" onPress={carregarDados} />

            {extrato.map(function (item) {
              return (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.itemText}>{item.description}</Text>
                  <Text style={styles.itemText}>{item.direction === 'credit' ? '+' : '-'} {item.amount} {item.asset}</Text>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <View style={styles.menu}>
        <TouchableOpacity onPress={function () { setPage('home'); }}><Text style={styles.menuText}>Home</Text></TouchableOpacity>
        <TouchableOpacity onPress={function () { setPage('deposit'); }}><Text style={styles.menuText}>Depositar</Text></TouchableOpacity>
        <TouchableOpacity onPress={function () { setPage('pix'); }}><Text style={styles.menuText}>Sacar</Text></TouchableOpacity>
        <TouchableOpacity onPress={function () { setPage('convert'); }}><Text style={styles.menuText}>Converter</Text></TouchableOpacity>
        <TouchableOpacity onPress={function () { setPage('send'); }}><Text style={styles.menuText}>Enviar</Text></TouchableOpacity>
        <TouchableOpacity onPress={function () { setPage('extrato'); }}><Text style={styles.menuText}>Extrato</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, padding: 20, paddingTop: 55 },
  logo: { color: 'white', fontSize: 34, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 25 },
  card: { backgroundColor: '#1e293b', padding: 20, borderRadius: 14, marginBottom: 20 },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  welcome: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  smallLabel: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
  bigBalance: { color: 'white', fontSize: 30, fontWeight: 'bold', marginBottom: 8 },
  statusTitle: { color: '#93c5fd', fontWeight: 'bold', marginBottom: 8 },
  statusText: { color: 'white', fontSize: 12 },
  input: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 10 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, marginBottom: 10 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold' },
  menu: { height: 70, backgroundColor: '#020617', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  menuText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  item: { borderBottomColor: '#334155', borderBottomWidth: 1, paddingVertical: 10 },
  itemText: { color: 'white', marginBottom: 6 },
  pixBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 10 },
  copyText: { color: '#cbd5e1', fontSize: 11 },
};
