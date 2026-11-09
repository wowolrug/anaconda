
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';

type RegistrationSettings = {
  isRegistrationEnabled: boolean;
  hasInvitationCode: boolean;
  updatedAtUtc?: string;
};

function getErrorMessage(error: any) {
  const message = error?.response?.data?.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (!error?.response) {
    return 'Не удалось связаться с сервером. Проверь подключение.';
  }

  if (error.response.status === 401) {
    return 'Сессия истекла. Войди в приложение заново.';
  }

  if (error.response.status === 403) {
    return 'У тебя нет доступа к управлению регистрацией тренеров.';
  }

  return 'Произошла ошибка. Попробуй ещё раз.';
}

export default function CoachRegistrationScreen() {
  const router = useRouter();

  const [settings, setSettings] = useState<RegistrationSettings | null>(null);
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setError(null);

      const response = await api.get<RegistrationSettings>(
        '/CoachRegistration/settings',
      );

      setSettings(response.data);
    } catch (requestError: any) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveInvitationCode() {
    if (savingCode) return;

    const cleanCode = invitationCode.trim();

    if (cleanCode.length < 6) {
      Alert.alert(
        'Слишком короткий код',
        'Код приглашения должен содержать не менее 6 символов.',
      );
      return;
    }

    if (cleanCode.length > 100) {
      Alert.alert(
        'Слишком длинный код',
        'Максимальная длина кода — 100 символов.',
      );
      return;
    }

    try {
      setSavingCode(true);

      await api.put('/CoachRegistration/invitation-code', {
        code: cleanCode,
      });

      setInvitationCode('');

      Alert.alert(
        'Готово',
        'Код приглашения успешно сохранён. Предыдущий код больше не действует.',
      );

      await loadSettings();
    } catch (requestError: any) {
      Alert.alert('Ошибка', getErrorMessage(requestError));
    } finally {
      setSavingCode(false);
    }
  }

  async function changeRegistrationStatus(enabled: boolean) {
    if (changingStatus || !settings) return;

    if (enabled && !settings.hasInvitationCode) {
      Alert.alert(
        'Сначала создай код',
        'Чтобы открыть регистрацию тренеров, сначала задай код приглашения.',
      );
      return;
    }

    try {
      setChangingStatus(true);

      await api.put('/CoachRegistration/registration-status', {
        isEnabled: enabled,
      });

      setSettings((current) =>
        current
          ? { ...current, isRegistrationEnabled: enabled }
          : current,
      );
    } catch (requestError: any) {
      Alert.alert('Ошибка', getErrorMessage(requestError));
    } finally {
      setChangingStatus(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Регистрация тренеров' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Загружаем настройки...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !settings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Регистрация тренеров' }} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Не удалось загрузить настройки</Text>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable style={styles.retryButton} onPress={() => {
            setLoading(true);
            void loadSettings();
          }}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!settings) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Регистрация тренеров' }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Управление регистрацией</Text>
        <Text style={styles.subtitle}>
          Здесь можно управлять доступом новых тренеров к регистрации в
          приложении.
        </Text>

        {error ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusInfo}>
              <Text style={styles.sectionTitle}>Регистрация тренеров</Text>
              <Text style={styles.statusDescription}>
                {settings.isRegistrationEnabled
                  ? 'Новые тренеры могут зарегистрироваться по коду.'
                  : 'Регистрация новых тренеров отключена.'}
              </Text>
            </View>

            {changingStatus ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <Switch
                value={settings.isRegistrationEnabled}
                onValueChange={changeRegistrationStatus}
                trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                thumbColor={
                  settings.isRegistrationEnabled ? '#16A34A' : '#F9FAFB'
                }
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Код приглашения</Text>
            <View style={styles.codeStatus}>
              <View
                style={[
                  styles.statusDot,
                  settings.hasInvitationCode
                    ? styles.statusDotActive
                    : styles.statusDotInactive,
                ]}
              />
              <Text style={styles.codeStatusText}>
                {settings.hasInvitationCode ? 'Установлен' : 'Не создан'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {settings.hasInvitationCode
              ? 'Изменить код приглашения'
              : 'Создать код приглашения'}
          </Text>

          <Text style={styles.description}>
            Введи новый код. После сохранения предыдущий код сразу перестанет
            действовать.
          </Text>

          <Text style={styles.inputLabel}>Новый код приглашения</Text>

          <TextInput
            style={styles.input}
            value={invitationCode}
            onChangeText={setInvitationCode}
            placeholder="Введи код (минимум 6 символов)"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!savingCode}
            maxLength={100}
          />

          <Pressable
            style={[
              styles.primaryButton,
              savingCode && styles.buttonDisabled,
            ]}
            onPress={() => void saveInvitationCode()}
            disabled={savingCode}
          >
            {savingCode ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {settings.hasInvitationCode
                  ? 'Сохранить новый код'
                  : 'Создать код'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Важно</Text>
          <Text style={styles.infoText}>
            • Старый код перестаёт действовать сразу после замены.
          </Text>
          <Text style={styles.infoText}>
            • Уже зарегистрированные тренеры сохраняют доступ к аккаунтам.
          </Text>
          <Text style={styles.infoText}>
            • При отключённой регистрации новые тренеры не смогут создать
            аккаунт даже при наличии правильного кода.
          </Text>
          <Text style={styles.infoText}>
            • Сам код не отображается после сохранения. Если он утерян,
            установи новый.
          </Text>
        </View>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  title: {
    color: '#111827',
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
  },
  statusCard: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusInfo: {
    flex: 1,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  statusDescription: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  codeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#16A34A',
  },
  statusDotInactive: {
    backgroundColor: '#9CA3AF',
  },
  codeStatusText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  description: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
  },
  inputLabel: {
    marginTop: 20,
    marginBottom: 8,
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
  primaryButton: {
    minHeight: 52,
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
  },
  infoTitle: {
    marginBottom: 10,
    color: '#1E40AF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoText: {
    marginTop: 6,
    color: '#1E3A8A',
    fontSize: 13,
    lineHeight: 19,
  },
  warningBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  warningText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 19,
  },
  errorTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
