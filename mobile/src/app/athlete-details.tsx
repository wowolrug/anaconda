
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { restoreSession } from '@/api/auth';

// Измерения спортсмена
type Measurement = {
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
  recordedByName?: string;
};

// Группа спортсменов
type TrainingGroup = {
  trainingGroupId: number;
  name: string;
};

// Спортсмен в составе группы
type AthleteInGroup = {
  athleteId: number;
  name: string;
  surname: string;
};

// Пользовательская метрика группы
type GroupMetric = {
  groupMetricId: number;
  trainingGroupId: number;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
  groupName: string;
};

// Заметки спортсмена
type AthleteNote = {
  athleteNoteId: number;
  athleteId: number;
  authorUserId: number;
  trainingId: number | null;
  type: number | string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  canEdit?: boolean;
};

const CHART_HEIGHT = 155;
const CHART_LEFT_PADDING = 42;
const CHART_RIGHT_PADDING = 12;

function getTodayValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
}

function formatNoteDate(value: string) {
  const date = new Date(value);

  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNoteType(type: number | string) {
  const types: Record<number, string> = {
    0: 'Тренер',
    1: 'Спортсмен',
  };

  if (typeof type === 'number' || /^\d+$/.test(String(type))) {
    return types[Number(type)] ?? 'Заметка';
  }

  const normalized = String(type).toLowerCase().replace(/[\s_-]/g, '');

  const names: Record<string, string> = {
    coach: 'Тренер',
    athlete: 'Спортсмен',
  };

  return names[normalized] ?? 'Заметка';
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export default function AthleteDetailsScreen() {
  const params = useLocalSearchParams<{
    athleteId?: string | string[];
    name?: string | string[];
    surname?: string | string[];
  }>();

  const router = useRouter();

  const athleteId = Array.isArray(params.athleteId)
    ? params.athleteId[0]
    : params.athleteId;

  const name = Array.isArray(params.name)
    ? params.name[0]
    : params.name;

  const surname = Array.isArray(params.surname)
    ? params.surname[0]
    : params.surname;

  const athleteName =
    `${name ?? ''} ${surname ?? ''}`.trim() || 'Спортсмен';

  // Измерения
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Метрики групп
  const [groupMetrics, setGroupMetrics] = useState<GroupMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(
    null,
  );

  // Форма нового измерения
  const [metricValue, setMetricValue] = useState('');
  const [metricDate, setMetricDate] = useState(getTodayValue());
  const [metricNote, setMetricNote] = useState('');
  const [savingMetric, setSavingMetric] = useState(false);

  // Заметки спортсмена
  const [notes, setNotes] = useState<AthleteNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteTrainingId, setEditingNoteTrainingId] = useState<
    number | null
  >(null);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  // Загрузка всех измерений спортсмена
  const loadMeasurements = useCallback(async () => {
    if (!athleteId || !/^\d+$/.test(athleteId)) {
      setError('Не указан корректный ID спортсмена.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await restoreSession();

      const response = await api.get<Measurement[]>(
        `/PhysicalMeasurements/athlete/${athleteId}`,
      );

      setMeasurements(
        [...response.data].sort(
          (a, b) =>
            new Date(b.measuredAt).getTime() -
            new Date(a.measuredAt).getTime(),
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401) {
        setError('Сессия истекла. Войди в аккаунт заново.');
      } else if (status === 403) {
        setError('У тебя нет доступа к показателям этого спортсмена.');
      } else if (status === 404) {
        setError('Спортсмен не найден или недоступен.');
      } else {
        setError('Не удалось загрузить показатели спортсмена.');
      }
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  // Загрузка метрик групп, в которых состоит спортсмен
  const loadGroupMetrics = useCallback(async () => {
    if (!athleteId || !/^\d+$/.test(athleteId)) {
      setMetricsError('Не указан корректный ID спортсмена.');
      setMetricsLoading(false);
      return;
    }

    try {
      setMetricsLoading(true);
      setMetricsError(null);

      await restoreSession();

      const groupsResponse = await api.get<TrainingGroup[]>('/Groups');
      const groups = groupsResponse.data;

      const athleteGroups: TrainingGroup[] = [];

      await Promise.all(
        groups.map(async (group) => {
          try {
            const rosterResponse = await api.get<AthleteInGroup[]>(
              `/Groups/${group.trainingGroupId}/athletes`,
            );

            const isMember = rosterResponse.data.some(
              (athlete) => athlete.athleteId === Number(athleteId),
            );

            if (isMember) {
              athleteGroups.push(group);
            }
          } catch {
            // Ошибка одной группы не прерывает загрузку остальных.
          }
        }),
      );

      const metricsResponses = await Promise.all(
        athleteGroups.map(async (group) => {
          const response = await api.get<GroupMetric[]>(
            `/GroupMetrics/group/${group.trainingGroupId}`,
          );

          return response.data.map((metric) => ({
            ...metric,
            groupName: group.name,
          }));
        }),
      );

      const allMetrics = metricsResponses
        .flat()
        .sort((a, b) => {
          if (a.groupName !== b.groupName) {
            return a.groupName.localeCompare(b.groupName, 'ru');
          }

          if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1;
          }

          return a.name.localeCompare(b.name, 'ru');
        });

      setGroupMetrics(allMetrics);

      setSelectedMetricId((current) => {
        if (
          current !== null &&
          allMetrics.some((metric) => metric.groupMetricId === current)
        ) {
          return current;
        }

        const firstActive = allMetrics.find((metric) => metric.isActive);

        return firstActive?.groupMetricId ?? allMetrics[0]?.groupMetricId ?? null;
      });
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401) {
        setMetricsError('Сессия истекла. Войди в аккаунт заново.');
      } else if (status === 403) {
        setMetricsError('Нет доступа к группам спортсмена.');
      } else {
        setMetricsError('Не удалось загрузить метрики групп.');
      }
    } finally {
      setMetricsLoading(false);
    }
  }, [athleteId]);

  // Загрузка заметок спортсмена
  const loadNotes = useCallback(async () => {
    if (!athleteId || !/^\d+$/.test(athleteId)) {
      setNotesError('Не указан корректный ID спортсмена.');
      setNotesLoading(false);
      return;
    }

    try {
      setNotesLoading(true);
      setNotesError(null);

      await restoreSession();

      const response = await api.get<AthleteNote[]>(
        `/AthleteNotes/athlete/${athleteId}`,
      );

      setNotes(
        [...response.data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401) {
        setNotesError('Сессия истекла. Войди в аккаунт заново.');
      } else if (status === 403 || status === 404) {
        setNotesError('Спортсмен не найден или недоступен.');
      } else {
        setNotesError('Не удалось загрузить заметки.');
      }
    } finally {
      setNotesLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadMeasurements();
  }, [loadMeasurements]);

  useEffect(() => {
    void loadGroupMetrics();
  }, [loadGroupMetrics]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // Выбранная метрика
  const selectedMetric = useMemo(
    () =>
      groupMetrics.find(
        (metric) => metric.groupMetricId === selectedMetricId,
      ) ?? null,
    [groupMetrics, selectedMetricId],
  );

  // История выбранной метрики
  const metricMeasurements = useMemo(
    () =>
      measurements
        .filter(
          (measurement) =>
            measurement.groupMetricId === selectedMetricId,
        )
        .sort(
          (a, b) =>
            new Date(b.measuredAt).getTime() -
            new Date(a.measuredAt).getTime(),
        ),
    [measurements, selectedMetricId],
  );

  const latestMetricMeasurement = metricMeasurements[0];

  // Данные графика: от старых измерений к новым
  const chartData = useMemo(
    () =>
      [...metricMeasurements]
        .reverse()
        .map((measurement) => ({
          id: measurement.physicalMeasurementId,
          value: Number(measurement.value),
          date: measurement.measuredAt,
        }))
        .filter((item) => Number.isFinite(item.value)),
    [metricMeasurements],
  );

  // Размеры графика
  const chartWidth = Math.max(
    240,
    Dimensions.get('window').width - 80,
  );

  const chartPlotWidth =
    chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING;

  // Диапазон значений
  const chartStats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        min: 0,
        max: 0,
        difference: 0,
      };
    }

    const values = chartData.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      min,
      max,
      difference: max - min,
    };
  }, [chartData]);

  // Координаты точек графика
  const chartPoints = useMemo(() => {
    if (chartData.length === 0) {
      return [];
    }

    const range =
      chartStats.difference === 0
        ? Math.max(Math.abs(chartStats.max) * 0.2, 1)
        : chartStats.difference;

    const min = chartStats.min - range * 0.15;
    const max = chartStats.max + range * 0.15;
    const valueRange = max - min;

    return chartData.map((item, index) => {
      const x =
        chartData.length === 1
          ? chartPlotWidth / 2
          : (index / (chartData.length - 1)) * chartPlotWidth;

      const y =
        CHART_HEIGHT -
        ((item.value - min) / valueRange) * CHART_HEIGHT;

      return {
        ...item,
        x,
        y,
      };
    });
  }, [chartData, chartStats, chartPlotWidth]);

  // Сохранение измерения пользовательской метрики
  async function saveGroupMetricMeasurement() {
    if (savingMetric) return;

    if (!athleteId || !/^\d+$/.test(athleteId)) {
      Alert.alert('Ошибка', 'Не указан корректный ID спортсмена.');
      return;
    }

    if (!selectedMetric || !selectedMetric.isActive) {
      Alert.alert('Ошибка', 'Выбери активную метрику.');
      return;
    }

    const parsedValue = Number(metricValue.trim().replace(',', '.'));

    if (
      !metricValue.trim() ||
      !Number.isFinite(parsedValue) ||
      parsedValue <= 0
    ) {
      Alert.alert(
        'Проверь значение',
        'Введи число больше нуля, например 25 или 72.5.',
      );
      return;
    }

    if (!isValidDate(metricDate)) {
      Alert.alert('Проверь дату', 'Используй формат ГГГГ-ММ-ДД.');
      return;
    }

    try {
      setSavingMetric(true);
      await restoreSession();

      await api.post(
        `/PhysicalMeasurements/athlete/${athleteId}/metric/${selectedMetric.groupMetricId}`,
        {
          value: parsedValue,
          measuredAt: `${metricDate}T00:00:00Z`,
          note: metricNote.trim() || null,
        },
      );

      setMetricValue('');
      setMetricNote('');

      await loadMeasurements();

      Alert.alert(
        'Сохранено',
        'Измерение добавлено в историю спортсмена.',
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      let message = 'Не удалось сохранить измерение.';

      if (status === 400) {
        message = serverMessage ?? 'Проверь значение измерения.';
      } else if (status === 401) {
        message = 'Сессия истекла. Войди в аккаунт заново.';
      } else if (status === 403) {
        message = 'Добавлять измерения может только тренер.';
      } else if (status === 404) {
        message = 'Метрика или спортсмен не найдены.';
      }

      Alert.alert('Ошибка сохранения', message);
    } finally {
      setSavingMetric(false);
    }
  }

  // Сохранение заметки
  async function saveNote() {
    if (savingNote) return;

    if (!athleteId || !/^\d+$/.test(athleteId)) {
      Alert.alert('Ошибка', 'Не указан корректный ID спортсмена.');
      return;
    }

    const text = noteText.trim();

    if (!text) {
      Alert.alert('Пустая заметка', 'Сначала введи текст заметки.');
      return;
    }

    const wasEditing = editingNoteId !== null;

    try {
      setSavingNote(true);
      await restoreSession();

      if (editingNoteId !== null) {
        await api.put(`/AthleteNotes/${editingNoteId}`, {
          text,
          trainingId: editingNoteTrainingId,
        });
      } else {
        await api.post(`/AthleteNotes/athlete/${athleteId}`, {
          text,
          trainingId: null,
        });
      }

      setNoteText('');
      setEditingNoteId(null);
      setEditingNoteTrainingId(null);

      await loadNotes();

      Alert.alert(
        'Сохранено',
        wasEditing
          ? 'Изменения заметки сохранены.'
          : 'Заметка добавлена в историю спортсмена.',
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      let message = 'Не удалось сохранить заметку.';

      if (status === 400) {
        message = serverMessage ?? 'Проверь текст заметки.';
      } else if (status === 401) {
        message = 'Сессия истекла. Войди в аккаунт заново.';
      } else if (status === 403) {
        message = 'Редактировать эту заметку может только её автор.';
      } else if (status === 404) {
        message = 'Заметка или спортсмен не найдены.';
      }

      Alert.alert('Ошибка сохранения', message);
    } finally {
      setSavingNote(false);
    }
  }

  function editNote(athleteNote: AthleteNote) {
    setEditingNoteId(athleteNote.athleteNoteId);
    setEditingNoteTrainingId(athleteNote.trainingId);
    setNoteText(athleteNote.text);
  }

  function cancelNoteEdit() {
    setEditingNoteId(null);
    setEditingNoteTrainingId(null);
    setNoteText('');
  }

  function deleteNote(athleteNote: AthleteNote) {
    Alert.alert(
      'Удалить заметку?',
      'Это действие нельзя отменить.',
      [
        { text: 'Оставить', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void performDeleteNote(athleteNote);
          },
        },
      ],
    );
  }

  async function performDeleteNote(athleteNote: AthleteNote) {
    if (deletingNoteId !== null) return;

    try {
      setDeletingNoteId(athleteNote.athleteNoteId);
      await restoreSession();

      await api.delete(`/AthleteNotes/${athleteNote.athleteNoteId}`);

      setNotes((current) =>
        current.filter(
          (item) => item.athleteNoteId !== athleteNote.athleteNoteId,
        ),
      );

      if (editingNoteId === athleteNote.athleteNoteId) {
        cancelNoteEdit();
      }

      Alert.alert('Готово', 'Заметка удалена.');
    } catch (err: any) {
      const status = err?.response?.status;

      let message = 'Не удалось удалить заметку.';

      if (status === 401) {
        message = 'Сессия истекла. Войди в аккаунт заново.';
      } else if (status === 403) {
        message = 'Удалить заметку может только её автор.';
      } else if (status === 404) {
        message = 'Заметка не найдена.';
      }

      Alert.alert('Ошибка удаления', message);
    } finally {
      setDeletingNoteId(null);
    }
  }

  // Рисование графика
  function renderChart() {
    if (chartData.length === 0 || !selectedMetric) {
      return null;
    }

    const gridValues = [0, 1, 2].map((index) => {
      const range =
        chartStats.difference === 0
          ? Math.max(Math.abs(chartStats.max) * 0.2, 1)
          : chartStats.difference;

      const min = chartStats.min - range * 0.15;
      const max = chartStats.max + range * 0.15;

      return max - ((max - min) * index) / 2;
    });

    const labelIndexes = Array.from(
      new Set([
        0,
        Math.floor((chartData.length - 1) / 2),
        chartData.length - 1,
      ]),
    );

    return (
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Динамика показателя</Text>
            <Text style={styles.chartSubtitle}>
              {selectedMetric.name} · {selectedMetric.unit}
            </Text>
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.chartLegendDot} />
            <Text style={styles.chartLegendText}>Измерения</Text>
          </View>
        </View>

        {chartData.length < 2 ? (
          <View style={styles.chartNotEnough}>
            <View style={styles.singlePoint}>
              <View style={styles.chartPoint} />
            </View>
            <Text style={styles.chartNotEnoughText}>
              Для построения графика добавь ещё одно измерение.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.chartBody}>
              <View style={styles.chartYAxis}>
                {gridValues.map((value, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.chartAxisLabel,
                      { top: (CHART_HEIGHT / 2) * index - 8 },
                    ]}
                  >
                    {value.toLocaleString('ru-RU', {
                      maximumFractionDigits: 1,
                    })}
                  </Text>
                ))}
              </View>

              <View
                style={[
                  styles.chartPlot,
                  {
                    width: chartPlotWidth,
                    height: CHART_HEIGHT,
                  },
                ]}
              >
                {/* Горизонтальные линии сетки */}
                {[0, 1, 2].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.chartGridLine,
                      { top: (CHART_HEIGHT / 2) * index },
                    ]}
                  />
                ))}

                {/* Линии между точками */}
                {chartPoints.slice(0, -1).map((point, index) => {
                  const next = chartPoints[index + 1];

                  const dx = next.x - point.x;
                  const dy = next.y - point.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx);

                  return (
                    <View
                      key={`line-${point.id}`}
                      style={[
                        styles.chartLine,
                        {
                          left: point.x,
                          top: point.y,
                          width: length,
                          transform: [
                            { translateY: -1.5 },
                            { rotate: `${angle}rad` },
                          ],
                        },
                      ]}
                    />
                  );
                })}

                {/* Точки измерений */}
                {chartPoints.map((point) => (
                  <View
                    key={point.id}
                    style={[
                      styles.chartPoint,
                      {
                        left: point.x - 5,
                        top: point.y - 5,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Даты под графиком */}
            <View
              style={[
                styles.chartXAxis,
                {
                  marginLeft: CHART_LEFT_PADDING,
                  width: chartPlotWidth,
                },
              ]}
            >
              {labelIndexes.map((index) => {
                const point = chartData[index];

                const alignment =
                  index === 0
                    ? 'left'
                    : index === chartData.length - 1
                      ? 'right'
                      : 'center';

                return (
                  <Text
                    key={point.id}
                    style={[
                      styles.chartDateLabel,
                      {
                        left:
                          chartData.length === 1
                            ? 0
                            : (index / (chartData.length - 1)) *
                              chartPlotWidth,
                        textAlign: alignment,
                        transform: [
                          {
                            translateX:
                              alignment === 'left'
                                ? 0
                                : alignment === 'right'
                                  ? -55
                                  : -27,
                          },
                        ],
                      },
                    ]}
                  >
                    {formatShortDate(point.date)}
                  </Text>
                );
              })}
            </View>

            <View style={styles.chartSummary}>
              <View style={styles.chartSummaryItem}>
                <Text style={styles.chartSummaryLabel}>Минимум</Text>
                <Text style={styles.chartSummaryValue}>
                  {chartStats.min.toLocaleString('ru-RU', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  {selectedMetric.unit}
                </Text>
              </View>

              <View style={styles.chartSummaryItem}>
                <Text style={styles.chartSummaryLabel}>Максимум</Text>
                <Text style={styles.chartSummaryValue}>
                  {chartStats.max.toLocaleString('ru-RU', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  {selectedMetric.unit}
                </Text>
              </View>

              <View style={styles.chartSummaryItem}>
                <Text style={styles.chartSummaryLabel}>Измерений</Text>
                <Text style={styles.chartSummaryValue}>
                  {chartData.length}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Профиль спортсмена' }} />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.message}>Загружаем показатели...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadMeasurements()}
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
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Шапка профиля */}
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(name ?? 'С').charAt(0)}
                  {(surname ?? 'П').charAt(0)}
                </Text>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.athleteName}>{athleteName}</Text>
                <Text style={styles.profileSubtitle}>
                  Физические показатели
                </Text>
              </View>
            </View>

            {/* Метрики групп */}
            <View style={styles.metricsSection}>
              <View style={styles.metricsHeader}>
                <Text style={styles.sectionTitle}>
                  Физические показатели
                </Text>

                <Text style={styles.metricsCount}>
                  {groupMetrics.length}
                </Text>
              </View>

              {metricsLoading ? (
                <View style={styles.emptyCard}>
                  <ActivityIndicator color="#2563EB" />
                  <Text style={[styles.emptyText, { marginTop: 10 }]}>
                    Загружаем метрики...
                  </Text>
                </View>
              ) : metricsError ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.error}>{metricsError}</Text>

                  <Pressable
                    style={styles.retryButton}
                    onPress={() => void loadGroupMetrics()}
                  >
                    <Text style={styles.retryButtonText}>Повторить</Text>
                  </Pressable>
                </View>
              ) : groupMetrics.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    Для групп спортсмена пока не созданы метрики.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.metricsHint}>
                    Выбери показатель, чтобы посмотреть его историю или
                    добавить новое измерение.
                  </Text>

                  <View style={styles.metricSelector}>
                    {groupMetrics.map((metric) => {
                      const selected =
                        selectedMetricId === metric.groupMetricId;

                      return (
                        <Pressable
                          key={metric.groupMetricId}
                          style={[
                            styles.metricButton,
                            selected && styles.metricButtonSelected,
                            !metric.isActive &&
                              styles.metricButtonArchived,
                          ]}
                          onPress={() =>
                            setSelectedMetricId(metric.groupMetricId)
                          }
                        >
                          <View style={styles.metricButtonTitleRow}>
                            <Text
                              style={[
                                styles.metricButtonText,
                                selected &&
                                  styles.metricButtonTextSelected,
                              ]}
                            >
                              {metric.name}
                            </Text>

                            {!metric.isActive && (
                              <Text style={styles.archivedLabel}>
                                Архив
                              </Text>
                            )}
                          </View>

                          <Text
                            style={[
                              styles.metricButtonUnit,
                              selected &&
                                styles.metricButtonTextSelected,
                            ]}
                          >
                            {metric.unit} · {metric.groupName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedMetric && (
                    <>
                      {/* Последнее измерение */}
                      <View style={styles.latestCard}>
                        <Text style={styles.latestLabel}>
                          Последнее измерение · {selectedMetric.name}
                        </Text>

                        {latestMetricMeasurement ? (
                          <>
                            <View style={styles.latestValueRow}>
                              <Text style={styles.latestValue}>
                                {Number(
                                  latestMetricMeasurement.value,
                                ).toLocaleString('ru-RU', {
                                  maximumFractionDigits: 2,
                                })}
                              </Text>

                              <Text style={styles.latestUnit}>
                                {selectedMetric.unit}
                              </Text>
                            </View>

                            <Text style={styles.latestDate}>
                              {formatNoteDate(
                                latestMetricMeasurement.measuredAt,
                              )}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.noLatest}>
                            Пока нет сохранённых измерений
                          </Text>
                        )}
                      </View>

                      {/* График изменений */}
                      <View style={styles.historySection}>
                        {renderChart()}
                      </View>

                      {/* Форма нового измерения */}
                      {selectedMetric.isActive ? (
                        <View style={styles.card}>
                          <Text style={styles.sectionTitle}>
                            Добавить измерение
                          </Text>

                          <Text style={styles.label}>
                            Значение ({selectedMetric.unit})
                          </Text>

                          <TextInput
                            style={styles.input}
                            value={metricValue}
                            onChangeText={setMetricValue}
                            placeholder="Например, 25"
                            keyboardType="decimal-pad"
                            editable={!savingMetric}
                          />

                          <Text style={styles.label}>
                            Дата измерения
                          </Text>

                          <TextInput
                            style={styles.input}
                            value={metricDate}
                            onChangeText={setMetricDate}
                            placeholder="ГГГГ-ММ-ДД"
                            maxLength={10}
                            keyboardType="numbers-and-punctuation"
                            editable={!savingMetric}
                          />

                          <Text style={styles.label}>
                            Заметка к измерению
                          </Text>

                          <TextInput
                            style={[styles.input, styles.noteInput]}
                            value={metricNote}
                            onChangeText={setMetricNote}
                            placeholder="Дополнительная информация"
                            multiline
                            textAlignVertical="top"
                            maxLength={1000}
                            editable={!savingMetric}
                          />

                          <Pressable
                            style={[
                              styles.saveButton,
                              savingMetric && styles.saveButtonDisabled,
                            ]}
                            onPress={() =>
                              void saveGroupMetricMeasurement()
                            }
                            disabled={savingMetric}
                          >
                            {savingMetric ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={styles.saveButtonText}>
                                Сохранить измерение
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.archivedInfo}>
                          <Text style={styles.archivedInfoText}>
                            Эта метрика находится в архиве. Новые измерения
                            добавлять нельзя, но история сохранена.
                          </Text>
                        </View>
                      )}

                      {/* История выбранной метрики */}
                      <View style={styles.historySection}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.sectionTitle}>
                            История измерений
                          </Text>

                          <Text style={styles.historyCount}>
                            {metricMeasurements.length}
                          </Text>
                        </View>

                        {metricMeasurements.length === 0 ? (
                          <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>
                              История измерений пока пуста.
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.historyCard}>
                            {metricMeasurements.map(
                              (measurement, index) => (
                                <View
                                  key={measurement.physicalMeasurementId}
                                  style={[
                                    styles.historyRow,
                                    index !==
                                      metricMeasurements.length - 1 &&
                                      styles.historyDivider,
                                  ]}
                                >
                                  <View style={styles.historyDateBlock}>
                                    <Text style={styles.historyDate}>
                                      {formatNoteDate(
                                        measurement.measuredAt,
                                      )}
                                    </Text>

                                    {measurement.recordedByName ? (
                                      <Text style={styles.recordedBy}>
                                        {measurement.recordedByName}
                                      </Text>
                                    ) : null}

                                    {measurement.note ? (
                                      <Text style={styles.measurementNote}>
                                        {measurement.note}
                                      </Text>
                                    ) : null}
                                  </View>

                                  <View style={styles.historyValueBlock}>
                                    <Text style={styles.historyValue}>
                                      {Number(
                                        measurement.value,
                                      ).toLocaleString('ru-RU', {
                                        maximumFractionDigits: 2,
                                      })}
                                    </Text>

                                    <Text style={styles.historyUnit}>
                                      {selectedMetric.unit}
                                    </Text>
                                  </View>
                                </View>
                              ),
                            )}
                          </View>
                        )}
                      </View>
                    </>
                  )}
                </>
              )}
            </View>

            {/* Заметки спортсмена */}
            <View style={styles.notesSection}>
              <View style={styles.notesHeader}>
                <Text style={styles.sectionTitle}>Заметки</Text>
                <Text style={styles.notesCount}>{notes.length}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>
                  {editingNoteId !== null
                    ? 'Редактирование заметки'
                    : 'Новая заметка'}
                </Text>

                <TextInput
                  style={styles.noteInput}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Например, прогресс в технике, рекомендации..."
                  multiline
                  textAlignVertical="top"
                  maxLength={5000}
                  editable={!savingNote}
                />

                <Text style={styles.characterCount}>
                  {noteText.length}/5000
                </Text>

                <Pressable
                  style={[
                    styles.saveButton,
                    savingNote && styles.saveButtonDisabled,
                  ]}
                  onPress={() => void saveNote()}
                  disabled={savingNote}
                >
                  {savingNote ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingNoteId !== null
                        ? 'Сохранить изменения'
                        : 'Сохранить заметку'}
                    </Text>
                  )}
                </Pressable>

                {editingNoteId !== null && (
                  <Pressable
                    style={styles.cancelEditButton}
                    onPress={cancelNoteEdit}
                    disabled={savingNote}
                  >
                    <Text style={styles.cancelEditText}>
                      Отменить редактирование
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* История заметок */}
              <View style={styles.notesHistory}>
                <Text style={styles.notesHistoryTitle}>
                  История заметок
                </Text>

                {notesLoading ? (
                  <View style={styles.notesMessage}>
                    <ActivityIndicator color="#2563EB" />
                    <Text style={styles.emptyText}>
                      Загружаем заметки...
                    </Text>
                  </View>
                ) : notesError ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.error}>{notesError}</Text>

                    <Pressable
                      style={styles.retryButton}
                      onPress={() => void loadNotes()}
                    >
                      <Text style={styles.retryButtonText}>
                        Повторить
                      </Text>
                    </Pressable>
                  </View>
                ) : notes.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      Пока нет сохранённых заметок.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.historyCard}>
                    {notes.map((athleteNote, index) => (
                      <View
                        key={athleteNote.athleteNoteId}
                        style={[
                          styles.noteHistoryItem,
                          index !== notes.length - 1 &&
                            styles.historyDivider,
                        ]}
                      >
                        <View style={styles.noteMetaRow}>
                          <View style={styles.noteTypeBadge}>
                            <Text style={styles.noteTypeText}>
                              {getNoteType(athleteNote.type)}
                            </Text>
                          </View>

                          <Text style={styles.noteDate}>
                            {formatNoteDate(athleteNote.createdAt)}
                          </Text>
                        </View>

                        <Text style={styles.noteHistoryText}>
                          {athleteNote.text}
                        </Text>

                        {athleteNote.canEdit && (
                          <View style={styles.noteActions}>
                            <Pressable
                              style={styles.noteActionButton}
                              onPress={() => editNote(athleteNote)}
                              disabled={
                                savingNote || deletingNoteId !== null
                              }
                            >
                              <Text style={styles.editNoteText}>
                                Редактировать
                              </Text>
                            </Pressable>

                            <Pressable
                              style={styles.noteActionButton}
                              onPress={() => deleteNote(athleteNote)}
                              disabled={
                                savingNote || deletingNoteId !== null
                              }
                            >
                              {deletingNoteId ===
                              athleteNote.athleteNoteId ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#DC2626"
                                />
                              ) : (
                                <Text style={styles.deleteNoteText}>
                                  Удалить
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        )}

                        {athleteNote.editedAt ? (
                          <Text style={styles.noteEdited}>
                            Изменена:{' '}
                            {formatNoteDate(athleteNote.editedAt)}
                          </Text>
                        ) : null}

                        {athleteNote.trainingId !== null ? (
                          <Text style={styles.noteTraining}>
                            Связана с тренировкой №
                            {athleteNote.trainingId}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
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
  centered: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  error: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#DC2626',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    marginTop: 12,
    padding: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  profileSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: '#6B7280',
  },
  metricsSection: {
    marginTop: 26,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  metricsHint: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  metricSelector: {
    gap: 9,
  },
  metricButton: {
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  metricButtonSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EEF2FF',
  },
  metricButtonArchived: {
    opacity: 0.7,
  },
  metricButtonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  metricButtonTextSelected: {
    color: '#2563EB',
  },
  metricButtonUnit: {
    marginTop: 5,
    fontSize: 11,
    color: '#6B7280',
  },
  archivedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  archivedInfo: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  archivedInfoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#92400E',
  },
  latestCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#111827',
  },
  latestLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  latestValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    gap: 7,
  },
  latestValue: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
  },
  latestUnit: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '600',
  },
  latestDate: {
    marginTop: 5,
    color: '#9CA3AF',
    fontSize: 12,
  },
  noLatest: {
    marginTop: 12,
    color: '#E5E7EB',
    fontSize: 14,
  },
  card: {
    marginTop: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    marginTop: 16,
    marginBottom: 7,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 15,
    color: '#111827',
  },
  noteInput: {
    minHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  saveButton: {
    minHeight: 52,
    marginTop: 20,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySection: {
    marginTop: 28,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  historyCard: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 15,
  },
  historyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  historyDateBlock: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  recordedBy: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
  },
  measurementNote: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: '#6B7280',
  },
  historyValueBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  historyValue: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  historyUnit: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  // График
  chartCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  chartSubtitle: {
    marginTop: 5,
    fontSize: 12,
    color: '#6B7280',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  chartLegendText: {
    fontSize: 10,
    color: '#6B7280',
  },
  chartBody: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  chartYAxis: {
    width: CHART_LEFT_PADDING - 5,
    height: CHART_HEIGHT,
    position: 'relative',
  },
  chartAxisLabel: {
    position: 'absolute',
    left: 0,
    width: CHART_LEFT_PADDING - 8,
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'left',
  },
  chartPlot: {
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  chartLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#2563EB',
    borderRadius: 3,
    transformOrigin: 'left center',
  },
  chartPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#2563EB',
  },
  chartXAxis: {
    height: 28,
    position: 'relative',
    marginTop: 8,
  },
  chartDateLabel: {
    position: 'absolute',
    top: 0,
    width: 55,
    fontSize: 10,
    color: '#6B7280',
  },
  chartSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F4',
  },
  chartSummaryItem: {
    flex: 1,
  },
  chartSummaryLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  chartSummaryValue: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  chartNotEnough: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  singlePoint: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#DBEAFE',
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartNotEnoughText: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#6B7280',
  },

  // Заметки
  notesSection: {
    marginTop: 28,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notesCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  characterCount: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 11,
    color: '#9CA3AF',
  },
  notesHistory: {
    marginTop: 22,
  },
  notesHistoryTitle: {
    marginBottom: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  notesMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  noteHistoryItem: {
    paddingVertical: 15,
  },
  noteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  noteTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  noteTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  noteDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  noteHistoryText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  noteEdited: {
    marginTop: 7,
    fontSize: 11,
    color: '#9CA3AF',
  },
  noteTraining: {
    marginTop: 7,
    fontSize: 12,
    color: '#2563EB',
  },
  cancelEditButton: {
    marginTop: 10,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cancelEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  noteActionButton: {
    paddingVertical: 5,
  },
  editNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  deleteNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});
