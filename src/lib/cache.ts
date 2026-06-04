// Local-first cache. Care data MUST render from here with zero network
// (offline rule #4). Reads never throw — a corrupt/missing cache returns null
// so a failed sync can never blank the screen.
//
// NOTE: AsyncStorage is not encrypted at rest. For this first slice it holds
// only routine care-task templates/logs (low sensitivity). Moving PHI caches to
// encrypted storage (MMKV/SQLCipher) is a tracked follow-up — see README.

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A bad cache must not crash or blank the UI.
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort: failing to persist must not crash the app.
  }
}

export async function clearCache(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }
}
