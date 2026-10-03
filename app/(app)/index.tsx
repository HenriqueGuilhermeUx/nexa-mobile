import { Redirect } from 'expo-router';

export default function WalletFirstHomeAlias() {
  return <Redirect href={'/legacy' as any} />;
}
