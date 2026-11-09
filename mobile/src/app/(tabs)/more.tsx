
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
import { router } from 'expo-router';
import {
  getCurrentRole,
  getCurrentUser,
  logout,
  restoreSession,
  subscribeRole,
  subscribeUser,
  type AuthUser,
} from '@/api/auth';

export default function MoreScreen() {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(getCurrentRole);
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser);

  useEffect(() => {
    const unsubscribeRole = subscribeRole(setRole);
    const unsubscribeUser = subscribeUser(setUser);

    void restoreSession()
      .then(() => {
        setRole(getCurrentRole());
        setUser(getCurrentUser());
      })
      .catch(() => {
        setRole(null);
        setUser(null);
      });

    return () => {
      unsubscribeRole();
      unsubscribeUser();
    };
  }, []);

  const isCoach = role?.toLowerCase() === 'coach';
  const isMainCoach = user?.isMainCoach === true;

  const handleLogout = () => {
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
              setLoading(true);
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error('Ошибка выхода:', error);
              Alert.alert(
                'Ошибка',
                'Не удалось завершить сеанс. Попробуй ещё раз.',
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ещё</Text>
        <Text style={styles.subtitle}>Дополнительные возможности</Text>

        {isCoach && (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/reports')}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>CSV</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>

            <Text style={styles.cardTitle}>Отчёты</Text>
            <Text style={styles.cardText}>
              Экспорт тренировок и посещаемости в CSV и PDF.
            </Text>
          </Pressable>
        )}

        {isMainCoach && (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/coach-registration')}
          >
            <View style={styles.cardHeader}>
              <View style={styles.invitationIconBox}>
                <Text style={styles.invitationIconText}>КОД</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>

            <Text style={styles.cardTitle}>Регистрация тренеров</Text>
            <Text style={styles.cardText}>
              Создание и смена кода приглашения, управление доступностью
              регистрации.
            </Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.cardHeader}>
            <View style={styles.profileIconBox}>
              <Text style={styles.profileIconText}>Я</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>

          <Text style={styles.cardTitle}>Профиль</Text>
          <Text style={styles.cardText}>
            Личные данные, роль и информация о приложении.
          </Text>
        </Pressable>

        <Pressable
          onPress={handleLogout}
          disabled={loading}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.logoutText}>Выйти из аккаунта</Text>
          )}
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
  },
  invitationIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationIconText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  profileIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconText: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '800',
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: 27,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },
  logoutButton: {
    marginTop: 32,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
