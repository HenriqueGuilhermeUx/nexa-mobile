import React, { useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';

export default function App() {
  const [page, setPage] = useState('home');
  const [authPage, setAuthPage] = useState('login');

  const [saldo, setSaldo] = useState({ BRL: 0, USDC: 0 });
  const [extrato, setExtrato] = useState([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  const [valorBrl, setValorBrl] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [username, setUsername] = useState('');
  const [valorUsdc, setValorUsdc] = useState('');
  const [wallet, setWallet] = useState('');
  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('Aguardando ação...');

  useEffect(function () {
    carregarLoginSalvo();
  }, []);

  useEffect(function () {
    if (user && user.id) {
      carregarDados();
    }
  }, [user && user.id]);

  function show(data) {
    setMsg(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  async function salvarSessao(data) {
    setUser(data.user);
    setToken(data.accessToken || '');

    await AsyncStorage.setItem('nexa_user', JSON.stringify(data.user));
    await AsyncStorage.setItem('nexa_token', data.accessToken || '');
  }

  async function carregarLoginSalvo() {
    try {
      const savedUser = await AsyncStorage.getItem('nexa_user');
      const savedToken = await AsyncStorage.getItem('nexa_token');

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken || '');
        setMsg('Login restaurado: ' + parsedUser.fullName);
      }
    } catch (e) {
      setMsg('Erro ao restaurar login: ' + e.message);
    }
  }

  async function login() {
    if (!email || !password) {
      show('Informe e-mail e senha');
      return;
    }

    try {
      const response = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password }),
      });

      const data = await response.json();

      if (data.accessToken) {
        await salvarSessao(data);
        show('Login realizado: ' + data.user.fullName);
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro login: ' + e.message);
    }
  }

  async function cadastrar() {
    if (!email || !password || !fullName || !cpf || !phone) {
      show('Preencha todos os campos do cadastro');
      return;
    }

    try {
      const response = await fetch(API + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          cpf: cpf,
          fullName: fullName,
          phone: phone,
        }),
      });

      const data = await response.json();

      if (data.accessToken) {
        await salvarSessao(data);
        show('Conta criada: ' + data.user.fullName);
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro cadastro: ' + e.message);
    }
  }

  async function logout() {
    try {
      await AsyncStorage.removeItem('nexa_user');
      await AsyncStorage.removeItem('nexa_token');

      setUser(null);
      setToken('');
      setSaldo({ BRL: 0, USDC: 0 });
      setExtrato([]);
      setPixCopyPaste('');
      setTicketUrl('');
      setPage('home');

      show('Você saiu da Nexa');
    } catch (e) {
      show('Erro ao sair: ' + e.message);
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
        show('Pix gerado com sucesso. Pague pelo QR Code ou copia e cola abaixo.');
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
        body: JSON.stringify({
          userId: user.id,
          amountBrl: Number(valorBrl),
          pixKey: pixKey,
        }),
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
        body: JSON.stringify({
          fromUserId: user.id,
          toUsername: username,
          amountUsdc: Number(valorUsdc),
          note: 'envio app',
        }),
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
        body: JSON.stringify({
          userId: user.id,
          toAddress: wallet,
          amountUsdc: Number(valorUsdc),
          note: 'envio externo app',
        }),
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

  function Input(props) {
    return (
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry || false}
        keyboardType={props.keyboardType || 'default'}
        autoCapitalize={props.autoCapitalize || 'none'}
        autoCorrect={false}
        blurOnSubmit={false}
        returnKeyType="next"
        placeholderTextColor="#64748b"
      />
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="always"
        >
          <Text style={styles.logo}>NEXA</Text>
          <Text style={styles.subtitle}>Cripto sem complicação</Text>

          <Card>
            <Text style={styles.statusTitle}>Status</Text>
            <Text style={styles.statusText}>{msg}</Text>
          </Card>

          <Card>
            <Text style={styles.title}>
              {authPage === 'login' ? 'Entrar' : 'Criar conta'}
            </Text>

            <Input
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              placeholder="Senha"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
            />

            {authPage === 'register' && (
              <>
                <Input
                  placeholder="Nome completo"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />

                <Input
                  placeholder="CPF"
                  keyboardType="numeric"
                  value={cpf}
                  onChangeText={setCpf}
                />

                <Input
                  placeholder="Telefone"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </>
            )}

            {authPage === 'login' ? (
              <Button title="Entrar" onPress={login} />
            ) : (
              <Button title="Criar conta" onPress={cadastrar} />
            )}

            {authPage === 'login' ? (
              <Button title="Não tenho conta" onPress={function () { setAuthPage('register'); }} />
            ) : (
              <Button title="Já tenho conta" onPress={function () { setAuthPage('login'); }} />
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Pix + USDC + @username</Text>

        <Card>
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusText}>{msg}</Text>
        </Card>

        {page === 'home' && (
          <>
            <Card>
              <Text style={styles.welcome}>👋 Olá, {user.fullName}</Text>

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

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={depositValue}
              onChangeText={setDepositValue}
            />

            <Button title="Gerar Pix Mercado Pago" onPress={depositarPix} />

            {pixCopyPaste ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>QR Code Pix</Text>

                <View style={styles.qrBox}>
                  <QRCode value={pixCopyPaste} size={180} />
                </View>

                <Text style={styles.itemText}>Pix copia e cola:</Text>
                <Text style={styles.copyText}>{pixCopyPaste}</Text>
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

            <Input
              placeholder="Chave Pix"
              value={pixKey}
              onChangeText={setPixKey}
            />

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={valorBrl}
              onChangeText={setValorBrl}
            />

            <Button title="Solicitar Pix" onPress={sacarPix} />
          </Card>
        )}

        {page === 'convert' && (
          <Card>
            <Text style={styles.title}>Converter BRL para USDC</Text>

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={valorBrl}
              onChangeText={setValorBrl}
            />

            <Button title="Converter" onPress={converter} />
          </Card>
        )}

        {page === 'send' && (
          <Card>
            <Text style={styles.title}>Enviar USDC</Text>

            <Input
              placeholder="@username"
              value={username}
              onChangeText={setUsername}
            />

            <Input
              placeholder="Valor USDC"
              keyboardType="numeric"
              value={valorUsdc}
              onChangeText={setValorUsdc}
            />

            <Button title="Enviar para @username" onPress={enviarUsername} />

            <Input
              placeholder="Carteira 0x..."
              value={wallet}
              onChangeText={setWallet}
            />

            <Button title="Enviar para carteira" onPress={enviarWallet} />
          </Card>
        )}

        {page === 'profile' && (
          <Card>
            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.itemText}>Nome: {user.fullName}</Text>
            <Text style={styles.itemText}>E-mail: {user.email}</Text>
            <Text style={styles.itemText}>CPF: {user.cpf}</Text>
            <Text style={styles.itemText}>KYC: {user.kycStatus}</Text>
            <Button title="Sair" onPress={logout} />
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
                  <Text style={styles.itemText}>
                    {item.direction === 'credit' ? '+' : '-'} {item.amount} {item.asset}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <View style={styles.menu}>
        <TouchableOpacity onPress={function () { setPage('home'); }}>
          <Text style={styles.menuText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('deposit'); }}>
          <Text style={styles.menuText}>Depositar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('pix'); }}>
          <Text style={styles.menuText}>Sacar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('convert'); }}>
          <Text style={styles.menuText}>Converter</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('send'); }}>
          <Text style={styles.menuText}>Enviar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('profile'); }}>
          <Text style={styles.menuText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#020617' },

  content: {
    flex: 1,
    padding: 20,
    paddingTop: 55,
  },

  logo: {
    color: 'white',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },

  subtitle: {
    color: '#93c5fd',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 13,
  },

  card: {
    backgroundColor: '#0f172a',
    padding: 22,
    borderRadius: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e40af',
  },

  title: {
    color: 'white',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 16,
    marginTop: 6,
  },

  welcome: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 22,
  },

  smallLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },

  bigBalance: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
  },

  statusTitle: {
    color: '#60a5fa',
    fontWeight: '800',
    marginBottom: 8,
  },

  statusText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },

  input: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 15,
  },

  button: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
  },

  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },

  menu: {
    height: 74,
    backgroundColor: '#020617',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },

  menuText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
  },

  item: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  itemText: {
    color: '#f8fafc',
    marginBottom: 6,
    fontSize: 13,
  },

  pixBox: {
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  copyText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },

  qrBox: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    alignSelf: 'center',
    marginBottom: 16,
  },
};
