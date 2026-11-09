import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { api } from '@/api/client';
import { getCurrentRole, restoreSession, subscribeRole } from '@/api/auth';

type TrainingParticipant = {
  athleteId: number;
  name: string;
  surname: string;
  status: string | number;
  note?: string | null;
};

type Training = {
  trainingId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string | number;
  status: string | number;
  description: string;
  coachId: number;
  coachName: string;
  trainingGroupId: number | null;
  groupName: string | null;
  participants?: TrainingParticipant[];
};

function formatTime(value: string) {
  const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : value.slice(0, 5);
}

function formatDate(value: string) {
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDuration(startTime: string, endTime: string) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let minutes = endH * 60 + endM - (startH * 60 + startM);

  if (minutes < 0) {
    minutes += 24 * 60;
  }

  return `${minutes} мин`;
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

function getTrainingStatus(status: string | number) {
  const statuses: Record<number, string> = {
    0: 'Запланирована',
    1: 'Идёт',
    2: 'Завершена',
    3: 'Отменена',
  };

  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    return statuses[Number(status)] ?? String(status);
  }

  const normalized = status.toLowerCase().replace(/[\s_-]/g, '');

  const statusNames: Record<string, string> = {
    planned: 'Запланирована',
    inprogress: 'Идёт',
    completed: 'Завершена',
    cancelled: 'Отменена',
  };

  return statusNames[normalized] ?? status;
}

function getAttendanceStatus(status: string | number) {
  const statuses: Record<number, string> = {
    0: 'Не отмечен',
    1: 'Присутствует',
    2: 'Отсутствует',
    3: 'Опоздал',
    4: 'Уважительная причина',
  };

  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    return statuses[Number(status)] ?? String(status);
  }

  const normalized = status.toLowerCase().replace(/[\s_-]/g, '');

  const statusNames: Record<string, string> = {
    unmarked: 'Не отмечен',
    present: 'Присутствует',
    absent: 'Отсутствует',
    late: 'Опоздал',
    excused: 'Уважительная причина',
  };

  return statusNames[normalized] ?? status;
}

function getAttendanceColor(status: string | number) {
  const normalized = getAttendanceStatus(status);

  switch (normalized) {
    case 'Присутствует':
      return {
        background: '#DCFCE7',
        text: '#166534',
      };
    case 'Отсутствует':
      return {
        background: '#FEE2E2',
        text: '#B91C1C',
      };
    case 'Опоздал':
      return {
        background: '#FEF3C7',
        text: '#92400E',
      };
    case 'Уважительная причина':
      return {
        background: '#DBEAFE',
        text: '#1D4ED8',
      };
    default:
      return {
        background: '#F3F4F6',
        text: '#6B7280',
      };
  }
}

