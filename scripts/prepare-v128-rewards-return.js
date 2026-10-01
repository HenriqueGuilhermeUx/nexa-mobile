const fs = require('fs');

const file = 'app/(app)/rewards.tsx';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`v128 Rewards patch missing source block: ${label}`);
  }
  source = source.replace(from, to);
}

replaceOnce(
  "  getRewardsVault,\n  withdrawRewardsFull,\n} from '@/lib/rewardsActions';",
  "  getRewardsVault,\n  returnRewardsToWallet,\n  withdrawRewardsFull,\n} from '@/lib/rewardsActions';",
  'return import',
);

replaceOnce(
  "  type: 'bridge' | 'deposit' | 'withdraw';",
  "  type: 'bridge' | 'deposit' | 'withdraw' | 'return';",
  'pending return type',
);

replaceOnce(
  '  async function resumePending() {',
  `  async function returnWithdrawnUsdc(\n    accessToken: string,\n    privyJwt: string,\n    withdrawnAmount: number,\n  ) {\n    if (!Number.isFinite(withdrawnAmount) || withdrawnAmount <= 0) {\n      throw new Error(\n        'O resgate foi confirmado, mas o valor final ainda não está disponível. Não repita; atualize o status em instantes.',\n      );\n    }\n    setStatusText('Devolvendo seu USDC para o saldo Nexa…');\n    const returned = await returnRewardsToWallet(\n      accessToken,\n      privyJwt,\n      withdrawnAmount,\n    );\n    const returnId = String(returned?.action?.id || '').trim();\n    if (!returnId) {\n      throw new Error('A carteira não retornou o identificador do resgate final.');\n    }\n    await savePending({\n      type: 'return',\n      actionId: returnId,\n      requestedAmount: withdrawnAmount,\n    });\n    await waitForAction(accessToken, returnId);\n    await savePending(null);\n    setStatusText('Resgate confirmado no seu saldo Nexa.');\n  }\n\n  async function resumePending() {`,
  'return helper',
);

replaceOnce(
  "      } else if (pending.type === 'deposit' || pending.type === 'withdraw') {\n        await waitForAction(session.accessToken, pending.actionId);\n      }\n\n      await savePending(null);\n      const refreshed = await getRewardsPosition(session.accessToken);\n      setPosition(refreshed);\n      setStatusText(pending.type === 'withdraw' ? 'Resgate confirmado.' : 'Rewards confirmados.');",
  "      } else if (pending.type === 'withdraw') {\n        const finalWithdraw = await waitForAction(session.accessToken, pending.actionId);\n        const withdrawnAmount = Number(finalWithdraw?.action?.amount || 0);\n        const privyJwt = await privyJwtOrThrow();\n        await returnWithdrawnUsdc(\n          session.accessToken,\n          privyJwt,\n          withdrawnAmount,\n        );\n      } else if (pending.type === 'deposit' || pending.type === 'return') {\n        await waitForAction(session.accessToken, pending.actionId);\n        await savePending(null);\n      }\n\n      const refreshed = await getRewardsPosition(session.accessToken);\n      setPosition(refreshed);\n      setStatusText(\n        pending.type === 'withdraw' || pending.type === 'return'\n          ? 'Resgate confirmado no seu saldo Nexa.'\n          : 'Rewards confirmados.',\n      );",
  'resume return flow',
);

replaceOnce(
  "      await savePending({ type: 'withdraw', actionId });\n      await waitForAction(session.accessToken, actionId);\n      await savePending(null);\n      const refreshed = await getRewardsPosition(session.accessToken);\n      setPosition(refreshed);\n      setStatusText('Resgate confirmado na sua carteira.');",
  "      await savePending({ type: 'withdraw', actionId });\n      const finalWithdraw = await waitForAction(session.accessToken, actionId);\n      const withdrawnAmount = Number(finalWithdraw?.action?.amount || 0);\n      await returnWithdrawnUsdc(\n        session.accessToken,\n        privyJwt,\n        withdrawnAmount,\n      );\n      const refreshed = await getRewardsPosition(session.accessToken);\n      setPosition(refreshed);",
  'withdraw return flow',
);

fs.writeFileSync(file, source);
console.log('v128 Rewards return flow prepared: vault withdrawal returns USDC to the normal Nexa wallet.');
