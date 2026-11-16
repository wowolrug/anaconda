
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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

type TextInputRef = React.ComponentRef<typeof TextInput>;
type ScrollViewRef = React.ComponentRef<typeof ScrollView>;

interface RegisterResponse {
  message?: string;
  userId?: number;
  athleteProfileId?: number;
  profileLinked?: boolean;
  profileLinkStatus?: string;
}

function translateIdentityError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('passwordrequiresdigit') ||
    normalized.includes('at least one digit') ||
    normalized.includes('digit')
  ) {
    return 'Пароль должен содержать хотя бы одну цифру.';
  }

  if (
    normalized.includes('passwordrequiresuppercase') ||
    normalized.includes('at least one uppercase') ||
    normalized.includes('uppercase')
  ) {
    return 'Пароль должен содержать хотя бы одну заглавную латинскую букву.';
  }

  if (
    normalized.includes('passwordrequireslowercase') ||
    normalized.includes('at least one lowercase') ||
    normalized.includes('lowercase')
  ) {
    return 'Пароль должен содержать хотя бы одну строчную латинскую букву.';
  }

  if (
    normalized.includes('passwordrequiresnonalphanumeric') ||
    normalized.includes('non alphanumeric') ||
    normalized.includes('nonalphanumeric')
  ) {
    return 'Пароль должен содержать хотя бы один специальный символ, например ! или @.';
  }

  if (
    normalized.includes('passwordtooshort') ||
    normalized.includes('passwords must be at least') ||
    normalized.includes('password')
  ) {
    return 'Пароль не соответствует требованиям безопасности.';
  }

  if (
    normalized.includes('duplicateuser') ||
    normalized.includes('already exists') ||
    normalized.includes('already taken') ||
    normalized.includes('уже существует')
  ) {
    return 'Пользователь с таким email уже зарегистрирован.';
  }

  if (normalized.includes('invalid email') || normalized.includes('email')) {
    return 'Проверьте правильность email.';
  }

  if (normalized.includes('phone')) {
    return 'Проверьте правильность номера телефона.';
  }

  return message;
}

function getServerErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (typeof data === 'string') {
    return translateIdentityError(data);
  }

  if (data?.errors) {
    const errors = Object.values(data.errors).flat();

    if (errors.length > 0) {
      return translateIdentityError(String(errors[0]));
    }
  }

  if (data?.message) {
    return translateIdentityError(data.message);
  }

  if (data?.title) {
    return translateIdentityError(data.title);
  }

  if (error?.message === 'Network Error') {
    return 'Не удалось подключиться к серверу. Проверьте подключение к интернету.';
  }

  return 'Не удалось зарегистрироваться. Попробуйте ещё раз.';
}

function validatePhoneNumber(phone: string): string | null {
  const cleanPhone = phone.trim();

  if (!cleanPhone) {
    return null;
  }

  if (!/^\+?[0-9\s().-]+$/.test(cleanPhone)) {
    return 'Номер телефона содержит недопустимые символы.';
  }

  const digits = cleanPhone.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return 'Номер телефона должен содержать от 7 до 15 цифр.';
  }

  return null;
}

function normalizePhoneNumber(phone: string): string | null {
  const cleanPhone = phone.trim();

  if (!cleanPhone) {
    return null;
  }

  const hasPlus = cleanPhone.startsWith('+');
  const digits = cleanPhone.replace(/\D/g, '');

  return hasPlus ? `+${digits}` : digits;
}

