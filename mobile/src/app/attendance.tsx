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
import { getCurrentRole, restoreSession } from '@/api/auth';

type AttendanceStatus =
  | 'unmarked'
  | 'present'
  | 'absent'
  | 'late'
  | 'excused';

type AttendanceRecord = {
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
  groupName: string | null;
};

const statusValues: Record<AttendanceStatus, number> = {
  unmarked: 0,
  present: 1,
  absent: 2,
  late: 3,
  excused: 4,
};

const statusLabels: Record<AttendanceStatus, string> = {
  unmarked: 'Не отмечен',
  present: 'Присутствует',
  absent: 'Отсутствует',
  late: 'Опоздал',
  excused: 'Уважительная причина',
};

function normalizeStatus(status: string | number): AttendanceStatus {
  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    const numeric = Number(status);

    const numericStatuses: Record<number, AttendanceStatus> = {
      0: 'unmarked',
      1: 'present',
      2: 'absent',
      3: 'late',
      4: 'excused',
    };

    return numericStatuses[numeric] ?? 'unmarked';
  }

  const normalized = status.toLowerCase().replace(/[\s_-]/g, '');

  const namedStatuses: Record<string, AttendanceStatus> = {
    unmarked: 'unmarked',
    present: 'present',
    absent: 'absent',
    late: 'late',
    excused: 'excused',
  };

  return namedStatuses[normalized] ?? 'unmarked';
}

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

function getCountLabel(count: number) {
  const lastTwo = count % 100;
  const lastOne = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return 'спортсменов';
  if (lastOne === 1) return 'спортсмен';
  if (lastOne >= 2 && lastOne <= 4) return 'спортсмена';

  return 'спортсменов';
}

function getStatusStyle(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return {
        badge: styles.presentBadge,
        symbol: '✓',
        symbolColor: styles.presentSymbol,
      };
    case 'absent':
      return {
        badge: styles.absentBadge,
        symbol: '×',
        symbolColor: styles.absentSymbol,
      };
    case 'late':
      return {
        badge: styles.lateBadge,
        symbol: '!',
        symbolColor: styles.lateSymbol,
      };
    case 'excused':
      return {
        badge: styles.excusedBadge,
        symbol: '✓',
        symbolColor: styles.excusedSymbol,
      };
    default:
      return {
        badge: styles.unmarkedBadge,
        symbol: '—',
        symbolColor: styles.unmarkedSymbol,
      };
  }
}

