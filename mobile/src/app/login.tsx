import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { login } from '@/api/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Вход', 'Введи email и пароль.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      setPassword('');
      router.replace('/(tabs)');
    } catch (error: any) {
      const status = error?.response?.status;
      let message = 'Не удалось подключиться к серверу. Попробуй ещё раз.';

      if (status === 400 || status === 401) {
        message = 'Неверный email или пароль.';
      } else if (status === 403) {
        message = 'У этого аккаунта нет доступа.';
      } else if (error?.response) {
        message = `Ошибка сервера (HTTP ${status ?? 'неизвестно'}). Попробуй позже.`;
      } else if (error?.message) {
        message = error.message;
      }

      Alert.alert('Ошибка входа', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>MMT</Text>
          <Text style={styles.title}>С возвращением!</Text>
          <Text style={styles.subtitle}>Войди в систему</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="athlete@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={styles.input}
            returnKeyType="next"
          />

          <Text style={styles.label}>Пароль</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Введи пароль"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </Pressable>

          <View style={styles.registerRow}>
            <Text style={styles.registerHint}>Нет аккаунта?</Text>
            <Pressable
              onPress={() => router.push('/register')}
              disabled={loading}
              accessibilityRole="link"
              accessibilityLabel="Зарегистрироваться"
              hitSlop={8}
            >
              <Text style={styles.registerLink}>Зарегистрироваться</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>MMA Training Tracker</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 36,
  },
  logo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 24,
    letterSpacing: 3,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#6B7280',
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 12,
  },
  registerHint: {
    color: '#6B7280',
    fontSize: 13,
  },
  registerLink: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 36,
  },
});