export default function RegisterScreen() {
  const router = useRouter();

  const scrollRef = useRef<ScrollViewRef>(null);

  const nameRef = useRef<TextInputRef>(null);
  const surnameRef = useRef<TextInputRef>(null);
  const emailRef = useRef<TextInputRef>(null);
  const phoneRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const confirmPasswordRef = useRef<TextInputRef>(null);

  const shouldScrollToBottom = useRef(false);

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registered, setRegistered] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 300);
  };

  const handleConfirmPasswordFocus = () => {
    shouldScrollToBottom.current = true;
    scrollToBottom();
  };

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (shouldScrollToBottom.current) {
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({
              animated: true,
            });
          }, 100);
        }
      }
    );

    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        shouldScrollToBottom.current = false;
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submitRegistration = async () => {
    if (submitting) return;

    setErrorMessage('');

    const cleanName = name.trim();
    const cleanSurname = surname.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanSurname) {
      setErrorMessage('Заполните имя и фамилию.');
      return;
    }

    if (cleanName.length > 100 || cleanSurname.length > 100) {
      setErrorMessage('Имя и фамилия не должны превышать 100 символов.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Введите email.');
      return;
    }

    if (cleanEmail.length > 254) {
      setErrorMessage('Email слишком длинный.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Введите корректный email.');
      return;
    }

    const phoneError = validatePhoneNumber(cleanPhone);

    if (phoneError) {
      setErrorMessage(phoneError);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Пароль должен содержать не менее 6 символов.');
      return;
    }

    if (password.length > 128) {
      setErrorMessage('Пароль не должен превышать 128 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Пароли не совпадают.');
      return;
    }

    try {
      setSubmitting(true);

      await api.post<RegisterResponse>('/Auth/register', {
        name: cleanName,
        surname: cleanSurname,
        email: cleanEmail,
        phoneNumber: normalizePhoneNumber(cleanPhone),
        password,
        role: 'Athlete',
      });

      Keyboard.dismiss();
      setRegistered(true);
    } catch (error: any) {
      setErrorMessage(getServerErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (registered) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.successTitle}>
            Регистрация завершена!
          </Text>

          <Text style={styles.successText}>
            Аккаунт успешно создан. Теперь вы можете войти в приложение.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.primaryButtonText}>
              Перейти ко входу
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Text style={styles.backButtonText}>‹ Назад</Text>
            </Pressable>

            <View style={styles.header}>
              <Text style={styles.eyebrow}>ANACONDA</Text>

              <Text style={styles.title}>Создание аккаунта</Text>

              <Text style={styles.subtitle}>
                Заполните данные, чтобы начать работу с приложением.
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Имя</Text>

                <TextInput
                  ref={nameRef}
                  style={styles.input}
                  placeholder="Введите имя"
                  placeholderTextColor="#999999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => surnameRef.current?.focus()}
                  maxLength={100}
                  selectionColor="#111111"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Фамилия</Text>

                <TextInput
                  ref={surnameRef}
                  style={styles.input}
                  placeholder="Введите фамилию"
                  placeholderTextColor="#999999"
                  value={surname}
                  onChangeText={setSurname}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  maxLength={100}
                  selectionColor="#111111"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>

                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="example@mail.com"
                  placeholderTextColor="#999999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  maxLength={254}
                  selectionColor="#111111"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Телефон</Text>
                  <Text style={styles.optionalLabel}>Необязательно</Text>
                </View>

                <TextInput
                  ref={phoneRef}
                  style={styles.input}
                  placeholder="+7 999 123-45-67"
                  placeholderTextColor="#999999"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  selectionColor="#111111"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Пароль</Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    placeholder="Минимум 6 символов"
                    placeholderTextColor="#999999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() =>
                      confirmPasswordRef.current?.focus()
                    }
                    maxLength={128}
                    selectionColor="#111111"
                  />

                  <Pressable
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword((value) => !value)}
                    hitSlop={8}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? 'Скрыть' : 'Показать'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Повторите пароль</Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={confirmPasswordRef}
                    style={styles.passwordInput}
                    placeholder="Повторите пароль"
                    placeholderTextColor="#999999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={handleConfirmPasswordFocus}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submitRegistration}
                    maxLength={128}
                    selectionColor="#111111"
                  />

                  <Pressable
                    style={styles.passwordToggle}
                    onPress={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showConfirmPassword ? 'Скрыть' : 'Показать'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {!!errorMessage && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>!</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  submitting && styles.disabledButton,
                  pressed && !submitting && styles.buttonPressed,
                ]}
                onPress={submitRegistration}
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

              <Text style={styles.formHint}>
                Создавая аккаунт, вы подтверждаете правильность введённых данных.
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Уже есть аккаунт?</Text>

              <Pressable
                onPress={() => router.replace('/login')}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>Войти</Text>
              </Pressable>
            </View>
            <View style={styles.coachRegistration}>
                <Pressable
                  onPress={() => router.push('/register-coach')}
                  hitSlop={8}
                >
                  <Text style={styles.coachRegistrationLink}>
                    Зарегистрироваться как тренер
                  </Text>
                </Pressable>
              </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingRight: 16,
    marginBottom: 24,
  },

  backButtonText: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '600',
  },

  header: {
    marginBottom: 26,
  },

  eyebrow: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 12,
  },

  title: {
    color: '#111111',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 9,
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },

  inputGroup: {
    marginBottom: 19,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  label: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  optionalLabel: {
    color: '#999999',
    fontSize: 11,
    marginBottom: 8,
  },

  input: {
    height: 54,
    backgroundColor: '#F7F7F7',
    borderRadius: 11,
    paddingHorizontal: 15,
    color: '#111111',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E7E7E7',
  },

  passwordContainer: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E7E7E7',
  },

  passwordInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 15,
    color: '#111111',
    fontSize: 15,
  },

  passwordToggle: {
    paddingHorizontal: 13,
    paddingVertical: 14,
  },

  passwordToggleText: {
    color: '#222222',
    fontSize: 12,
    fontWeight: '700',
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4F4',
    borderWidth: 1,
    borderColor: '#F0D0D0',
    borderRadius: 11,
    padding: 13,
    marginBottom: 16,
    gap: 10,
  },

  errorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#D93030',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
    fontWeight: '800',
  },

  errorText: {
    flex: 1,
    color: '#A52222',
    fontSize: 13,
    lineHeight: 19,
  },

  primaryButton: {
    height: 56,
    backgroundColor: '#111111',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  disabledButton: {
    opacity: 0.55,
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  formHint: {
    color: '#999999',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 16,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },

  footerText: {
    color: '#777777',
    fontSize: 14,
  },

  footerLink: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
  },

  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#FFFFFF',
  },

  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },

  successIconText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },

  successTitle: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },

  successText: {
    color: '#777777',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 30,
  },
  coachRegistration: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 30,
  },

  coachRegistrationText: {
    color: '#777777',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },

  coachRegistrationLink: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