export default function AttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const trainingId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [training, setTraining] = useState<Training | null>(null);
  const [athletes, setAthletes] = useState<AttendanceRecord[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [originalAttendance, setOriginalAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    if (!trainingId || !/^\d+$/.test(trainingId)) {
      setError('Не указан корректный ID тренировки');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await restoreSession();

      // Не запрашиваем сведения об участниках и посещаемости,
      // если экран открыл пользователь без роли тренера.
      if (getCurrentRole()?.toLowerCase() !== 'coach') {
        setTraining(null);
        setAthletes([]);
        setAttendance({});
        setOriginalAttendance({});
        setError('Отмечать посещаемость может только тренер.');
        return;
      }

      const [trainingResponse, attendanceResponse] = await Promise.all([
        api.get<Training>(`/Trainings/${trainingId}`),
        api.get<AttendanceRecord[]>(`/Trainings/${trainingId}/attendance`),
      ]);

      const records = attendanceResponse.data;
      const statuses: Record<string, AttendanceStatus> = {};

      records.forEach((athlete) => {
        statuses[String(athlete.athleteId)] = normalizeStatus(
          athlete.status,
        );
      });

      setTraining(trainingResponse.data);
      setAthletes(records);
      setAttendance(statuses);
      setOriginalAttendance(statuses);
    } catch (err: any) {
      const statusCode = err?.response?.status;

      if (statusCode === 401) {
        setError('Сессия истекла. Войди в аккаунт заново.');
      } else if (statusCode === 403) {
        setError('У тебя нет доступа к посещаемости этой тренировки.');
      } else if (statusCode === 404) {
        setError('Тренировка не найдена.');
      } else {
        setError('Не удалось загрузить посещаемость.');
      }
    } finally {
      setLoading(false);
    }
  }, [trainingId]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const presentCount = athletes.filter((athlete) => {
    const status = attendance[String(athlete.athleteId)];
    return status === 'present';
  }).length;

  const absentCount = athletes.filter((athlete) => {
    return attendance[String(athlete.athleteId)] === 'absent';
  }).length;

  const lateCount = athletes.filter((athlete) => {
    return attendance[String(athlete.athleteId)] === 'late';
  }).length;

  const unmarkedCount = athletes.filter((athlete) => {
    return attendance[String(athlete.athleteId)] === 'unmarked';
  }).length;

  const excusedCount = athletes.filter((athlete) => {
    return attendance[String(athlete.athleteId)] === 'excused';
  }).length;

  const hasChanges =
    JSON.stringify(attendance) !== JSON.stringify(originalAttendance);

  function updateStatus(athleteId: number) {
    const key = String(athleteId);

    const order: AttendanceStatus[] = [
      'unmarked',
      'present',
      'absent',
      'late',
      'excused',
    ];

    setAttendance((current) => {
      const currentStatus = current[key] ?? 'unmarked';
      const currentIndex = order.indexOf(currentStatus);
      const nextStatus = order[(currentIndex + 1) % order.length];

      return {
        ...current,
        [key]: nextStatus,
      };
    });
  }

  function markAllPresent() {
    setAttendance(
      Object.fromEntries(
        athletes.map((athlete) => [
          String(athlete.athleteId),
          'present',
        ]),
      ) as Record<string, AttendanceStatus>,
    );
  }

  function clearAttendance() {
    setAttendance(
      Object.fromEntries(
        athletes.map((athlete) => [
          String(athlete.athleteId),
          'unmarked',
        ]),
      ) as Record<string, AttendanceStatus>,
    );
  }

  async function persistAttendance() {
    if (!trainingId || saving) return;

    // Дополнительная клиентская проверка перед записью.
    // API также обязан проверять роль Coach на сервере.
    if (getCurrentRole()?.toLowerCase() !== 'coach') {
      Alert.alert(
        'Нет доступа',
        'Отмечать посещаемость может только тренер.',
      );
      return;
    }

    try {
      setSaving(true);

      // Последовательно отправляем отметки, чтобы проще выявлять ошибки.
      for (const athlete of athletes) {
        const key = String(athlete.athleteId);
        const status = attendance[key] ?? 'unmarked';

        await api.put(
          `/Trainings/${trainingId}/attendance/${athlete.athleteId}`,
          {
            status: statusValues[status],
            note: athlete.note ?? null,
          },
        );
      }

      setOriginalAttendance({ ...attendance });

      Alert.alert(
        'Посещаемость сохранена',
        [
          `Присутствуют: ${presentCount}`,
          `Отсутствуют: ${absentCount}`,
          `Опоздали: ${lateCount}`,
          `Уважительная причина: ${excusedCount}`,
          `Не отмечены: ${unmarkedCount}`,
        ].join('\n'),
      );
    } catch (err: any) {
      const statusCode = err?.response?.status;

      let message =
        'Не удалось сохранить все отметки. Проверь соединение и попробуй ещё раз.';

      if (statusCode === 404) {
        message =
          'Для одного из спортсменов не найдена запись участника этой тренировки.';
      } else if (statusCode === 401) {
        message = 'Сессия истекла. Войди в аккаунт заново.';
      } else if (statusCode === 403) {
        message = 'У тебя нет прав для изменения посещаемости.';
      }

      Alert.alert('Ошибка сохранения', message);
    } finally {
      setSaving(false);
    }
  }

  function saveAttendance() {
    if (saving) return;

    if (unmarkedCount > 0) {
      Alert.alert(
        'Не все отметки заполнены',
        `Осталось не отметить спортсменов: ${unmarkedCount}. Сохранить текущие отметки?`,
        [
          { text: 'Продолжить отметки', style: 'cancel' },
          {
            text: 'Сохранить',
            onPress: () => void persistAttendance(),
          },
        ],
      );

      return;
    }

    void persistAttendance();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Посещаемость' }} />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.message}>
              Загружаем посещаемость...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void loadAttendance()}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Назад</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.trainingCard}>
              <Text style={styles.eyebrow}>ТРЕНИРОВКА</Text>

              <Text style={styles.trainingTitle}>
                {getTrainingType(training?.type ?? 'Тренировка')}
              </Text>

              <Text style={styles.trainingInfo}>
                {training?.groupName ?? 'Без группы'}
              </Text>

              <Text style={styles.trainingInfo}>
                {training ? formatDate(training.date) : ''}
              </Text>

              <Text style={styles.trainingInfo}>
                {training
                  ? `${formatTime(training.startTime)}–${formatTime(training.endTime)} · ${getDuration(training.startTime, training.endTime)}`
                  : ''}
              </Text>

              <Text style={styles.trainingId}>
                ID тренировки: {trainingId}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Посещаемость</Text>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statNumber, styles.presentText]}>
                    {presentCount}
                  </Text>
                  <Text style={styles.statLabel}>Присутствуют</Text>
                </View>

                <View style={styles.stat}>
                  <Text style={[styles.statNumber, styles.absentText]}>
                    {absentCount}
                  </Text>
                  <Text style={styles.statLabel}>Отсутствуют</Text>
                </View>

                <View style={styles.stat}>
                  <Text style={[styles.statNumber, styles.lateText]}>
                    {lateCount}
                  </Text>
                  <Text style={styles.statLabel}>Опоздали</Text>
                </View>

                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{unmarkedCount}</Text>
                  <Text style={styles.statLabel}>Не отмечены</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: athletes.length
                        ? `${((presentCount + lateCount) / athletes.length) * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>

              <Text style={styles.excusedSummary}>
                Уважительная причина: {excusedCount}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.allPresentButton]}
                onPress={markAllPresent}
                disabled={saving || athletes.length === 0}
              >
                <Text style={styles.allPresentText}>
                  Все присутствуют
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.clearButton]}
                onPress={clearAttendance}
                disabled={saving || athletes.length === 0}
              >
                <Text style={styles.clearText}>Сбросить</Text>
              </Pressable>
            </View>

            <Text style={styles.listTitle}>
              Спортсмены ({athletes.length})
            </Text>

            <Text style={styles.hint}>
              Нажимай на спортсмена, чтобы переключать отметку:
              не отмечен → присутствует → отсутствует → опоздал →
              уважительная причина.
            </Text>

            {athletes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  Нет участников тренировки
                </Text>
                <Text style={styles.message}>
                  Сначала добавь спортсменов в группу этой тренировки.
                </Text>
              </View>
            ) : (
              <View style={styles.athletesCard}>
                {athletes.map((athlete, index) => {
                  const status =
                    attendance[String(athlete.athleteId)] ?? 'unmarked';

                  const statusStyle = getStatusStyle(status);
                  const fullName =
                    `${athlete.name} ${athlete.surname}`.trim();

                  return (
                    <Pressable
                      key={athlete.athleteId}
                      onPress={() => updateStatus(athlete.athleteId)}
                      disabled={saving}
                      style={[
                        styles.athleteRow,
                        index !== athletes.length - 1 && styles.rowBorder,
                      ]}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {athlete.name.charAt(0)}
                          {athlete.surname.charAt(0)}
                        </Text>
                      </View>

                      <View style={styles.athleteInfo}>
                        <Text style={styles.athleteName}>
                          {fullName}
                        </Text>
                        <Text style={styles.athleteHint}>
                          Нажми, чтобы изменить статус
                        </Text>
                      </View>

                      <View
                        style={[styles.statusBadge, statusStyle.badge]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            statusStyle.symbolColor,
                          ]}
                        >
                          {statusStyle.symbol}
                        </Text>
                      </View>
                      <Text style={styles.statusLabel}>
                        {statusLabels[status]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              style={[
                styles.saveButton,
                (!hasChanges || saving || athletes.length === 0) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={saveAttendance}
              disabled={!hasChanges || saving || athletes.length === 0}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {hasChanges
                    ? 'Сохранить посещаемость'
                    : 'Изменений нет'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  trainingCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#111827',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#9CA3AF',
  },
  trainingTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trainingInfo: {
    marginTop: 6,
    fontSize: 14,
    color: '#D1D5DB',
  },
  trainingId: {
    marginTop: 10,
    fontSize: 12,
    color: '#9CA3AF',
  },
  summaryCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 16,
    gap: 4,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6B7280',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  presentText: {
    color: '#15803D',
  },
  absentText: {
    color: '#DC2626',
  },
  lateText: {
    color: '#D97706',
  },
  progressTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#16A34A',
  },
  excusedSummary: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  allPresentButton: {
    backgroundColor: '#DCFCE7',
  },
  allPresentText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  clearButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clearText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  hint: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  athletesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  athleteRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  athleteHint: {
    marginTop: 4,
    fontSize: 10,
    color: '#9CA3AF',
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentBadge: {
    backgroundColor: '#DCFCE7',
  },
  absentBadge: {
    backgroundColor: '#FEE2E2',
  },
  lateBadge: {
    backgroundColor: '#FEF3C7',
  },
  excusedBadge: {
    backgroundColor: '#DBEAFE',
  },
  unmarkedBadge: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 17,
    fontWeight: '700',
  },
  presentSymbol: {
    color: '#15803D',
  },
  absentSymbol: {
    color: '#DC2626',
  },
  lateSymbol: {
    color: '#B45309',
  },
  excusedSymbol: {
    color: '#1D4ED8',
  },
  unmarkedSymbol: {
    color: '#6B7280',
  },
  statusLabel: {
    width: 78,
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'right',
  },
  emptyCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  message: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 10,
    minWidth: 120,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  backButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});