import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../lib/ThemeContext';

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        // Frosted/translucent tab bar in dark mode (blurred background,
        // not floating over content - expo-router SDK 56+ blocks direct
        // @react-navigation/bottom-tabs imports, which is what a true
        // floating bar would need for correct content-inset padding, so
        // this stays docked instead). Manga mode stays flat/paper - blur
        // doesn't fit that aesthetic at all.
        tabBarStyle: {
          backgroundColor: theme.isManga ? theme.bg : 'transparent',
          borderTopColor: theme.cardBorder,
          borderTopWidth: theme.borderWidth,
        },
        tabBarBackground: theme.isManga
          ? undefined
          : () => <BlurView intensity={65} tint="dark" style={{ flex: 1 }} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // The dashboard renders its own "MEDIA MIND" hero inline
          // (matches the web app's home page having no separate header
          // bar) - a native header here would just duplicate it.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