export default function TrainingDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const trainingId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [role, setRole] = useState<string | null>(getCurrentRole);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTraining = useCallback(async () => {
    if (!trainingId || !/^\d+$/.test(trainingId)) {
      setError('Не указан корректный ID тренировки');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await restoreSession();
      setRole(getCurrentRole());

      const response = await api.get<Training>(
        `/Trainings/${trainingId}`,
      );

      setTraining(response.data);
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401) {
        setError('Сессия истекла. Войди в аккаунт заново.');
      } else if (status === 403) {
        setError('У тебя нет доступа к этой тренировке.');
      } else if (status === 404) {
        setError('Тренировка не найдена.');
      } else {
        setError('Не удалось загрузить данные тренировки.');
      }
    } finally {
      setLoading(false);
    }
  }, [trainingId]);

  useEffect(() => {
    const unsubscribe = subscribeRole(setRole);
    void loadTraining();

    return unsubscribe;
  }, [loadTraining]);

  const isCoach = role?.toLowerCase() === 'coach';
  const participants = training?.participants ?? [];
  // Даже если API когда-либо вернёт участников не тренеру, не показываем их.
  const hasParticipantsList =
    isCoach && Array.isArray(training?.participants);

  const presentCount = participants.filter(
    (participant) =>
      getAttendanceStatus(participant.status) === 'Присутствует',
  ).length;

  const absentCount = participants.filter(
    (participant) =>
      getAttendanceStatus(participant.status) === 'Отсутствует',
  ).length;

  const lateCount = participants.filter(
    (participant) =>
      getAttendanceStatus(participant.status) === 'Опоздал',
  ).length;

  const unmarkedCount = participants.filter(
    (participant) =>
      getAttendanceStatus(participant.status) === 'Не отмечен',
  ).length;

  const status = training
    ? getTrainingStatus(training.status)
    : '';

  async function cancelTraining() {
    if (!training || cancelling || !isCoach) return;

    Alert.alert(
      'Отменить тренировку?',
      'Тренировка будет помечена как отменённая.',
      [
        { text: 'Не отменять', style: 'cancel' },
        {
          text: 'Отменить тренировку',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await restoreSession();

              await api.put(
                `/Trainings/${training.trainingId}/cancel`,
              );

              await loadTraining();

              Alert.alert('Готово', 'Тренировка отменена.');
            } catch (err: any) {
              const statusCode = err?.response?.status;
              const serverMessage = err?.response?.data?.message;

              let message = 'Не удалось отменить тренировку.';

              if (statusCode === 400) {
                message = serverMessage ?? 'Эту тренировку нельзя отменить.';
              } else if (statusCode === 401) {
                message = 'Сессия истекла. Войди в аккаунт заново.';
              } else if (statusCode === 403) {
                message = 'Отменять тренировки может только тренер.';
              } else if (statusCode === 404) {
                message = 'Тренировка не найдена.';
              }

              Alert.alert('Ошибка', message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Детали тренировки' }} />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.message}>Загружаем тренировку...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadTraining()}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : training ? (
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <Text style={styles.eyebrow}>ТРЕНИРОВКА</Text>

                <View
                  style={[
                    styles.statusBadge,
                    status === 'Отменена'
                      ? styles.cancelledBadge
                      : status === 'Завершена'
                        ? styles.completedBadge
                        : styles.plannedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      status === 'Отменена'
                        ? styles.cancelledText
                        : status === 'Завершена'
                          ? styles.completedText
                          : styles.plannedText,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>
                {getTrainingType(training.type)}
              </Text>

              <Text style={styles.heroGroup}>
                {training.groupName ?? 'Без группы'}
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.heroDateRow}>
                <View style={styles.dateIcon}>
                  <Text style={styles.dateIconText}>К</Text>
                </View>

                <View style={styles.dateContent}>
                  <Text style={styles.heroDateLabel}>Дата</Text>
                  <Text style={styles.heroDateValue}>
                    {formatDate(training.date)}
                  </Text>
                </View>
              </View>

              <View style={styles.heroDateRow}>
                <View style={styles.dateIcon}>
                  <Text style={styles.dateIconText}>В</Text>
                </View>

                <View style={styles.dateContent}>
                  <Text style={styles.heroDateLabel}>Время</Text>
                  <Text style={styles.heroDateValue}>
                    {formatTime(training.startTime)}–
                    {formatTime(training.endTime)}
                  </Text>
                  <Text style={styles.heroDateHint}>
                    {getDuration(training.startTime, training.endTime)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Информация</Text>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Группа</Text>
                  <Text style={styles.infoValue}>
                    {training.groupName ?? 'Без группы'}
                  </Text>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Тренер</Text>
                  <Text style={styles.infoValue}>
                    {training.coachName || 'Не указан'}
                  </Text>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Тип</Text>
                  <Text style={styles.infoValue}>
                    {getTrainingType(training.type)}
                  </Text>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ID</Text>
                  <Text style={styles.infoValue}>
                    {training.trainingId}
                  </Text>
                </View>

                {training.description?.trim() ? (
                  <>
                    <View style={styles.infoDivider} />

                    <View style={styles.descriptionBlock}>
                      <Text style={styles.infoLabel}>Описание</Text>
                      <Text style={styles.descriptionText}>
                        {training.description}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>

            {hasParticipantsList && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Участники</Text>

                  <Text style={styles.participantsCount}>
                    {participants.length}
                  </Text>
                </View>

                {participants.length > 0 ? (
                  <>
                    <View style={styles.attendanceSummary}>
                      <View style={styles.attendanceStat}>
                        <Text
                          style={[
                            styles.attendanceStatValue,
                            { color: '#15803D' },
                          ]}
                        >
                          {presentCount}
                        </Text>
                        <Text style={styles.attendanceStatLabel}>
                          Присутствуют
                        </Text>
                      </View>

                      <View style={styles.attendanceStat}>
                        <Text
                          style={[
                            styles.attendanceStatValue,
                            { color: '#DC2626' },
                          ]}
                        >
                          {absentCount}
                        </Text>
                        <Text style={styles.attendanceStatLabel}>
                          Отсутствуют
                        </Text>
                      </View>

                      <View style={styles.attendanceStat}>
                        <Text
                          style={[
                            styles.attendanceStatValue,
                            { color: '#B45309' },
                          ]}
                        >
                          {lateCount}
                        </Text>
                        <Text style={styles.attendanceStatLabel}>
                          Опоздали
                        </Text>
                      </View>

                      <View style={styles.attendanceStat}>
                        <Text style={styles.attendanceStatValue}>
                          {unmarkedCount}
                        </Text>
                        <Text style={styles.attendanceStatLabel}>
                          Не отмечены
                        </Text>
                      </View>
                    </View>

                    <View style={styles.participantsCard}>
                      {participants.map((participant, index) => {
                        const badgeColor = getAttendanceColor(
                          participant.status,
                        );

                        return (
                          <View
                            key={participant.athleteId}
                            style={[
                              styles.participantRow,
                              index !== participants.length - 1 &&
                                styles.participantDivider,
                            ]}
                          >
                            <View style={styles.avatar}>
                              <Text style={styles.avatarText}>
                                {participant.name.charAt(0)}
                                {participant.surname.charAt(0)}
                              </Text>
                            </View>

                            <View style={styles.participantInfo}>
                              <Text style={styles.participantName}>
                                {participant.name} {participant.surname}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.attendanceBadge,
                                { backgroundColor: badgeColor.background },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.attendanceBadgeText,
                                  { color: badgeColor.text },
                                ]}
                              >
                                {getAttendanceStatus(participant.status)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>
                      Участников пока нет
                    </Text>
                    <Text style={styles.emptyText}>
                      У этой тренировки пока нет назначенных спортсменов.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.actions}>
              {isCoach && (
                <>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() =>
                      router.push({
                        pathname: '/attendance',
                        params: { id: String(training.trainingId) },
                      })
                    }
                  >
                    <Text style={styles.primaryButtonText}>
                      Отметить посещаемость
                    </Text>
                  </Pressable>

                  {status !== 'Отменена' && (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() =>
                        router.push({
                          pathname: '/create-training',
                          params: { editId: String(training.trainingId) },
                        })
                      }
                    >
                      <Text style={styles.secondaryButtonText}>
                        Редактировать тренировку
                      </Text>
                    </Pressable>
                  )}

                  {status !== 'Отменена' && status !== 'Завершена' && (
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => void cancelTraining()}
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <ActivityIndicator color="#DC2626" />
                      ) : (
                        <Text style={styles.cancelButtonText}>
                          Отменить тренировку
                        </Text>
                      )}
                    </Pressable>
                  )}
                </>
              )}

              <Pressable
                style={styles.secondaryButton}
                onPress={() => router.back()}
              >
                <Text style={styles.secondaryButtonText}>Назад</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#111827',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#9CA3AF',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plannedBadge: {
    backgroundColor: '#374151',
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
  },
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  plannedText: {
    color: '#E5E7EB',
  },
  completedText: {
    color: '#166534',
  },
  cancelledText: {
    color: '#B91C1C',
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroGroup: {
    marginTop: 5,
    fontSize: 15,
    color: '#CBD5E1',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 22,
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  dateIconText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateContent: {
    flex: 1,
  },
  heroDateLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  heroDateValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroDateHint: {
    marginTop: 3,
    fontSize: 12,
    color: '#9CA3AF',
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  infoRow: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    color: '#111827',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F0F1F4',
  },
  descriptionBlock: {
    paddingVertical: 15,
  },
  descriptionText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: '#111827',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  attendanceSummary: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  attendanceStat: {
    flex: 1,
    alignItems: 'center',
  },
  attendanceStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6B7280',
  },
  attendanceStatLabel: {
    marginTop: 4,
    fontSize: 10,
    textAlign: 'center',
    color: '#6B7280',
  },
  participantsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingVertical: 10,
    gap: 10,
  },
  participantDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  attendanceBadge: {
    maxWidth: 125,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  attendanceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  actions: {
    marginTop: 28,
    gap: 10,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
});