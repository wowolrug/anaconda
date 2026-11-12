
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
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
  getCurrentUser,
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
  description: string;
  coachId: number;
  coachName: string;
  trainingGroupId: number | null;
  groupName: string | null;
  participantsCount: number;
};

type AttendanceRecord = {
  athleteId: number;
  status: string | number;
};

type MyAttendanceRecord = {
  trainingId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string | number;
  trainingStatus: string | number;
  description: string;
  coachName: string;
  groupName: string | null;
  attendanceStatus: string | number;
};

type PhysicalMeasurement = {
  physicalMeasurementId: number;
  athleteId: number;
  type: number | string | null;
  groupMetricId: number | null;
  groupMetricName: string | null;
  groupMetricUnit: string | null;
  trainingGroupId: number | null;
  value: number | string;
  measuredAt: string;
  note: string | null;
  recordedByUserId?: number;
  recordedByName?: string | null;
};

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
    month: 'short',
  });
}

function formatMeasurementDate(value: string) {
  const [year, month, day] = getDateKey(value).split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value: string) {
  const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/);

  return match ? match[1] : value.slice(0, 5);
}

function getDuration(startTime: string, endTime: string) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let minutes = endH * 60 + endM - startH * 60 - startM;

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

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Доброе утро 👋';
  if (hour < 18) return 'Добрый день 👋';

  return 'Добрый вечер 👋';
}

function getCountLabel(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const lastOne = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (lastOne === 1) return forms[0];
  if (lastOne >= 2 && lastOne <= 4) return forms[1];

  return forms[2];
}

function getAttendanceKind(status: string | number) {
  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    const value = Number(status);

    if (value === 1) return 'present';
    if (value === 2) return 'absent';
    if (value === 3) return 'late';
    if (value === 4) return 'excused';

    return 'unmarked';
  }

  const normalized = status.toLowerCase().replace(/[\s_-]/g, '');

  if (normalized === 'present') return 'present';
  if (normalized === 'absent') return 'absent';
  if (normalized === 'late') return 'late';
  if (normalized === 'excused') return 'excused';

  return 'unmarked';
}

function getAttendanceLabel(status: string | number) {
  const labels: Record<string, string> = {
    present: 'Присутствовал',
    absent: 'Отсутствовал',
    late: 'Опоздал',
    excused: 'Уважительная причина',
    unmarked: 'Не отмечено',
  };

  return labels[getAttendanceKind(status)];
}

function getAttendanceColor(status: string | number) {
  const colors: Record<string, string> = {
    present: '#16A34A',
    absent: '#DC2626',
    late: '#D97706',
    excused: '#2563EB',
    unmarked: '#6B7280',
  };

  return colors[getAttendanceKind(status)];
}

function calculateAttendance(records: AttendanceRecord[]) {
  // Учитываем присутствие, отсутствие и опоздание.
  // Неотмеченные и уважительные пропуски исключаются.
  const counted = records.filter((record) => {
    const kind = getAttendanceKind(record.status);

    return kind === 'present' || kind === 'absent' || kind === 'late';
  });

  if (counted.length === 0) return null;

  const attended = counted.filter((record) => {
    const kind = getAttendanceKind(record.status);

    return kind === 'present' || kind === 'late';
  }).length;

  return Math.round((attended / counted.length) * 100);
}

function calculatePersonalAttendance(records: MyAttendanceRecord[]) {
  return {
    total: records.length,
    present: records.filter(
      (r) => getAttendanceKind(r.attendanceStatus) === 'present',
    ).length,
    absent: records.filter(
      (r) => getAttendanceKind(r.attendanceStatus) === 'absent',
    ).length,
    late: records.filter(
      (r) => getAttendanceKind(r.attendanceStatus) === 'late',
    ).length,
    excused: records.filter(
      (r) => getAttendanceKind(r.attendanceStatus) === 'excused',
    ).length,
  };
}

