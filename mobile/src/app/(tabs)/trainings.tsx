import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import {
  getCurrentRole,
  restoreSession,
  subscribeRole,
} from '@/api/auth';

type Training = {
  trainingId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string | number;
  status: string | number;
  description?: string | null;
  coachId: number;
  coachName: string;
  trainingGroupId: number | null;
  groupName: string | null;
  participantsCount: number;
};

type ListMode = 'upcoming' | 'history';

function getDateKey(value: string) {
  return value.split('T')[0];
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = getDateKey(value).split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(value: string) {
  const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/);

  return match ? match[1] : value.slice(0, 5);
}

function getTrainingType(type: string | number) {
  const types: Record<number, string> = {
    0: 'Техника',
    1: 'Спарринг',
    2: 'Силовая',
    3: 'Кардио',
    4: 'Смешанная',
    5: 'Другая',
  };

  if (typeof type === 'number' || /^\d+$/.test(String(type))) {
    return types[Number(type)] ?? String(type);
  }

  return type;
}

function getStatusKey(status: string | number) {
  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    const statusKeys: Record<number, string> = {
      0: 'planned',
      1: 'inprogress',
      2: 'completed',
      3: 'cancelled',
    };

    return statusKeys[Number(status)] ?? String(status);
  }

  return String(status).toLowerCase().replace(/[\s_-]/g, '');
}

function getTrainingStatus(status: string | number) {
  const statusLabels: Record<string, string> = {
    planned: 'Запланирована',
    inprogress: 'Идёт',
    completed: 'Завершена',
    cancelled: 'Отменена',
  };

  const key = getStatusKey(status);

  return statusLabels[key] ?? String(status);
}

function isClosedTraining(training: Training) {
  const status = getStatusKey(training.status);

  return status === 'completed' || status === 'cancelled';
}

function compareTrainings(a: Training, b: Training) {
  const byDate = getDateKey(a.date).localeCompare(getDateKey(b.date));

  if (byDate !== 0) {
    return byDate;
  }

  return formatTime(a.startTime).localeCompare(formatTime(b.startTime));
}

function getCountLabel(count: number) {
  const lastTwo = count % 100;
  const lastOne = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'спортсменов';
  }

  if (lastOne === 1) {
    return 'спортсмен';
  }

  if (lastOne >= 2 && lastOne <= 4) {
    return 'спортсмена';
  }

  return 'спортсменов';
}

