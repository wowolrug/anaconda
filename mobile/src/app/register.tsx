
import React, { useRef, useState } from 'react';
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

  const formCardY = useRef(0);

  const inputPositions = useRef<Record<string, number>>({});

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

  const handleInputLayout = (key: string, y: number) => {
    inputPositions.current[key] = y;
  };

  const handleInputFocus = (key: string) => {
    const inputY = inputPositions.current[key];

    if (inputY === undefined) {
      return;
    }

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formCardY.current + inputY - 30),
        animated: true,
      });
    }, Platform.OS === 'android' ? 300 : 150);
  };

  const submitRegistration = async () => {
    if (submitting) {
      return;
    }

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

          <Text style={styles.successTitle}>Регистрация завершена!</Text>

          <Text style={styles.successText}>
            Аккаунт успешно создан. Теперь вы можете войти в приложение.
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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>‹ Назад</Text>
            </Pressable>

            <Text style={styles.title}>Создание аккаунта</Text>

            <Text style={styles.subtitle}>
              Заполните данные для регистрации спортсмена
            </Text>

            <View
              style={styles.formCard}
              onLayout={(event) => {
                formCardY.current = event.nativeEvent.layout.y;
              }}
            >
              <View
                style={styles.inputGroup}
                onLayout={(event) =>
                  handleInputLayout('name', event.nativeEvent.layout.y)
                }
              >
                <Text style={styles.label}>Имя</Text>
                <TextInput
                  ref={nameRef}
                  style={styles.input}
                  placeholder="Введите имя"
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                  onFocus={() => handleInputFocus('name')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => surnameRef.current?.focus()}
                  maxLength={100}
                />
              </View>

              <View
                style={styles.inputGroup}
                onLayout={(event) =>
                  handleInputLayout('surname', event.nativeEvent.layout.y)
                }
              >
                <Text style={styles.label}>Фамилия</Text>
                <TextInput
                  ref={surnameRef}
                  style={styles.input}
                  placeholder="Введите фамилию"
                  placeholderTextColor="#888"
                  value={surname}
                  onChangeText={setSurname}
                  onFocus={() => handleInputFocus('surname')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  maxLength={100}
                />
              </View>

              <View
                style={styles.inputGroup}
                onLayout={(event) =>
                  handleInputLayout('email', event.nativeEvent.layout.y)
                }
              >
                <Text style={styles.label}>Email</Text>
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="example@mail.com"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => handleInputFocus('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  maxLength={254}
                />
              </View>

              <View
                style={styles.inputGroup}
                onLayout={(event) =>
                  handleInputLayout('phone', event.nativeEvent.layout.y)
                }
              >
                <Text style={styles.label}>Телефон (необязательно)</Text>
                <TextInput
                  ref={phoneRef}
                  style={styles.input}
                  placeholder="+7 999 123-45-67"
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => handleInputFocus('phone')}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              <View
                style={styles.inputGroup}
                onLayout={(event) =>
                  handleInputLayout('password', event.nativeEvent.layout.y)
                }
              >
                <Text style={styles.label}>Пароль</Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    placeholder="Минимум 6 символов"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => handleInputFocus('password')}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    maxLength={128}
                  />

                  <Pressable
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? 'Скрыть' : 'Показать'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View
                style={styles.inputGroup}
                onLayout={(event) =>
                  handleInputLayout(
                    'confirmPassword',
                    event.nativeEvent.layout.y,
                  )
                }
              >
                <Text style={styles.label}>Повторите пароль</Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={confirmPasswordRef}
                    style={styles.passwordInput}
                    placeholder="Повторите пароль"
                    placeholderTextColor="#888"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => handleInputFocus('confirmPassword')}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submitRegistration}
                    maxLength={128}
                  />

                  <Pressable
                    style={styles.passwordToggle}
                    onPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  >
                    <Text style={styles.passwordToggleText}>
                      {showConfirmPassword ? 'Скрыть' : 'Показать'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {!!errorMessage && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.primaryButton,
                  submitting && styles.disabledButton,
                ]}
                onPress={submitRegistration}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Зарегистрироваться
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Уже есть аккаунт?</Text>

              <Pressable onPress={() => router.replace('/login')}>
                <Text style={styles.footerLink}>Войти</Text>
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
    backgroundColor: '#000000',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 16,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A0A0A0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },
  formCard: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#303030',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#242424',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#414141',
  },
  passwordContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#414141',
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  passwordToggle: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  passwordToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#292929',
    borderWidth: 1,
    borderColor: '#777777',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    color: '#A0A0A0',
    fontSize: 14,
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#000000',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIconText: {
    color: '#000000',
    fontSize: 40,
    fontWeight: '700',
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    color: '#A0A0A0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
});

