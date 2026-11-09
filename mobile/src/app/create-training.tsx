import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { getCurrentRole, restoreSession } from '@/api/auth';

type TrainingGroup = {
  trainingGroupId: number;
  name: string;
  description: string | null;
  athletesCount: number;
};

type Training = {
  trainingId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string | number;
  status: string | number;
  description: string;
  trainingGroupId: number | null;
  groupName: string | null;
};

const trainingTypes = [
  { value: 0, label: 'Техника' },
  { value: 1, label: 'Спарринг' },
  { value: 2, label: 'Силовая' },
  { value: 3, label: 'Кардио' },
  { value: 4, label: 'Смешанная' },
  { value: 5, label: 'Другая' },
];

function getTodayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const [hours, minutes] = value.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function formatTimeForApi(value: string) {
  return `${value}:00`;
}

function extractTime(value: string) {
  const match = value.match(/(\d{2}:\d{2})/);
  return match?.[1] ?? value.slice(0, 5);
}

function parseTrainingType(type: string | number): number {
  if (typeof type === 'number' || /^\d+$/.test(String(type))) {
    return Number(type);
  }

  const types: Record<string, number> = {
    technique: 0,
    sparring: 1,
    strength: 2,
    cardio: 3,
    mixed: 4,
    other: 5,
  };

  return types[type.toLowerCase()] ?? 0;
}

