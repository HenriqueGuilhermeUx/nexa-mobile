from pathlib import Path

APP_PATH = Path('nexa-mobile/nexa-mobile/App.js')

if not APP_PATH.exists():
    raise SystemExit(f'App.js oficial não encontrado em {APP_PATH}')

text = APP_PATH.read_text(encoding='utf-8')
changed = False


def replace_once(old: str, new: str, label: str, required: bool = False) -> None:
    global text, changed
    if new in text:
        return
    if old not in text:
        if required:
            raise SystemExit(f'Âncora não encontrada: {label}')
        return
    text = text.replace(old, new, 1)
    changed = True


# Import da nova Home.
replace_once(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport AppleModeHome from './AppleModeHome';",
    'import AppleModeHome',
    required=True,
)

# O aplicativo deve usar todo o portfólio real do usuário.
updated = text.replace('&limit=50&mode=real', '&limit=50&mode=portfolio')
updated = updated.replace('&mode=real', '&mode=portfolio')
if updated != text:
    text = updated
    changed = True

# Idempotência nas transferências internas.
replace_once(
    """          amountUsdc: amountToSend,
          note: 'envio app',
""",
    """          amountUsdc: amountToSend,
          note: 'envio app',
          clientRequestId: 'mobile_' + user.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2),
""",
    'clientRequestId',
)

# Substitui somente a Home antiga. A antiga permanece em legacyHome.
if '<AppleModeHome' not in text:
    marker = """        {/* ABA 1: HOME (ULTRA LIMPA) */}
        {page === 'home' && (
"""
    apple = """        {/* HOME APPLE MODE: patrimônio, assinatura e Premium em primeiro plano */}
        {page === 'home' && (
          <AppleModeHome
            user={user}
            username={getUsername()}
            saldoUsdc={saldoUsdc}
            saldoBrl={saldoBrlEstimado}
            buyRate={buyRate}
            marketChange={marketChange}
            isPremium={isPremiumUser()}
            recurringPlan={recurringPlan}
            rewardsTotal={(rewardPositions || []).reduce(function (total, position) {
              return total + Number(position.earnedUsdc || position.rewardUsdc || position.yieldEarned || 0);
            }, 0)}
            onNavigate={setPage}
            onRefresh={function () {
              carregarDados();
              carregarCotacao();
              carregarRewards();
              carregarAssinaturaRecorrente();
            }}
          />
        )}

        {/* Home anterior preservada para auditoria visual, sem exposição ao usuário */}
        {page === 'legacyHome' && (
"""
    replace_once(marker, apple, 'Home principal', required=True)

copy_updates = {
    'Plano mensal para clientes que querem usar recursos avançados da Nexa.':
        'Sua experiência completa para construir patrimônio em dólar com menos taxas e mais possibilidades.',
    '💎 19,90 Reais/mês': '💎 R$ 19,90 por mês',
    'Cobrança mensal em USDC pela cotação do dia.':
        'Uma assinatura simples para economizar nas operações e acessar benefícios exclusivos.',
    'Ver Ativos Premium': 'Quero conhecer meus benefícios',
    'Configurar compra mensal de USDC': 'Ativar meu dólar todo mês',
}

for old, new in copy_updates.items():
    if old in text:
        text = text.replace(old, new)
        changed = True

if changed:
    APP_PATH.write_text(text, encoding='utf-8')
    print('Apple Mode aplicado ao App.js oficial.')
else:
    print('Apple Mode já estava aplicado; nenhuma alteração necessária.')
