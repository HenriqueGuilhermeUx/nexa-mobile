import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as any).standalone === true
  );
}

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const params = new URLSearchParams(window.location.search);
    const requested = params.get('install') === '1';
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (requested && isIos) {
      setIosHint(true);
      setVisible(true);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!promptEvent) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
      setPromptEvent(null);
    }
  }

  if (!visible || isStandalone()) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.title}>Install Nexa Global</Text>
          <Text style={styles.text}>
            {iosHint && !promptEvent
              ? 'On iPhone/iPad: tap Share, then “Add to Home Screen”.'
              : 'Add the Nexa Global web app to your device for a full-screen app experience.'}
          </Text>
        </View>
        {promptEvent ? (
          <Pressable accessibilityRole="button" onPress={install} style={styles.primary}>
            <Text style={styles.primaryText}>Install</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible(false)}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'fixed' as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4000,
    padding: spacing.md,
    pointerEvents: 'box-none',
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    padding: spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  copy: { marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  text: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  primary: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.background, textAlign: 'center', fontWeight: '900' },
  secondary: { paddingVertical: 10, marginTop: 4 },
  secondaryText: { color: colors.muted, textAlign: 'center', fontWeight: '800' },
});
