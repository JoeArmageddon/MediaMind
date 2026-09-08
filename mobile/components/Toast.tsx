import { useEffect, useRef, useMemo } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeContext';
import type { ThemePalette } from '../lib/theme';

// A themed bottom banner, replacing raw inline error text (previously a
// plain red line of whatever the underlying error said - including raw
// Postgres constraint messages verbatim). Auto-dismisses; `message` being
// set to a new value re-triggers the animation even if the text repeats.
export function Toast({
  message,
  tone = 'error',
}: {
  message: string | null;
  tone?: 'error' | 'success';
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, 3200);

    return () => clearTimeout(timer);
  }, [message, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        tone === 'error' ? styles.error : styles.success,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons
        name={tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
        size={16}
        color={tone === 'error' ? theme.danger : theme.success}
      />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

function makeStyles(theme: ThemePalette) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.isManga ? theme.card : '#161616',
      borderWidth: theme.borderWidth,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOpacity: theme.isManga ? 0.15 : 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      zIndex: 100,
    },
    error: {
      borderColor: theme.isManga ? theme.cardBorder : 'rgba(239,68,68,0.35)',
    },
    success: {
      borderColor: theme.isManga ? theme.cardBorder : 'rgba(34,197,94,0.35)',
    },
    text: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
    },
  });
}
