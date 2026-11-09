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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
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
  coachName?: string | null;
  trainingGroupId: number | null;
  groupName: string | null;
  participantsCount: number;
};

type AttendanceRecord = {
  athleteId: number;
  name: string;
  surname: string;
  status: string | number;
  note?: string | null;
};

function getTrainingType(type: string | number) {
  const labels: Record<number, string> = {
    0: 'Техника',
    1: 'Спарринг',
    2: 'Силовая',
    3: 'Кардио',
    4: 'Смешанная',
    5: 'Другая',
  };

  if (typeof type === 'number' || /^\d+$/.test(String(type))) {
    return labels[Number(type)] ?? String(type);
  }

  return String(type);
}

function getTrainingStatus(status: string | number) {
  const labels: Record<number, string> = {
    0: 'Запланирована',
    1: 'Идёт',
    2: 'Завершена',
    3: 'Отменена',
  };

  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    return labels[Number(status)] ?? String(status);
  }

  const normalized = String(status).toLowerCase().replace(/[\s_-]/g, '');

  const namedLabels: Record<string, string> = {
    planned: 'Запланирована',
    inprogress: 'Идёт',
    completed: 'Завершена',
    cancelled: 'Отменена',
  };

  return namedLabels[normalized] ?? String(status);
}

function getAttendanceStatus(status: string | number) {
  const labels: Record<number, string> = {
    0: 'Не отмечен',
    1: 'Присутствует',
    2: 'Отсутствует',
    3: 'Опоздал',
    4: 'Уважительная причина',
  };

  if (typeof status === 'number' || /^\d+$/.test(String(status))) {
    return labels[Number(status)] ?? String(status);
  }

  const normalized = String(status).toLowerCase().replace(/[\s_-]/g, '');

  const namedLabels: Record<string, string> = {
    unmarked: 'Не отмечен',
    present: 'Присутствует',
    absent: 'Отсутствует',
    late: 'Опоздал',
    excused: 'Уважительная причина',
  };

  return namedLabels[normalized] ?? String(status);
}

function formatDate(value: string) {
  return value.split('T')[0];
}

