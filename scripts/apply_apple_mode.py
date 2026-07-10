from pathlib import Path
import json

APP_PATH = Path('nexa-mobile/nexa-mobile/App.js')
HOME_PATH = Path('nexa-mobile/nexa-mobile/AppleModeHome.js')
APP_JSON_PATH = Path('nexa-mobile/nexa-mobile/app.json')

for required in (APP_PATH, HOME_PATH, APP_JSON_PATH):
    if not required.exists():
        raise SystemExit(f'Arquivo obrigatório não encontrado: {required}')

app = APP_PATH.read_text(encoding='utf-8')
home = HOME_PATH.read_text(encoding='utf-8')
app_changed = False
home_changed = False


def replace_app(old: str, new: str, label: str, required: bool = False) -> None:
    global app, app_changed
    if new in app:
        return
    if old not in app:
        if required:
            raise SystemExit(f'Âncora App.js não encontrada: {label}')
        return
    app = app.replace(old, new, 1)
    app_changed = True


replace_app(
    "  const [password, setPassword] = useState('');",
    "  const [password, setPassword] = useState('');\n  const [showPassword, setShowPassword] = useState(false);",
    'estado showPassword',
    required=True,
)

old_password = """                <Input
                  placeholder="Senha"
                  secureTextEntry={true}
                  value={password}
                  onChangeText={setPassword}
                />"""
new_password = """                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#07101e',
                  borderWidth: 1,
                  borderColor: password ? '#36516f' : '#263650',
                  borderRadius: 16,
                  marginTop: 10,
                  paddingLeft: 14,
                }}>
                  <TextInput
                    style={{ flex: 1, color: '#ffffff', paddingVertical: 15, fontSize: 16 }}
                    placeholder="Senha"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={function () { setShowPassword(!showPassword); }}
                    style={{ paddingHorizontal: 15, paddingVertical: 14 }}
                  >
                    <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: '900' }}>
                      {showPassword ? 'OCULTAR' : 'MOSTRAR'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {password ? (
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 7 }}>
                    {showPassword ? 'Senha visível' : 'Senha preenchida com segurança'}
                  </Text>
                ) : null}"""
replace_app(old_password, new_password, 'campo de senha', required=True)

old_actions = """                {authPage === 'login' && savedEmail ? (
                  <Button
                    title="Trocar conta"
                    onPress={async function () {
                      await AsyncStorage.removeItem('nexa_last_email');
                      await AsyncStorage.removeItem('nexa_last_name');
                      setSavedEmail('');
                      setSavedName('');
                      setEmail('');
                      setPassword('');
                      setMsg('');
                    }}
                  />
                ) : null}
                {authPage === 'login' ? (
                  <>
                    <Button
                      title="Esqueci minha senha"
                      onPress={function () {
                        setResetEmail(savedEmail || email);
                        setAuthPage('forgot');
                      }}
                    />
                    <Button
                      title="Não tenho conta"
                      onPress={function () { setAuthPage('register'); }}
                    />
                  </>
                ) : (
                  <Button
                    title="Já tenho conta"
                    onPress={function () { setAuthPage('login'); }}
                  />
                )}"""
new_actions = """                {authPage === 'login' ? (
                  <View style={{ marginTop: 18, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={function () {
                        setResetEmail(savedEmail || email);
                        setAuthPage('forgot');
                      }}
                      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                    >
                      <Text style={{ color: '#7c8da3', fontSize: 13, fontWeight: '700' }}>
                        Esqueci minha senha
                      </Text>
                    </TouchableOpacity>

                    {savedEmail ? (
                      <TouchableOpacity
                        onPress={async function () {
                          await AsyncStorage.removeItem('nexa_last_email');
                          await AsyncStorage.removeItem('nexa_last_name');
                          setSavedEmail('');
                          setSavedName('');
                          setEmail('');
                          setPassword('');
                          setShowPassword(false);
                          setMsg('');
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                      >
                        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>
                          Entrar com outra conta
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={function () { setAuthPage('register'); }}
                        style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 18 }}
                      >
                        <Text style={{ color: '#93c5fd', fontSize: 14, fontWeight: '900' }}>
                          Abra sua conta Nexa
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={function () { setAuthPage('login'); }}
                    style={{ marginTop: 18, alignSelf: 'center', padding: 10 }}
                  >
                    <Text style={{ color: '#7c8da3', fontSize: 13, fontWeight: '700' }}>
                      Já tenho uma conta
                    </Text>
                  </TouchableOpacity>
                )}"""
replace_app(old_actions, new_actions, 'ações discretas de autenticação', required=True)

app_replacements = {
    "<Text style={styles.title}>\n                  {authPage === 'login' ? 'Entrar' : 'Criar conta'}\n                </Text>":
        "<Text style={styles.title}>\n                  {authPage === 'login' ? 'Acesse sua Nexa' : 'Abra sua conta'}\n                </Text>",
    "<Text style={styles.subtitle}>Cripto sem complicação</Text>":
        "<Text style={styles.subtitle}>Seu patrimônio em dólar, simples.</Text>",
}
for old, new in app_replacements.items():
    if old in app and new not in app:
        app = app.replace(old, new, 1)
        app_changed = True

home_replacements = {
    '<Text style={styles.heroEyebrow}>SEU SALDO</Text>': '<Text style={styles.heroEyebrow}>SEU PATRIMÔNIO EM DÓLAR</Text>',
    """<Text style={styles.heroValue}>
          R$ {Number(saldoBrl || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text style={styles.heroUsdc}>≈ {Number(saldoUsdc || 0).toFixed(6)} USDC</Text>""":
    """<Text style={styles.heroValue}>{Number(saldoUsdc || 0).toFixed(4)}</Text>
        <Text style={styles.heroUsdc}>USDC</Text>""",
    'Você já protegeu R$ {protectedValue.toFixed(2)} em dólar digital.':
        'Você já acumulou {Number(saldoUsdc || 0).toFixed(4)} USDC em dólar digital.',
}
for old, new in home_replacements.items():
    if old in home and new not in home:
        home = home.replace(old, new, 1)
        home_changed = True

if app_changed:
    APP_PATH.write_text(app, encoding='utf-8')
    print('App.js atualizado: login premium e senha legível.')
else:
    print('App.js já estava atualizado.')

if home_changed:
    HOME_PATH.write_text(home, encoding='utf-8')
    print('AppleModeHome.js atualizado: USDC em destaque com quatro casas.')
else:
    print('AppleModeHome.js já estava atualizado.')

config = json.loads(APP_JSON_PATH.read_text(encoding='utf-8'))
expo = config.setdefault('expo', {})
expo['version'] = '1.4.1'
android = expo.setdefault('android', {})
android['versionCode'] = 15
APP_JSON_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('app.json atualizado para versão 1.4.1 / Android versionCode 15.')
