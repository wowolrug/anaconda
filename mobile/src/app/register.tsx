
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

type RegisterResponse = {
  message?: string;
  userId?: number;
};

function getServerErrorMessage(error: any) {
  const data = error?.response?.data;

  if (typeof data?.message === 'string' && data.message.trim()) {
    const knownMessages: Record<string, string> = {
      'A user with this email already exists.':
        'Аккаунт с такой электронной почтой уже существует.',
      'Public registration is allowed only for Athlete and Parent.':
        'Самостоятельная регистрация этой роли недоступна.',
      'Could not assign the user role.':
        'Не удалось назначить роль аккаунту. Попробуй позже.',
    };

    return knownMessages[data.message] ?? data.message;
  }

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors
      .filter((item: unknown) => typeof item === 'string')
      .map((item: string) => translateIdentityError(item))
      .join('\n');
  }

  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors).flat();
    if (messages.length > 0) {
      return messages
        .filter((item): item is string => typeof item === 'string')
        .map(translateIdentityError)
        .join('\n');
    }
  }

  if (!error?.response) {
    return 'Не удалось связаться с сервером. Проверь подключение и попробуй снова.';
  }

  return 'Не удалось создать аккаунт. Проверь введённые данные и попробуй снова.';
}

function translateIdentityError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('email') && lower.includes('already')) {
    return 'Аккаунт с такой электронной почтой уже существует.';
  }
  if (lower.includes('password') && lower.includes('at least')) {
    return 'Пароль слишком короткий.';
  }
  if (lower.includes('password') && lower.includes('digit')) {
    return 'Пароль должен содержать хотя бы одну цифру.';
  }
  if (lower.includes('password') && lower.includes('uppercase')) {
    return 'Пароль должен содержать хотя бы одну заглавную букву.';
  }
  if (lower.includes('password') && lower.includes('lowercase')) {
    return 'Пароль должен содержать хотя бы одну строчную букву.';
  }
  if (lower.includes('password') && lower.includes('non alphanumeric')) {
    return 'Пароль должен содержать хотя бы один специальный символ.';
  }

  return message;
}

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  async function submitRegistration() {
    if (submitting) return;

    const cleanName = name.trim();
    const cleanSurname = surname.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanSurname) {
      setError('Введи имя и фамилию.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      setError('Введи корректный адрес электронной почты.');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.post<RegisterResponse>('/Auth/register', {
        name: cleanName,
        surname: cleanSurname,
        email: cleanEmail,
        password,
        role: 'Athlete',
      });

      setRegistered(true);
    } catch (requestError: any) {
      setError(getServerErrorMessage(requestError));
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

          <Text style={styles.successTitle}>Аккаунт создан!</Text>
          <Text style={styles.successText}>
            Регистрация прошла успешно. Теперь войди в приложение с помощью
            своей электронной почты и пароля.
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
          <Text style={styles.title}>Создать аккаунт</Text>
          <Text style={styles.subtitle}>
            Зарегистрируйся, чтобы следить за своим расписанием и спортивными
            показателями.
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
              textContentType="givenName"
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
              textContentType="familyName"
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
              textContentType="emailAddress"
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
                placeholder="Не менее 6 символов"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                editable={!submitting}
              />
              <Pressable
                onPress={() => setPasswordVisible((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                style={styles.passwordToggle}
              >
                <Text style={styles.passwordToggleText}>
                  {passwordVisible ? 'Скрыть' : 'Показать'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Повтори пароль</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Повтори пароль"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!confirmPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                editable={!submitting}
                onSubmitEditing={() => void submitRegistration()}
              />
              <Pressable
                onPress={() => setConfirmPasswordVisible((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={confirmPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                style={styles.passwordToggle}
              >
                <Text style={styles.passwordToggleText}>
                  {confirmPasswordVisible ? 'Скрыть' : 'Показать'}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              onPress={() => void submitRegistration()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Зарегистрироваться</Text>
              )}
            </Pressable>

            <Text style={styles.footnote}>
              Здесь создаётся аккаунт спортсмена. Для регистрации тренера
              потребуется код приглашения.
            </Text>
          </View>

          <View style={styles.coachRow}>
            <Text style={styles.coachText}>Ты тренер?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/register-coach')}
            >
              <Text style={styles.coachLink}>Зарегистрироваться по коду</Text>
            </Pressable>
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
  title: { marginTop: 8, color: '#111827', fontSize: 30, fontWeight: '800' },
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
  coachRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 20,
  },
  coachText: { color: '#6B7280', fontSize: 13 },
  coachLink: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
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
