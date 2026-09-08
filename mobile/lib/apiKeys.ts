import * as SecureStore from 'expo-secure-store';

// Mirrors the web app's src/lib/api/apiKey.ts resolve-order: a
// user-entered key (Settings screen, stored here in SecureStore) wins
// over the bundled EXPO_PUBLIC_* default. Always trimmed - the web app
// hit a real bug from an untrimmed key (CRLF-corrupted .env.local), so
// this defends against the same class of issue even though Expo's env
// loading isn't known to have that specific problem.

export async function getStoredApiKey(keyName: string): Promise<string> {
  try {
    const value = await SecureStore.getItemAsync(keyName);
    return (value || '').trim();
  } catch (e) {
    console.warn('Error reading API key from SecureStore:', e);
    return '';
  }
}

export async function saveApiKey(keyName: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) {
    await SecureStore.setItemAsync(keyName, trimmed);
  } else {
    await SecureStore.deleteItemAsync(keyName).catch(() => {});
  }
}

export async function resolveApiKey(keyName: string, envValue: string | undefined): Promise<string> {
  const stored = await getStoredApiKey(keyName);
  const resolved = stored || envValue || '';
  return resolved.trim();
}