export default function HomeScreen() {
  const router = useRouter();

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [coachName, setCoachName] = useState('Тренер');
  const [attendance, setAttendance] = useState<number | null>(null);

  const [measurements, setMeasurements] = useState<PhysicalMeasurement[]>([]);
  const [measurementsError, setMeasurementsError] = useState<string | null>(
    null,
  );

  const [myAttendance, setMyAttendance] = useState<MyAttendanceRecord[]>([]);
  const [myAttendanceError, setMyAttendanceError] = useState<string | null>(
    null,
  );

  const [role, setRole] = useState<string | null>(getCurrentRole);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка всех данных главной страницы.
  const loadHomeData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      await restoreSession();

      const currentRole = getCurrentRole();

      setRole(currentRole);

      // Спортсмен загружает только собственные данные.
      if (currentRole?.toLowerCase() === 'athlete') {
        const user = getCurrentUser();

        if (user?.userId != null) {
          // Физические показатели.
          try {
            const measurementsResponse = await api.get<
              PhysicalMeasurement[]
            >(`/PhysicalMeasurements/athlete/${user.userId}`);

            const sortedMeasurements = [...measurementsResponse.data].sort(
              (a, b) =>
                new Date(b.measuredAt).getTime() -
                new Date(a.measuredAt).getTime(),
            );

            setMeasurements(sortedMeasurements);
            setMeasurementsError(null);
          } catch {
            setMeasurements([]);
            setMeasurementsError(
              'Не удалось загрузить физические показатели.',
            );
          }

          // Личная посещаемость.
          try {
            const attendanceResponse = await api.get<MyAttendanceRecord[]>(
              '/Trainings/my-attendance',
            );

            setMyAttendance(attendanceResponse.data);
            setMyAttendanceError(null);
          } catch {
            setMyAttendance([]);
            setMyAttendanceError(
              'Не удалось загрузить историю посещаемости.',
            );
          }
        } else {
          setMeasurements([]);
          setMeasurementsError('Не удалось определить аккаунт спортсмена.');
          setMyAttendance([]);
          setMyAttendanceError('Не удалось определить аккаунт спортсмена.');
        }
      } else {
        setMeasurements([]);
        setMeasurementsError(null);
        setMyAttendance([]);
        setMyAttendanceError(null);
      }

      const response = await api.get<Training[]>('/Trainings');
      const data = response.data;

      setTrainings(data);
      setHasLoaded(true);

      const name = data.find((training) => training.coachName)?.coachName;

      if (name) {
        setCoachName(name);
      }

      // Только тренер получает сводную статистику посещаемости группы.
      if (currentRole?.toLowerCase() !== 'coach') {
        setAttendance(null);
        return;
      }

      const today = getTodayKey();

      const todaysTrainings = data.filter(
        (training) => getDateKey(training.date) === today,
      );

      if (todaysTrainings.length === 0) {
        setAttendance(null);
        return;
      }

      const attendanceResponses = await Promise.all(
        todaysTrainings.map((training) =>
          api
            .get<AttendanceRecord[]>(
              `/Trainings/${training.trainingId}/attendance`,
            )
            .then((result) => result.data)
            .catch(() => null),
        ),
      );

      const successfulResponses = attendanceResponses.filter(
        (records): records is AttendanceRecord[] => records !== null,
      );

      if (successfulResponses.length === 0) {
        setAttendance(null);
        return;
      }

      setAttendance(calculateAttendance(successfulResponses.flat()));
    } catch {
      setError('Не удалось загрузить данные главной страницы');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribeRole = subscribeRole((nextRole) => {
      setRole(nextRole);
    });

    void loadHomeData();

    return () => {
      unsubscribeRole();
    };
  }, [loadHomeData]);

  const normalizedRole = role?.toLowerCase();
  const isCoach = normalizedRole === 'coach';
  const isAthlete = normalizedRole === 'athlete';
  const isParent = normalizedRole === 'parent';

  // Если роль ещё не восстановлена, используем безопасный интерфейс
  // без тренерских действий.
  const headerName = isCoach
    ? coachName
    : isParent
      ? 'Расписание ребёнка'
      : 'Мои тренировки';

  const todayKey = getTodayKey();

  const upcomingTrainings = trainings
    .filter(
      (training) =>
        getDateKey(training.date) >= todayKey &&
        getTrainingStatus(training.status) !== 'Отменена',
    )
    .sort((a, b) => {
      const byDate = getDateKey(a.date).localeCompare(getDateKey(b.date));

      if (byDate !== 0) return byDate;

      return formatTime(a.startTime).localeCompare(formatTime(b.startTime));
    });

  const todayTrainings = upcomingTrainings.filter(
    (training) => getDateKey(training.date) === todayKey,
  );

  const firstTraining = upcomingTrainings[0] ?? null;

  // Это число мест в сегодняшних тренировках, а не число уникальных людей.
  const athletePlacesToday = todayTrainings.reduce(
    (total, training) => total + training.participantsCount,
    0,
  );

  // Берём последнее измерение каждой пользовательской метрики.
  const seenMetricIds = new Set<number>();

  const latestMeasurements = measurements.filter((measurement) => {
    if (
      measurement.groupMetricId == null ||
      !measurement.groupMetricName ||
      seenMetricIds.has(measurement.groupMetricId)
    ) {
      return false;
    }

    seenMetricIds.add(measurement.groupMetricId);
    return true;
  });

  const attendanceStats = calculatePersonalAttendance(myAttendance);

  const attendanceCounted =
    attendanceStats.present +
    attendanceStats.absent +
    attendanceStats.late;

  const personalAttendancePercent =
    attendanceCounted > 0
      ? Math.round(
          ((attendanceStats.present + attendanceStats.late) /
            attendanceCounted) *
            100,
        )
      : null;

  const recentAttendance = myAttendance.slice(0, 10);

  const today = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });

  function openTraining(training: Training) {
    router.push({
      pathname: '/training-details',
      params: { id: String(training.trainingId) },
    });
  }

  function openAllTrainings() {
    router.push('/(tabs)/trainings');
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
              void loadHomeData(true);
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
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{headerName}</Text>
          </View>

          <View style={styles.profileButton}>
            <Text style={styles.profileButtonText}>
              {headerName.trim().charAt(0).toUpperCase() || 'Т'}
            </Text>
          </View>
        </View>

        <Text style={styles.date}>Сегодня, {today}</Text>

        {loading && !hasLoaded && (
          <Text style={styles.message}>Загружаем главную страницу...</Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {(!loading || hasLoaded) && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isCoach
                  ? 'Ближайшая тренировка'
                  : isParent
                    ? 'Ближайшая тренировка ребёнка'
                    : 'Твоя ближайшая тренировка'}
              </Text>

              {firstTraining ? (
                <Pressable
                  style={styles.trainingCard}
                  onPress={() => openTraining(firstTraining)}
                >
                  <View style={styles.trainingTop}>
                    <View style={styles.nextTrainingContent}>
                      <Text style={styles.trainingType}>
                        {getTrainingType(firstTraining.type)}
                      </Text>

                      <Text style={styles.trainingGroup}>
                        {firstTraining.groupName ?? 'Без группы'}
                      </Text>

                      <Text style={styles.nextTrainingDate}>
                        {formatDate(firstTraining.date)}
                      </Text>

                      {!isCoach && firstTraining.coachName ? (
                        <Text style={styles.coachMeta}>
                          Тренер: {firstTraining.coachName}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.arrowCircle}>
                      <Text style={styles.arrow}>›</Text>
                    </View>
                  </View>

                  <View style={styles.trainingInfo}>
                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>Время</Text>
                      <Text style={styles.infoValue}>
                        {formatTime(firstTraining.startTime)}
                      </Text>
                      <Text style={styles.infoHint}>
                        до {formatTime(firstTraining.endTime)}
                      </Text>
                    </View>

                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>Длительность</Text>
                      <Text style={styles.infoValue}>
                        {getDuration(
                          firstTraining.startTime,
                          firstTraining.endTime,
                        )}
                      </Text>
                    </View>

                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>
                        {isCoach ? 'Спортсмены' : 'Статус'}
                      </Text>
                      <Text style={styles.infoValue}>
                        {isCoach
                          ? firstTraining.participantsCount
                          : getTrainingStatus(firstTraining.status)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    {isCoach
                      ? 'Предстоящих тренировок нет'
                      : isParent
                        ? 'Предстоящих тренировок ребёнка нет'
                        : 'Предстоящих тренировок нет'}
                  </Text>

                  <Text style={styles.emptySubtitle}>
                    {isCoach
                      ? 'Создай тренировку, чтобы добавить её в расписание.'
                      : isParent
                        ? 'Когда тренер запланирует занятия, они появятся здесь.'
                        : 'Когда тренер добавит тебя в тренировку, она появится здесь.'}
                  </Text>

                  {isCoach ? (
                    <Pressable
                      style={styles.emptyAction}
                      onPress={() => router.push('/create-training')}
                    >
                      <Text style={styles.emptyActionText}>
                        Создать тренировку
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.emptyAction}
                      onPress={openAllTrainings}
                    >
                      <Text style={styles.emptyActionText}>
                        Открыть расписание
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {isCoach ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Сегодня</Text>

                  <View style={styles.statsRow}>
                    <StatCard
                      value={todayTrainings.length}
                      label={getCountLabel(todayTrainings.length, [
                        'тренировка',
                        'тренировки',
                        'тренировок',
                      ])}
                    />

                    <StatCard
                      value={athletePlacesToday}
                      label="участий спортсменов"
                    />

                    <StatCard
                      value={attendance === null ? '—' : `${attendance}%`}
                      label="посещаемость"
                    />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Быстрые действия</Text>

                  <View style={styles.actions}>
                    <ActionButton
                      icon="+"
                      title="Создать тренировку"
                      onPress={() => router.push('/create-training')}
                    />

                    <ActionButton
                      icon="✓"
                      title="Посещаемость"
                      onPress={() => {
                        if (todayTrainings[0]) {
                          openTraining(todayTrainings[0]);
                        } else {
                          openAllTrainings();
                        }
                      }}
                    />

                    <ActionButton
                      icon="👤"
                      title="Спортсмены"
                      onPress={() => router.push('/(tabs)/athletes')}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {isParent ? 'Расписание ребёнка' : 'Моё расписание'}
                  </Text>

                  <View style={styles.statsRow}>
                    <StatCard
                      value={todayTrainings.length}
                      label={getCountLabel(todayTrainings.length, [
                        'тренировка сегодня',
                        'тренировки сегодня',
                        'тренировок сегодня',
                      ])}
                    />

                    <StatCard
                      value={upcomingTrainings.length}
                      label="предстоящих занятий"
                    />
                  </View>

                  <Pressable
                    style={styles.scheduleButton}
                    onPress={openAllTrainings}
                  >
                    <Text style={styles.scheduleButtonText}>
                      Все тренировки
                    </Text>
                    <Text style={styles.scheduleButtonArrow}>›</Text>
                  </Pressable>
                </View>

                {isAthlete && (
                  <>
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        Мои физические показатели
                      </Text>

                      {measurementsError ? (
                        <Text style={styles.error}>
                          {measurementsError}
                        </Text>
                      ) : latestMeasurements.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyTitle}>
                            Пока нет показателей
                          </Text>

                          <Text style={styles.emptySubtitle}>
                            Когда тренер добавит измерения, они появятся здесь.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.measurementsList}>
                          {latestMeasurements.map((measurement) => (
                            <View
                              key={measurement.groupMetricId}
                              style={styles.measurementCard}
                            >
                              <View style={styles.measurementInfo}>
                                <Text style={styles.measurementName}>
                                  {measurement.groupMetricName}
                                </Text>

                                <Text style={styles.measurementDate}>
                                  {formatMeasurementDate(
                                    measurement.measuredAt,
                                  )}
                                </Text>
                              </View>

                              <Text style={styles.measurementValue}>
                                {Number(measurement.value).toLocaleString(
                                  'ru-RU',
                                  {
                                    maximumFractionDigits: 2,
                                  },
                                )}
                                {measurement.groupMetricUnit
                                  ? ` ${measurement.groupMetricUnit}`
                                  : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        Моя посещаемость
                      </Text>

                      {myAttendanceError ? (
                        <Text style={styles.error}>
                          {myAttendanceError}
                        </Text>
                      ) : myAttendance.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyTitle}>
                            История пока пуста
                          </Text>

                          <Text style={styles.emptySubtitle}>
                            Когда появятся тренировки, здесь будет отображаться
                            твоя посещаемость.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.statsRow}>
                            <StatCard
                              value={attendanceStats.total}
                              label="всего тренировок"
                            />

                            <StatCard
                              value={
                                personalAttendancePercent === null
                                  ? '—'
                                  : `${personalAttendancePercent}%`
                              }
                              label="посещаемость"
                            />
                          </View>

                          <View
                            style={[
                              styles.statsRow,
                              { marginTop: 8 },
                            ]}
                          >
                            <StatCard
                              value={attendanceStats.present}
                              label="присутствовал"
                            />

                            <StatCard
                              value={attendanceStats.absent}
                              label="отсутствовал"
                            />
                          </View>

                          <View
                            style={[
                              styles.statsRow,
                              { marginTop: 8 },
                            ]}
                          >
                            <StatCard
                              value={attendanceStats.late}
                              label="опоздал"
                            />

                            <StatCard
                              value={attendanceStats.excused}
                              label="уважительная причина"
                            />
                          </View>

                          <Text style={styles.attendanceSubtitle}>
                            Последние тренировки
                          </Text>

                          {recentAttendance.map((record, index) => (
                            <View
                              key={`${record.trainingId}-${index}`}
                              style={styles.attendanceCard}
                            >
                              <View style={styles.attendanceInfo}>
                                <Text style={styles.attendanceTraining}>
                                  {getTrainingType(record.type)}
                                </Text>

                                <Text style={styles.attendanceDate}>
                                  {formatDate(record.date)} ·{' '}
                                  {formatTime(record.startTime)}
                                </Text>

                                <Text style={styles.attendanceCoach}>
                                  {record.groupName ?? 'Без группы'}
                                  {record.coachName
                                    ? ` · ${record.coachName}`
                                    : ''}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.attendanceBadge,
                                  {
                                    backgroundColor: `${getAttendanceColor(
                                      record.attendanceStatus,
                                    )}18`,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.attendanceBadgeText,
                                    {
                                      color: getAttendanceColor(
                                        record.attendanceStatus,
                                      ),
                                    },
                                  ]}
                                >
                                  {getAttendanceLabel(
                                    record.attendanceStatus,
                                  )}
                                </Text>
                              </View>
                            </View>
                          ))}

                          {myAttendance.length > 10 && (
                            <Text style={styles.attendanceFooter}>
                              Показаны последние 10 из {myAttendance.length}{' '}
                              тренировок.
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  </>
                )}
              </>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isCoach
                    ? 'Сегодняшние тренировки'
                    : isParent
                      ? 'Тренировки ребёнка сегодня'
                      : 'Твои тренировки сегодня'}
                </Text>

                <Pressable onPress={openAllTrainings}>
                  <Text style={styles.link}>Все</Text>
                </Pressable>
              </View>

              {todayTrainings.length === 0 ? (
                <Text style={styles.message}>
                  {isCoach
                    ? 'На сегодня тренировок нет'
                    : 'На сегодня занятий нет'}
                </Text>
              ) : (
                todayTrainings.map((training) => (
                  <Pressable
                    key={training.trainingId}
                    style={styles.listCard}
                    onPress={() => openTraining(training)}
                  >
                    <View style={styles.timeBlock}>
                      <Text style={styles.listTime}>
                        {formatTime(training.startTime)}
                      </Text>

                      <Text style={styles.listDuration}>
                        {getDuration(training.startTime, training.endTime)}
                      </Text>
                    </View>

                    <View style={styles.listContent}>
                      <Text style={styles.listTitle}>
                        {getTrainingType(training.type)}
                      </Text>

                      <Text style={styles.listSubtitle}>
                        {training.groupName ?? 'Без группы'}
                      </Text>

                      <Text style={styles.listMeta}>
                        {isCoach
                          ? `${training.participantsCount} ${getCountLabel(
                              training.participantsCount,
                              ['спортсмен', 'спортсмена', 'спортсменов'],
                            )}`
                          : isParent
                            ? `Тренер: ${training.coachName || 'не указан'}`
                            : `Статус: ${getTrainingStatus(training.status)}`}
                      </Text>
                    </View>

                    <Text style={styles.listArrow}>›</Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  title,
  onPress,
}: {
  icon: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Text style={styles.actionIconText}>{icon}</Text>
      </View>

      <Text style={styles.actionTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 2,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  date: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  trainingCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
  },
  trainingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextTrainingContent: {
    flex: 1,
    paddingRight: 10,
  },
  trainingType: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  trainingGroup: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 4,
  },
  nextTrainingDate: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 7,
  },
  coachMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 7,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 28,
  },
  trainingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  infoColumn: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  infoHint: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 6,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 15,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  statValue: {
    fontSize: 23,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: '#6B7280',
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 20,
    color: '#2563EB',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  scheduleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  scheduleButtonArrow: {
    fontSize: 24,
    color: '#6B7280',
  },
  measurementsList: {
    gap: 10,
  },
  measurementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  measurementInfo: {
    flex: 1,
    paddingRight: 12,
  },
  measurementName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  measurementDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 5,
  },
  measurementValue: {
    fontSize: 19,
    fontWeight: '700',
    color: '#2563EB',
  },
  attendanceSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 22,
    marginBottom: 12,
  },
  attendanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  attendanceInfo: {
    flex: 1,
    minWidth: 0,
  },
  attendanceTraining: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  attendanceDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  attendanceCoach: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  attendanceBadge: {
    maxWidth: 145,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  attendanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  attendanceFooter: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    width: 68,
  },
  listTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  listDuration: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },
  listContent: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  listSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  listMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 5,
  },
  listArrow: {
    fontSize: 25,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  message: {
    marginVertical: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  error: {
    marginVertical: 12,
    fontSize: 14,
    color: '#DC2626',
  },
});
