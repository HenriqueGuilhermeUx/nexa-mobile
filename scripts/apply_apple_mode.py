from pathlib import Path

APP_PATH = Path('nexa-mobile/nexa-mobile/App.js')
HOME_PATH = Path('nexa-mobile/nexa-mobile/AppleModeHome.js')
CUSTODY_PATH = Path('nexa-mobile/nexa-mobile/CustodyScreen.js')

for path in (APP_PATH, HOME_PATH, CUSTODY_PATH):
    if not path.exists():
        raise SystemExit(f'Arquivo não encontrado: {path}')

app = APP_PATH.read_text(encoding='utf-8')
home = HOME_PATH.read_text(encoding='utf-8')
custody = CUSTODY_PATH.read_text(encoding='utf-8')

# Saldo correto do app: usa a visão real já compatível com Pix, transferências e resets,
# sem trazer lançamentos legados/testes do modo portfolio.
app = app.replace('&limit=50&mode=portfolio', '&limit=50&mode=real')
app = app.replace('&mode=portfolio', '&mode=real')

# Integra a custódia dentro da navegação do App.js.
if "import CustodyScreen from './CustodyScreen';" not in app:
    app = app.replace(
        "import AppleModeHome from './AppleModeHome';",
        "import AppleModeHome from './AppleModeHome';\nimport CustodyScreen from './CustodyScreen';",
        1,
    )

if "page === 'custody'" not in app:
    marker = "        {/* HOME APPLE MODE: patrimônio, assinatura e Premium em primeiro plano */}"
    custody_page = """        {page === 'custody' && (
          <CustodyScreen
            user={user}
            token={token}
            onBack={function () { setPage('home'); }}
            onBalanceRefresh={carregarDados}
          />
        )}

"""
    if marker not in app:
        raise SystemExit('Âncora da Home não encontrada no App.js')
    app = app.replace(marker, custody_page + marker, 1)

# Home: USDC em destaque e custódia abrindo a tela correta.
home = home.replace("<Text style={styles.heroEyebrow}>SEU PATRIMÔNIO</Text>", "<Text style={styles.heroEyebrow}>SEU SALDO</Text>")
home = home.replace(
    "<Text style={styles.heroValue}>R$ {Number(saldoBrl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>\n        <Text style={styles.heroUsdc}>≈ {Number(saldoUsdc || 0).toFixed(6)} USDC</Text>",
    "<Text style={styles.heroValue}>{Number(saldoUsdc || 0).toFixed(6)}</Text>\n        <Text style={styles.heroUsdc}>USDC</Text>",
)
home = home.replace("onPress={() => onNavigate('wallet')}", "onPress={() => onNavigate('custody')}")

# Custódia: os cards agora são realmente clicáveis e controlam qual operação aparece.
custody = custody.replace(
    "function ChoiceCard({ active, title, subtitle, bullets, accent }) {\n  return (\n    <View style={{",
    "function ChoiceCard({ active, title, subtitle, bullets, accent, onPress }) {\n  return (\n    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={{",
)
custody = custody.replace("    </View>\n  );\n}\n\nexport default function CustodyScreen", "    </TouchableOpacity>\n  );\n}\n\nexport default function CustodyScreen", 1)
if "const [selectedMode, setSelectedMode]" not in custody:
    custody = custody.replace(
        "  const [message, setMessage] = useState('');",
        "  const [message, setMessage] = useState('');\n  const [selectedMode, setSelectedMode] = useState('nexa');",
        1,
    )
custody = custody.replace(
    "        accent=\"#60a5fa\"\n      />",
    "        accent=\"#60a5fa\"\n        onPress={() => setSelectedMode('nexa')}\n      />",
    1,
)
custody = custody.replace(
    "        accent=\"#34d399\"\n      />",
    "        accent=\"#34d399\"\n        onPress={() => setSelectedMode('own_wallet')}\n      />",
    1,
)
custody = custody.replace(
    "      <View style={{ backgroundColor: '#0b1220', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#1e293b' }}>\n        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Mover para minha carteira</Text>",
    "      {selectedMode === 'own_wallet' ? (\n      <View style={{ backgroundColor: '#0b1220', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#1e293b' }}>\n        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Mover para minha carteira</Text>",
    1,
)
custody = custody.replace(
    "      </View>\n\n      <View style={{ backgroundColor: '#0b1220', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#1e293b' }}>\n        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Trazer para o Modo Nexa</Text>",
    "      </View>\n      ) : null}\n\n      {selectedMode === 'nexa' ? (\n      <View style={{ backgroundColor: '#0b1220', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#1e293b' }}>\n        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Trazer para o Modo Nexa</Text>",
    1,
)
custody = custody.replace(
    "      </View>\n\n      {message ? (",
    "      </View>\n      ) : null}\n\n      {message ? (",
    1,
)

APP_PATH.write_text(app, encoding='utf-8')
HOME_PATH.write_text(home, encoding='utf-8')
CUSTODY_PATH.write_text(custody, encoding='utf-8')
print('Correções de saldo, Home USDC e Custódia aplicadas.')
