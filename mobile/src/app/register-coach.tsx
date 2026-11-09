
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/api/client';

type RegisterCoachResponse = {
  message?: string;
  userId?: number;
};

function getErrorMessage(error: any) {
  const data = error?.response?.data;

  if (typeof data?.message === 'string') {
    const messages: Record<string, string> = {
      'Coach registration is currently unavailable.':
        'Регистрация тренеров сейчас отключена.',
      'Invalid invitation code.':
        'Неверный код приглашения.',
      'A user with this email already exists.':
        'Аккаунт с такой электронной почтой уже существует.',
      'Coach registration successful.':
        'Регистрация прошла успешно.',
    };

    return messages[data.message] ?? data.message;
  }

  if (Array.isArray(data?.errors)) {
    return data.errors
      .filter((item: unknown) => typeof item === 'string')
      .join('\n');
  }

  if (!error?.response) {
    return 'Не удалось связаться с сервером. Проверь подключение.';
  }

  return 'Не удалось зарегистрировать тренера. Проверь введённые данные.';
}

export default function RegisterCoachScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  async function submitRegistration() {
    if (submitting) return;

    const cleanName = name.trim();
    const cleanSurname = surname.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = invitationCode.trim();

    if (!cleanName || !cleanSurname) {
      setError('Введи имя и фамилию.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      setError('Введи корректный адрес электронной почты.');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен содержать не менее 8 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    if (cleanCode.length < 6) {
      setError('Введи корректный код приглашения.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.post<RegisterCoachResponse>('/Auth/register-coach', {
        name: cleanName,
        surname: cleanSurname,
        email: cleanEmail,
        password,
        invitationCode: cleanCode,
      });

      setRegistered(true);
    } catch (requestError: any) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.successTitle}>Аккаунт тренера создан!</Text>

          <Text style={styles.successText}>
            Регистрация прошла успешно. Теперь можешь войти в приложение
            используя свою электронную почту и пароль.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.primaryButtonText}>Перейти ко входу</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹  Назад</Text>
          </Pressable>

          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>A</Text>
          </View>

          <Text style={styles.eyebrow}>ANACONDA</Text>
          <Text style={styles.title}>Регистрация тренера</Text>

          <Text style={styles.subtitle}>
            Создай тренерский аккаунт, используя код приглашения
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>Имя</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Твоё имя"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              editable={!submitting}
              maxLength={100}
            />

            <Text style={styles.label}>Фамилия</Text>
            <TextInput
              style={styles.input}
              value={surname}
              onChangeText={setSurname}
              placeholder="Твоя фамилия"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              editable={!submitting}
              maxLength={100}
            />

            <Text style={styles.label}>Электронная почта</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              editable={!submitting}
              maxLength={254}
            />

            <Text style={styles.label}>Пароль</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Не менее 8 символов"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                returnKeyType="next"
                editable={!submitting}
              />

              <Pressable
                onPress={() => setPasswordVisible(value => !value)}
                style={styles.passwordToggle}
                accessibilityRole="button"
              >
                <Text style={styles.passwordToggleText}>
                  {passwordVisible ? 'Скрыть' : 'Показать'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Повтори пароль</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Повтори пароль"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              returnKeyType="next"
              editable={!submitting}
            />

            <Text style={styles.label}>Код приглашения</Text>
            <TextInput
              style={styles.input}
              value={invitationCode}
              onChangeText={setInvitationCode}
              placeholder="Введи код"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              editable={!submitting}
              maxLength={100}
              onSubmitEditing={() => void submitRegistration()}
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                submitting && styles.buttonDisabled,
              ]}
              onPress={() => void submitRegistration()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Зарегистрироваться
                </Text>
              )}
            </Pressable>

            <Text style={styles.footnote}>
              Для регистрации необходим действующий код приглашения.
            </Text>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Уже есть аккаунт?</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>Войти</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 36 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backButtonText: { color: '#4B5563', fontSize: 14, fontWeight: '600' },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  eyebrow: {
    marginTop: 18,
    color: '#2563EB',
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  title: { marginTop: 8, color: '#111827', fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 8, color: '#6B7280', fontSize: 14, lineHeight: 21 },
  formCard: {
    marginTop: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  label: {
    marginTop: 15,
    marginBottom: 7,
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontSize: 15,
  },
  passwordRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 15,
  },
  passwordToggle: { paddingHorizontal: 10, paddingVertical: 12 },
  passwordToggleText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 19 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footnote: {
    marginTop: 13,
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 22,
  },
  loginText: { color: '#6B7280', fontSize: 13 },
  loginLink: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 22,
  },
  successIconText: { color: '#15803D', fontSize: 32, fontWeight: '800' },
  successTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  successText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: '#6B7280',
    textAlign: 'center',
  },
});
