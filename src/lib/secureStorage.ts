// Storage adapter for Supabase auth tokens.
//
// Privacy rule #3: auth tokens live in SecureStore, NOT plain AsyncStorage.
// SecureStore is unavailable on web/SSR, so there we fall back to in-memory
// (session simply doesn't persist) rather than writing tokens somewhere
// insecure. Never log token values.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();
const useSecureStore =
  Platform.OS !== 'web' && typeof SecureStore.getItemAsync === 'function';

export const secureStorage = {
  getItem(key: string): Promise<string | null> {
    if (!useSecureStore) return Promise.resolve(memory.get(key) ?? null);
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    if (!useSecureStore) {
      memory.set(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    if (!useSecureStore) {
      memory.delete(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};
