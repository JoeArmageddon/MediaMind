import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../lib/useNetworkStatus';
import { queueLength } from '../lib/offlineQueue';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';

// Chunk B's visible half of offline support - writes already queue and
// sync silently (see store/mediaStore.ts + lib/offlineQueue.ts), but a
// user who's actually offline should be told, not left to wonder whether
// their edits are really saving. Poll-based queue count (not reactive to
// every enqueue/dequeue - there's no event emitter for that here) refreshes
// on an interval only while actually offline, so it stays cheap otherwise.
export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (isOnline) {
      setPending(0);
      return;
    }
    let cancelled = false;
    const check = () => {
      queueLength().then((n) => {
        if (!cancelled) setPending(n);
      });
    };
    check();
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color={theme.textMuted} />
      <Text style={styles.text}>
        You&apos;re offline - changes save on this device{pending > 0 ? ` (${pending} pending)` : ''} and sync
        when you&apos;re back online.
      </Text>
    </View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.card,
      borderWidth: theme.borderWidth,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 14,
    },
    text: {
      flex: 1,
      color: theme.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
  });
}