export default function TrainingsScreen() {
  const router = useRouter();

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [role, setRole] = useState<string | null>(getCurrentRole);
  const [mode, setMode] = useState<ListMode>('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedRole = role?.toLowerCase();
  const isCoach = normalizedRole === 'coach';
  const isParent = normalizedRole === 'parent';

  useEffect(() => {
    const unsubscribe = subscribeRole(setRole);

    void restoreSession();

    return unsubscribe;
  }, []);

  // Обновляем список при открытии вкладки,
  // например после создания или изменения тренировки.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadTrainings() {
        try {
          setLoading(true);
          setError(null);

          await restoreSession();

          if (!active) {
            return;
          }

          setRole(getCurrentRole());

          const response = await api.get<Training[]>('/Trainings');

          if (!active) {
            return;
          }

          setTrainings(Array.isArray(response.data) ? response.data : []);
        } catch {
          if (active) {
            setError(
              'Не удалось загрузить тренировки. Проверь соединение и попробуй ещё раз.',
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadTrainings();

      return () => {
        active = false;
      };
    }, []),
  );

  // Ручное обновление списка жестом pull-to-refresh.
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      await restoreSession();

      setRole(getCurrentRole());

      const response = await api.get<Training[]>('/Trainings');

      setTrainings(Array.isArray(response.data) ? response.data : []);
    } catch {
      setError(
        'Не удалось обновить тренировки. Проверь соединение и попробуй ещё раз.',
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const todayKey = getTodayKey();

  const upcomingTrainings = trainings
    .filter(
      (training) =>
        getDateKey(training.date) >= todayKey &&
        !isClosedTraining(training),
    )
    .sort(compareTrainings);

  const historyTrainings = trainings
    .filter(
      (training) =>
        getDateKey(training.date) < todayKey ||
        isClosedTraining(training),
    )
    .sort((a, b) => compareTrainings(b, a));

  const visibleTrainings =
    mode === 'upcoming' ? upcomingTrainings : historyTrainings;

  const title = isCoach
    ? 'Тренировки'
    : isParent
      ? 'Тренировки ребёнка'
      : 'Мои тренировки';

  function openTraining(training: Training) {
    router.push({
      pathname: '/training-details',
      params: { id: String(training.trainingId) },
    });
  }

  function openCreateTraining() {
    router.push('/create-training');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            colors={['#2563EB']}
            tintColor="#2563EB"
            title="Обновление..."
            titleColor="#6B7280"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>MMA TRAINING TRACKER</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {isCoach
                ? 'Расписание твоих тренировок и групп'
                : isParent
                  ? 'Расписание занятий ребёнка'
                  : 'Расписание твоих занятий'}
            </Text>
          </View>

          {isCoach && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Создать тренировку"
              style={styles.addButton}
              onPress={openCreateTraining}
            >
              <Text style={styles.addButtonText}>+</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {upcomingTrainings.length}
            </Text>
            <Text style={styles.summaryLabel}>Предстоящих</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {historyTrainings.length}
            </Text>
            <Text style={styles.summaryLabel}>В истории</Text>
          </View>
        </View>

        <View style={styles.switcher}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'upcoming' }}
            onPress={() => setMode('upcoming')}
            style={[
              styles.switcherButton,
              mode === 'upcoming' && styles.switcherButtonActive,
            ]}
          >
            <Text
              style={[
                styles.switcherText,
                mode === 'upcoming' && styles.switcherTextActive,
              ]}
            >
              Предстоящие
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'history' }}
            onPress={() => setMode('history')}
            style={[
              styles.switcherButton,
              mode === 'history' && styles.switcherButtonActive,
            ]}
          >
            <Text
              style={[
                styles.switcherText,
                mode === 'history' && styles.switcherTextActive,
              ]}
            >
              История
            </Text>
          </Pressable>
        </View>

        {error && trainings.length > 0 && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable
              onPress={() => {
                void handleRefresh();
              }}
            >
              <Text style={styles.errorRetryText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.stateText}>Загружаем тренировки...</Text>
          </View>
        ) : error && trainings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Не получилось загрузить список
            </Text>
            <Text style={styles.emptySubtitle}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => {
                void handleRefresh();
              }}
            >
              <Text style={styles.retryButtonText}>Попробовать снова</Text>
            </Pressable>
          </View>
        ) : visibleTrainings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                {mode === 'upcoming' ? '◷' : '✓'}
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              {mode === 'upcoming'
                ? 'Предстоящих тренировок нет'
                : 'История пока пуста'}
            </Text>

            <Text style={styles.emptySubtitle}>
              {mode === 'upcoming'
                ? isCoach
                  ? 'Создай тренировку, чтобы она появилась в расписании.'
                  : isParent
                    ? 'Когда тренер запланирует занятия ребёнка, они появятся здесь.'
                    : 'Когда тебя добавят в тренировку, она появится здесь.'
                : 'Завершённые и отменённые тренировки будут отображаться здесь.'}
            </Text>

            {isCoach && mode === 'upcoming' && (
              <Pressable
                style={styles.createButton}
                onPress={openCreateTraining}
              >
                <Text style={styles.createButtonText}>
                  Создать тренировку
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {visibleTrainings.map((training) => {
              const statusKey = getStatusKey(training.status);

              return (
                <Pressable
                  key={training.trainingId}
                  style={styles.trainingCard}
                  onPress={() => openTraining(training)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeading}>
                      <Text style={styles.trainingType}>
                        {getTrainingType(training.type)}
                      </Text>
                      <Text style={styles.trainingDate}>
                        {formatDate(training.date)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        statusKey === 'cancelled' && styles.statusCancelled,
                        statusKey === 'completed' && styles.statusCompleted,
                        statusKey === 'inprogress' && styles.statusInProgress,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          statusKey === 'cancelled' &&
                            styles.statusTextCancelled,
                          statusKey === 'completed' &&
                            styles.statusTextCompleted,
                          statusKey === 'inprogress' &&
                            styles.statusTextInProgress,
                        ]}
                      >
                        {getTrainingStatus(training.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.cardInfoRow}>
                    <View style={styles.timeIcon}>
                      <Text style={styles.timeIconText}>◷</Text>
                    </View>

                    <View style={styles.cardInfo}>
                      <Text style={styles.cardInfoPrimary}>
                        {formatTime(training.startTime)} –{' '}
                        {formatTime(training.endTime)}
                      </Text>
                      <Text style={styles.cardInfoSecondary}>
                        {training.groupName ?? 'Без группы'}
                      </Text>
                    </View>

                    <Text style={styles.cardArrow}>›</Text>
                  </View>

                  {training.description?.trim() ? (
                    <Text numberOfLines={2} style={styles.description}>
                      {training.description.trim()}
                    </Text>
                  ) : null}

                  {!isCoach && training.coachName ? (
                    <Text style={styles.coachName}>
                      Тренер: {training.coachName}
                    </Text>
                  ) : null}

                  {isCoach && (
                    <View style={styles.participantsRow}>
                      <Text style={styles.participantsLabel}>
                        Участники группы
                      </Text>
                      <Text style={styles.participantsCount}>
                        {training.participantsCount}{' '}
                        {getCountLabel(training.participantsCount)}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 5,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '400',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  summaryNumber: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: '#E9EBEF',
    borderRadius: 13,
    padding: 4,
    marginBottom: 18,
  },
  switcherButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  switcherText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  switcherTextActive: {
    color: '#111827',
  },
  list: {
    gap: 12,
  },
  trainingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardHeading: {
    flex: 1,
  },
  trainingType: {
    fontSize: 18,
    fontWeight: '750',
    color: '#111827',
  },
  trainingDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
    textTransform: 'capitalize',
  },
  statusBadge: {
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusInProgress: {
    backgroundColor: '#FEF3C7',
  },
  statusTextCancelled: {
    color: '#B91C1C',
  },
  statusTextCompleted: {
    color: '#047857',
  },
  statusTextInProgress: {
    color: '#92400E',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F1F4',
    marginVertical: 14,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  timeIconText: {
    fontSize: 22,
    color: '#374151',
  },
  cardInfo: {
    flex: 1,
  },
  cardInfoPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cardInfoSecondary: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  cardArrow: {
    color: '#9CA3AF',
    fontSize: 27,
    marginLeft: 8,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    marginTop: 12,
  },
  coachName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0F1F4',
    paddingTop: 12,
    marginTop: 13,
  },
  participantsLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  participantsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  stateText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 18,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 25,
    color: '#4F46E5',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '750',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 7,
  },
  createButton: {
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#111827',
    marginTop: 18,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  retryButton: {
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#111827',
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#B91C1C',
  },
  errorRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
});