function formatTime(value: string) {
  const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : value.slice(0, 5);
}

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);

  // Не даём табличным редакторам интерпретировать пользовательский текст
  // как формулу.
  if (/^[\t\r ]*[=+@]/.test(text) || /^\s*-/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(
  trainings: Training[],
  attendanceByTraining: AttendanceRecord[][],
) {
  const rows: unknown[][] = [
    [
      'ID тренировки',
      'Дата',
      'Начало',
      'Окончание',
      'Тип',
      'Статус тренировки',
      'Группа',
      'Тренер',
      'Описание',
      'ID спортсмена',
      'Имя спортсмена',
      'Фамилия спортсмена',
      'Посещаемость',
      'Примечание',
    ],
  ];

  trainings.forEach((training, index) => {
    const attendees = attendanceByTraining[index] ?? [];

    if (attendees.length === 0) {
      rows.push([
        training.trainingId,
        formatDate(training.date),
        formatTime(training.startTime),
        formatTime(training.endTime),
        getTrainingType(training.type),
        getTrainingStatus(training.status),
        training.groupName ?? 'Без группы',
        training.coachName ?? '',
        training.description ?? '',
        '',
        '',
        '',
        '',
        '',
      ]);
      return;
    }

    attendees.forEach((athlete) => {
      rows.push([
        training.trainingId,
        formatDate(training.date),
        formatTime(training.startTime),
        formatTime(training.endTime),
        getTrainingType(training.type),
        getTrainingStatus(training.status),
        training.groupName ?? 'Без группы',
        training.coachName ?? '',
        training.description ?? '',
        athlete.athleteId,
        athlete.name ?? '',
        athlete.surname ?? '',
        getAttendanceStatus(athlete.status),
        athlete.note ?? '',
      ]);
    });
  });

  // BOM и разделитель ; помогают корректно открывать кириллицу в Excel.
  return `\uFEFF${rows
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAttendanceClass(status: string | number) {
  const label = getAttendanceStatus(status);

  if (label === 'Присутствует') return 'present';
  if (label === 'Отсутствует') return 'absent';
  if (label === 'Опоздал') return 'late';
  if (label === 'Уважительная причина') return 'excused';

  return 'unmarked';
}

function buildPdfHtml(
  trainings: Training[],
  attendanceByTraining: AttendanceRecord[][],
) {
  const allAttendance = attendanceByTraining.flat();

  const attendanceCount = (label: string) =>
    allAttendance.filter(
      (record) => getAttendanceStatus(record.status) === label,
    ).length;

  const generatedAt = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const trainingSections = trainings
    .map((training, index) => {
      const attendees = attendanceByTraining[index] ?? [];

      const participantRows = attendees.length
        ? `
          <table class="participants">
            <thead>
              <tr>
                <th>Спортсмен</th>
                <th>Посещаемость</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              ${attendees
                .map(
                  (athlete) => `
                    <tr>
                      <td>${escapeHtml(
                        `${athlete.name ?? ''} ${athlete.surname ?? ''}`.trim(),
                      )}</td>
                      <td>
                        <span class="status ${getAttendanceClass(athlete.status)}">
                          ${escapeHtml(getAttendanceStatus(athlete.status))}
                        </span>
                      </td>
                      <td>${escapeHtml(athlete.note ?? '')}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        `
        : '<p class="empty">Участники не назначены или список посещаемости недоступен.</p>';

      return `
        <section class="training">
          <div class="training-heading">
            <div>
              <h2>${escapeHtml(getTrainingType(training.type))}</h2>
              <p class="muted">${escapeHtml(training.groupName ?? 'Без группы')}</p>
            </div>
            <span class="training-status">
              ${escapeHtml(getTrainingStatus(training.status))}
            </span>
          </div>

          <div class="training-meta">
            <span>
              <strong>Дата:</strong>
              ${escapeHtml(formatDate(training.date))}
            </span>
            <span>
              <strong>Время:</strong>
              ${escapeHtml(formatTime(training.startTime))}–${escapeHtml(formatTime(training.endTime))}
            </span>
            <span>
              <strong>Спортсменов:</strong>
              ${attendees.length}
            </span>
          </div>

          ${
            training.coachName
              ? `<p class="detail"><strong>Тренер:</strong> ${escapeHtml(training.coachName)}</p>`
              : ''
          }

          ${
            training.description?.trim()
              ? `<p class="detail"><strong>Описание:</strong> ${escapeHtml(training.description.trim())}</p>`
              : ''
          }

          ${participantRows}
        </section>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
  <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @page { size: A4; margin: 14mm 12mm; }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
          font-size: 10pt;
          line-height: 1.4;
        }
        .brand {
          font-size: 9pt;
          color: #2563eb;
          letter-spacing: 2px;
          font-weight: bold;
        }
        h1 { margin: 4px 0 2px; font-size: 24pt; }
        .report-date {
          color: #6b7280;
          font-size: 9pt;
          margin-bottom: 18px;
        }
        .summary {
          display: flex;
          gap: 8px;
          margin: 14px 0 20px;
        }
        .metric {
          flex: 1;
          min-width: 0;
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }
        .metric strong {
          display: block;
          font-size: 18pt;
          margin-bottom: 2px;
        }
        .metric span { font-size: 8pt; color: #6b7280; }
        h2 { font-size: 14pt; margin: 0; }
        .training {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          margin: 0 0 14px;
          page-break-inside: avoid;
        }
        .training-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .muted { color: #6b7280; margin: 3px 0 0; }
        .training-status {
          font-size: 8pt;
          color: #374151;
          background: #f3f4f6;
          border-radius: 5px;
          padding: 4px 6px;
        }
        .training-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          padding: 8px 0;
          margin: 10px 0;
          font-size: 9pt;
        }
        .detail {
          margin: 6px 0;
          font-size: 9pt;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 8.5pt;
        }
        th {
          background: #f3f4f6;
          text-align: left;
          font-weight: bold;
        }
        th, td {
          padding: 6px 5px;
          border: 1px solid #e5e7eb;
          vertical-align: top;
          overflow-wrap: anywhere;
        }
        .status {
          display: inline-block;
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 7.5pt;
        }
        .present { color: #166534; background: #dcfce7; }
        .absent { color: #991b1b; background: #fee2e2; }
        .late { color: #92400e; background: #fef3c7; }
        .excused { color: #1d4ed8; background: #dbeafe; }
        .unmarked { color: #4b5563; background: #f3f4f6; }
        .empty { color: #6b7280; font-style: italic; }
        .footer {
          margin-top: 18px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 8pt;
        }
        .no-trainings {
          padding: 20px;
          border: 1px dashed #d1d5db;
          text-align: center;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="brand">ANACONDA · TRAINING TRACKER</div>
      <h1>Отчёт по тренировкам</h1>
      <div class="report-date">Сформирован: ${escapeHtml(generatedAt)}</div>

      <div class="summary">
        <div class="metric">
          <strong>${trainings.length}</strong>
          <span>Тренировок</span>
        </div>
        <div class="metric">
          <strong>${allAttendance.length}</strong>
          <span>Записей участников</span>
        </div>
        <div class="metric">
          <strong>${attendanceCount('Присутствует')}</strong>
          <span>Присутствовали</span>
        </div>
        <div class="metric">
          <strong>${attendanceCount('Отсутствует')}</strong>
          <span>Отсутствовали</span>
        </div>
      </div>

      ${
        trainings.length
          ? trainingSections
          : '<div class="no-trainings">За выбранный набор данных тренировок нет.</div>'
      }

      <div class="footer">
        Отчёт сформирован из данных, доступных текущему тренеру в приложении Anaconda.
      </div>
    </body>
  </html>`;
}

export default function ReportsScreen() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(getCurrentRole);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isCoach = role?.toLowerCase() === 'coach';

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeRole((nextRole) => {
      if (active) {
        setRole(nextRole);
      }
    });

    async function loadReportData() {
      try {
        await restoreSession();

        if (!active) return;

        const currentRole = getCurrentRole();
        setRole(currentRole);

        if (currentRole?.toLowerCase() !== 'coach') return;

        setLoading(true);
        setError(null);

        const response = await api.get<Training[]>('/Trainings');

        if (active) {
          setTrainings(
            Array.isArray(response.data) ? response.data : [],
          );
        }
      } catch (err: any) {
        if (active) {
          const status = err?.response?.status;

          setError(
            status === 401
              ? 'Сессия истекла. Войди в аккаунт заново.'
              : status === 403
                ? 'Отчёты доступны только тренеру.'
                : 'Не удалось загрузить список тренировок.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setCheckingRole(false);
        }
      }

      if (active && getCurrentRole()?.toLowerCase() !== 'coach') {
        setCheckingRole(false);
      }
    }

    void loadReportData();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function exportCsv() {
    if (!isCoach || exporting || exportingPdf) return;

    try {
      setExporting(true);
      setError(null);

      // Получаем актуальные данные перед созданием отчёта.
      const response = await api.get<Training[]>('/Trainings');

      const latestTrainings = Array.isArray(response.data)
        ? response.data
        : [];

      const attendanceByTraining = await Promise.all(
        latestTrainings.map(async (training) => {
          const attendanceResponse = await api.get<AttendanceRecord[]>(
            `/Trainings/${training.trainingId}/attendance`,
          );

          return Array.isArray(attendanceResponse.data)
            ? attendanceResponse.data
            : [];
        }),
      );

      const csv = buildCsv(latestTrainings, attendanceByTraining);
      const directory = FileSystem.documentDirectory;

      if (!directory) {
        throw new Error(
          'Не удалось определить каталог для сохранения файла.',
        );
      }

      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `anaconda_training_report_${dateStamp}.csv`;
      const fileUri = `${directory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const sharingAvailable = await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert(
          'Файл создан',
          `Отчёт сохранён в приложении, но системная отправка файлов на этом устройстве недоступна.\n\n${filename}`,
        );
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Экспорт отчёта Anaconda',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err: any) {
      const status = err?.response?.status;

      const message =
        status === 401
          ? 'Сессия истекла. Войди в аккаунт заново.'
          : status === 403
            ? 'У тебя нет прав для экспорта посещаемости.'
            : err?.message ?? 'Не удалось создать CSV-отчёт.';

      Alert.alert('Ошибка экспорта', message);
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
  if (!isCoach || exporting || exportingPdf) return;

  try {
    setExportingPdf(true);
    setError(null);

    // Загружаем актуальные тренировки.
    const response = await api.get<Training[]>('/Trainings');

    const latestTrainings = Array.isArray(response.data)
      ? response.data
      : [];

    // Загружаем посещаемость каждой тренировки.
    const attendanceByTraining = await Promise.all(
      latestTrainings.map(async (training) => {
        const attendanceResponse = await api.get<AttendanceRecord[]>(
          `/Trainings/${training.trainingId}/attendance`,
        );

        return Array.isArray(attendanceResponse.data)
          ? attendanceResponse.data
          : [];
      }),
    );

    // Формируем HTML отчёта.
    const html = buildPdfHtml(
      latestTrainings,
      attendanceByTraining,
    );

    // Открываем системное окно печати.
    // На Android здесь можно выбрать «Сохранить как PDF».
    await Print.printAsync({ html });

  } catch (err: any) {
    const status = err?.response?.status;

    const message =
      status === 401
        ? 'Сессия истекла. Войди в аккаунт заново.'
        : status === 403
          ? 'У тебя нет прав для экспорта посещаемости.'
          : err?.message ?? 'Не удалось сформировать PDF-отчёт.';

    Alert.alert('Ошибка экспорта PDF', message);
  } finally {
    setExportingPdf(false);
  }
}

  if (checkingRole) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Отчёты' }} />

        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.muted}>Проверяем доступ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isCoach) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Отчёты' }} />

        <View style={styles.centered}>
          <Text style={styles.accessTitle}>Доступ ограничен</Text>

          <Text style={styles.muted}>
            Экспорт тренировок и посещаемости доступен только тренеру.
          </Text>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Отчёты' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Отчёты</Text>

        <Text style={styles.subtitle}>
          Экспортируй расписание и посещаемость в CSV для таблиц или PDF для
          просмотра и печати.
        </Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.muted}>Загружаем данные...</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.replace('/reports')}
            >
              <Text style={styles.secondaryButtonText}>Обновить</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {trainings.length}
                </Text>
                <Text style={styles.statLabel}>Тренировок</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {trainings.reduce(
                    (total, training) =>
                      total + (training.participantsCount ?? 0),
                    0,
                  )}
                </Text>

                <Text style={styles.statLabel}>
                  Назначений спортсменов
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>CSV</Text>
              </View>

              <Text style={styles.cardTitle}>
                Тренировки и посещаемость
              </Text>

              <Text style={styles.cardText}>
                Отчёт включает тренировки, группы, участников, статусы
                посещения и примечания. Тренировки без участников тоже
                включаются.
              </Text>

              <View style={styles.metaList}>
                <Text style={styles.metaItem}>
                  • CSV с поддержкой кириллицы для Excel
                </Text>

                <Text style={styles.metaItem}>
                  • PDF с оформленной сводкой и таблицами участников
                </Text>

                <Text style={styles.metaItem}>
                  • Включены завершённые и отменённые тренировки
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.exportButton,
                  pressed && styles.buttonPressed,
                  exporting && styles.buttonDisabled,
                ]}
                onPress={() => void exportCsv()}
                disabled={exporting || exportingPdf || loading}
              >
                {exporting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.exportButtonText}>
                    Экспортировать CSV
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.exportPdfButton,
                  pressed && styles.buttonPressed,
                  (exportingPdf || exporting) && styles.buttonDisabled,
                ]}
                onPress={() => void exportPdf()}
                disabled={exportingPdf || exporting || loading}
              >
                {exportingPdf ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.exportPdfButtonText}>
                    Экспортировать PDF
                  </Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.footnote}>
              Отчёт формируется по данным, которые доступны текущему тренеру
              через API.
            </Text>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: '#6B7280',
  },
  card: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
  },
  fileIcon: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  fileIconText: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  cardText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  metaList: {
    marginTop: 14,
    gap: 8,
  },
  metaItem: {
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
  },
  exportButton: {
    minHeight: 52,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  exportPdfButton: {
    minHeight: 52,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportPdfButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footnote: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 17,
    color: '#9CA3AF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  muted: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 20,
  },
  accessTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  secondaryButton: {
    alignSelf: 'center',
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});