export default function CreateTraining() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string | string[] }>();
  const editId = Array.isArray(params.editId)
    ? params.editId[0]
    : params.editId;

  const isEditMode = Boolean(editId);

  const [date, setDate] = useState(getTodayValue());
  const [startTime, setStartTime] = useState('18:30');
  const [endTime, setEndTime] = useState('20:00');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingTraining, setLoadingTraining] = useState(isEditMode);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState(
    'Создавать и редактировать тренировки может только тренер.',
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      await restoreSession().catch(() => null);

      if (!active) return;

      const role = getCurrentRole();
      if (role?.toLowerCase() !== 'coach') {
        setAccessDenied(true);
        setAccessMessage(
          role
            ? 'Создавать и редактировать тренировки может только тренер.'
            : 'Не удалось подтвердить сессию. Войди в аккаунт заново.',
        );
        setAccessChecked(true);
        setLoadingGroups(false);
        setLoadingTraining(false);
        return;
      }

      setAccessDenied(false);
      setAccessChecked(true);

      try {
        const response = await api.get<TrainingGroup[]>('/Groups');

        if (active) {
          setGroups(response.data);
          setGroupsError(null);
        }
      } catch (err: any) {
        if (active) {
          const status = err?.response?.status;

          setGroupsError(
            status === 401
              ? 'Сессия истекла. Войди в аккаунт заново.'
              : status === 403
                ? 'Создавать тренировки может только тренер.'
                : 'Не удалось загрузить группы.',
          );
        }
      } finally {
        if (active) setLoadingGroups(false);
      }

      if (!isEditMode || !editId || !/^\d+$/.test(editId)) {
        if (active && isEditMode) {
          setTrainingError('Некорректный ID тренировки.');
          setLoadingTraining(false);
        }
        return;
      }

      try {
        const response = await api.get<Training>(
          `/Trainings/${editId}`,
        );
        const training = response.data;

        if (!active) return;

        setDate(training.date.split('T')[0]);
        setStartTime(extractTime(training.startTime));
        setEndTime(extractTime(training.endTime));
        setDescription(training.description ?? '');
        setSelectedType(parseTrainingType(training.type));
        setSelectedGroupId(training.trainingGroupId ?? null);
      } catch (err: any) {
        if (active) {
          const status = err?.response?.status;

          setTrainingError(
            status === 401
              ? 'Сессия истекла. Войди в аккаунт заново.'
              : status === 403
                ? 'У тебя нет доступа к редактированию этой тренировки.'
                : status === 404
                  ? 'Тренировка не найдена.'
                  : 'Не удалось загрузить тренировку.',
          );
        }
      } finally {
        if (active) setLoadingTraining(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [editId, isEditMode]);

  async function submitTraining() {
    if (saving) return;

    if (!isValidDate(date)) {
      Alert.alert('Проверь дату', 'Введи дату в формате ГГГГ-ММ-ДД.');
      return;
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      Alert.alert('Проверь время', 'Введи время в формате ЧЧ:ММ.');
      return;
    }

    if (endTime <= startTime) {
      Alert.alert(
        'Проверь время',
        'Время окончания должно быть позже времени начала.',
      );
      return;
    }

    if (
      selectedGroupId !== null &&
      !groups.some((group) => group.trainingGroupId === selectedGroupId)
    ) {
      Alert.alert('Группа не найдена', 'Выбери группу из списка заново.');
      return;
    }

    try {
      setSaving(true);
      await restoreSession();

      if (getCurrentRole()?.toLowerCase() !== 'coach') {
        setAccessDenied(true);
        setAccessMessage(
          'Создавать и редактировать тренировки может только тренер.',
        );
        return;
      }

      const payload = {
        date: `${date}T00:00:00`,
        startTime: formatTimeForApi(startTime),
        endTime: formatTimeForApi(endTime),
        type: selectedType,
        trainingGroupId: selectedGroupId,
        description: description.trim(),
      };

      if (isEditMode && editId) {
        await api.put(`/Trainings/${editId}`, payload);

        router.replace({
          pathname: '/training-details',
          params: { id: editId },
        });
      } else {
        const response = await api.post<{
          trainingId?: number;
          TrainingId?: number;
        }>('/Trainings', payload);

        const createdId =
          response.data.trainingId ?? response.data.TrainingId;

        if (createdId == null) {
          Alert.alert(
            'Тренировка создана',
            'Сервер не вернул ID созданной тренировки.',
            [
              {
                text: 'К расписанию',
                onPress: () => router.replace('/training-list'),
              },
            ],
          );
          return;
        }

        router.replace({
          pathname: '/training-details',
          params: { id: String(createdId) },
        });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      let message = isEditMode
        ? 'Не удалось сохранить изменения.'
        : 'Не удалось создать тренировку.';

      if (status === 400) {
        message =
          serverMessage ??
          'Сервер отклонил данные. Проверь дату, время и группу.';
      } else if (status === 401) {
        message = 'Сессия истекла. Войди в аккаунт заново.';
      } else if (status === 403) {
        message = 'Изменять тренировки может только тренер.';
      } else if (status === 404) {
        message = 'Тренировка или группа не найдена.';
      }

      Alert.alert(
        isEditMode ? 'Ошибка редактирования' : 'Ошибка создания',
        message,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!accessChecked) {
    return (
      <>
        <Stack.Screen options={{ title: 'Проверка доступа' }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.helper}>Проверяем права доступа...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (accessDenied) {
    return (
      <>
        <Stack.Screen options={{ title: 'Нет доступа' }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.errorText}>{accessMessage}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => router.replace('/(tabs)/trainings')}
            >
              <Text style={styles.retryButtonText}>К тренировкам</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (loadingTraining) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактирование тренировки' }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.helper}>Загружаем тренировку...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (trainingError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактирование тренировки' }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.errorText}>{trainingError}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.retryButtonText}>Назад</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditMode
            ? 'Редактирование тренировки'
            : 'Создание тренировки',
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>
              {isEditMode ? 'Изменить тренировку' : 'Новая тренировка'}
            </Text>
            <Text style={styles.subtitle}>
              {isEditMode
                ? 'Измени данные занятия'
                : 'Заполни информацию о занятии'}
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Основная информация</Text>

              <Text style={styles.label}>Дата</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="ГГГГ-ММ-ДД"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                editable={!saving}
              />
              <Text style={styles.helper}>Например, 2026-10-15</Text>

              <Text style={styles.label}>Тип тренировки</Text>
              <View style={styles.typesGrid}>
                {trainingTypes.map((type) => {
                  const selected = selectedType === type.value;

                  return (
                    <Pressable
                      key={type.value}
                      style={[
                        styles.typeOption,
                        selected && styles.typeOptionSelected,
                      ]}
                      onPress={() => setSelectedType(type.value)}
                      disabled={saving}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          selected && styles.typeOptionTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Группа</Text>

              {loadingGroups ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#2563EB" />
                  <Text style={styles.helper}>Загружаем группы...</Text>
                </View>
              ) : groupsError ? (
                <Text style={styles.errorText}>{groupsError}</Text>
              ) : (
                <View style={styles.groupsList}>
                  <Pressable
                    style={[
                      styles.groupOption,
                      selectedGroupId === null &&
                        styles.groupOptionSelected,
                    ]}
                    onPress={() => setSelectedGroupId(null)}
                    disabled={saving}
                  >
                    <View style={styles.groupOptionInfo}>
                      <Text style={styles.groupOptionName}>
                        Без группы
                      </Text>
                      <Text style={styles.groupOptionCount}>
                        Без автоматического назначения спортсменов
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        selectedGroupId === null && styles.radioSelected,
                      ]}
                    />
                  </Pressable>

                  {groups.map((group) => {
                    const selected =
                      selectedGroupId === group.trainingGroupId;

                    return (
                      <Pressable
                        key={group.trainingGroupId}
                        style={[
                          styles.groupOption,
                          selected && styles.groupOptionSelected,
                        ]}
                        onPress={() =>
                          setSelectedGroupId(group.trainingGroupId)
                        }
                        disabled={saving}
                      >
                        <View style={styles.groupOptionInfo}>
                          <Text style={styles.groupOptionName}>
                            {group.name}
                          </Text>
                          <Text style={styles.groupOptionCount}>
                            {group.athletesCount} спортсменов
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            selected && styles.radioSelected,
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Время тренировки</Text>

              <View style={styles.timeRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.label}>Начало</Text>
                  <TextInput
                    style={styles.input}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="ЧЧ:ММ"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    editable={!saving}
                  />
                </View>

                <View style={styles.timeColumn}>
                  <Text style={styles.label}>Окончание</Text>
                  <TextInput
                    style={styles.input}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="ЧЧ:ММ"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    editable={!saving}
                  />
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Описание</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Тема занятия или план тренировки"
                multiline
                textAlignVertical="top"
                maxLength={2000}
                editable={!saving}
              />
              <Text style={styles.characterCount}>
                {description.length}/2000
              </Text>
            </View>

            <Pressable
              style={[
                styles.submitButton,
                (saving || loadingGroups) && styles.submitButtonDisabled,
              ]}
              onPress={() => void submitTraining()}
              disabled={saving || loadingGroups}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Сохранить изменения' : 'Создать тренировку'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 20, paddingBottom: 36 },
  centered: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#6B7280' },
  card: {
    marginTop: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 17,
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
  helper: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#9CA3AF',
  },
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  typeOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2563EB',
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  typeOptionTextSelected: { color: '#2563EB' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  groupsList: { gap: 8 },
  groupOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F5F7FF',
  },
  groupOptionInfo: { flex: 1 },
  groupOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  groupOptionCount: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    marginLeft: 12,
  },
  radioSelected: { borderWidth: 6, borderColor: '#2563EB' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#DC2626' },
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
  timeRow: { flexDirection: 'row', gap: 12 },
  timeColumn: { flex: 1 },
  descriptionInput: { minHeight: 110 },
  characterCount: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 11,
    color: '#9CA3AF',
  },
  submitButton: {
    minHeight: 54,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});