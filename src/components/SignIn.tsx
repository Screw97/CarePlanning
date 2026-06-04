import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithPassword } from '@/lib/auth';
import { useTheme } from './theme';

/** One-time sign-in to the single owner account. Once in, the session persists
 *  in SecureStore, so this screen isn't shown again. */
export default function SignIn() {
  const c = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await signInWithPassword(email, password);
    if (!r.ok) setError(r.error ?? 'Sign-in failed');
    setBusy(false);
    // On success, the auth subscription in the root swaps in the tracker.
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Daily Care Tracker
        </Text>
        <Text style={[styles.sub, { color: c.sub }]}>
          Sign in once on this device with the account you created.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={c.sub}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          accessibilityLabel="Email"
          style={[styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.card }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={c.sub}
          secureTextEntry
          textContentType="password"
          accessibilityLabel="Password"
          onSubmitEditing={submit}
          style={[styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.card }]}
        />

        {error && (
          <Text style={[styles.error, { color: c.redText, backgroundColor: c.redBg }]}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          accessibilityState={{ disabled: busy }}
          style={[styles.btn, { backgroundColor: c.accent }, busy && { opacity: 0.7 }]}
        >
          {busy ? (
            <ActivityIndicator color={c.accentText} />
          ) : (
            <Text style={[styles.btnText, { color: c.accentText }]}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  sub: { fontSize: 15, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  error: { padding: 10, borderRadius: 10, fontSize: 14 },
  btn: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontSize: 17, fontWeight: '700' },
});
