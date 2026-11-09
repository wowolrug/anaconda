import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  AuthUser,
  getCurrentUser,
  logout,
  restoreSession,
  subscribeUser,
} from '@/api/auth';

function getRoleLabel(role?: string | null) {
  switch (role?.toLowerCase()) {
    case 'coach':
      return 'Тренер';
    case 'athlete':
      return 'Спортсмен';
    case 'parent':
      return 'Родитель';
    default:
      return role || 'Не определена';
  }
}

function getInitials(user: AuthUser | null) {
  const initials = `${user?.name?.trim().charAt(0) ?? ''}${
    user?.surname?.trim().charAt(0) ?? ''
  }`.toUpperCase();

  return initials || 'AN';
}

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(getCurrentUser);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeUser((nextUser) => {
      if (active) {
        setUser(nextUser);
      }
    });

    async function loadProfile() {
      try {
        await restoreSession();

        if (active) {
          setUser(getCurrentUser());
          setError(null);
        }
      } catch {
        if (active) {
          setError('Не удалось загрузить данные аккаунта.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  function confirmLogout() {
    Alert.alert(
      'Выход из аккаунта',
      'Ты действительно хочешь выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            try {
              setSigningOut(true);
              await logout();
              router.replace('/login');
            } catch {
              Alert.alert(
                'Ошибка',
                'Не удалось завершить сеанс. Попробуй ещё раз.',
              );
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
    );
  }

  const fullName = [user?.name, user?.surname]
    .filter((part) => Boolean(part?.trim()))
    .join(' ');
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const hasProfileData = Boolean(
    user?.name || user?.surname || user?.email,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Профиль' }} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Профиль</Text>
        <Text style={styles.subtitle}>Информация о твоём аккаунте</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.muted}>Загружаем профиль...</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                setError(null);
                void restoreSession()
                  .then(() => setUser(getCurrentUser()))
                  .catch(() => setError('Не удалось загрузить данные аккаунта.'))
                  .finally(() => setLoading(false));
              }}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user)}</Text>
              </View>

              <Text style={styles.fullName}>
                {fullName || 'Пользователь'}
              </Text>

              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {getRoleLabel(user?.role)}
                </Text>
              </View>

              {!hasProfileData ? (
                <Text style={styles.profileHint}>
                  Данные профиля ещё не сохранены на этом устройстве. Выйди и
                  войди в аккаунт снова, чтобы загрузить имя и email.
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Данные аккаунта</Text>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Имя и фамилия</Text>
                    <Text style={styles.infoValue}>
                      {fullName || 'Не указаны'}
                    </Text>
                  </View>
                  <Text style={styles.infoSymbol}>Аа</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Электронная почта</Text>
                    <Text style={styles.infoValue}>
                      {user?.email || 'Не указана'}
                    </Text>
                  </View>
                  <Text style={styles.infoSymbol}>@</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Роль</Text>
                    <Text style={styles.infoValue}>
                      {getRoleLabel(user?.role)}
                    </Text>
                  </View>
                  <Text style={styles.infoSymbol}>◇</Text>
                </View>

                {user?.userId != null ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <View style={styles.infoTextContainer}>
                        <Text style={styles.infoLabel}>ID пользователя</Text>
                        <Text style={styles.infoValue}>{user.userId}</Text>
                      </View>
                      <Text style={styles.infoSymbol}>#</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>О приложении</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Название</Text>
                    <Text style={styles.infoValue}>Anaconda</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Версия приложения</Text>
                    <Text style={styles.infoValue}>{appVersion}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.note}>
              Изменение личных данных и пароля пока не подключено к серверу.
              Сейчас здесь отображаются данные, полученные при входе в аккаунт.
            </Text>

            <Pressable
              onPress={confirmLogout}
              disabled={signingOut}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.buttonPressed,
                signingOut && styles.buttonDisabled,
              ]}
            >
              {signingOut ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text style={styles.logoutText}>Выйти из аккаунта</Text>
              )}
            </Pressable>
          </>
        )}
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#6B7280',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    marginTop: 24,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },
  fullName: {
    marginTop: 14,
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  roleBadge: {
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
  },
  roleText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  profileHint: {
    marginTop: 13,
    fontSize: 12,
    lineHeight: 18,
    color: '#9A6700',
    textAlign: 'center',
  },
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '750',
    color: '#111827',
    marginBottom: 11,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  infoRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  infoValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  infoSymbol: {
    color: '#9CA3AF',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F1F4',
  },
  note: {
    marginTop: 18,
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
  },
  logoutButton: {
    marginTop: 24,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 13,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  muted: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
