import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/api/client';

type GroupMetric = {
  groupMetricId: number;
  trainingGroupId: number;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
};

export default function GroupMetricsSection({
  groupId,
}: {
  groupId: number;
}) {
  const [metrics, setMetrics] = useState<GroupMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadMetrics();
  }, [groupId]);

  async function loadMetrics() {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<GroupMetric[]>(
        `/GroupMetrics/group/${groupId}`,
      );

      setMetrics(response.data);
    } catch {
      setError('Не удалось загрузить метрики группы.');
    } finally {
      setLoading(false);
    }
  }

  async function createMetric() {
    const trimmedName = name.trim();
    const trimmedUnit = unit.trim();

    if (!trimmedName || !trimmedUnit) {
      Alert.alert(
        'Заполни поля',
        'Укажи название метрики и единицу измерения.',
      );
      return;
    }

    if (saving) return;

    try {
      setSaving(true);

      const response = await api.post<GroupMetric>(
        `/GroupMetrics/group/${groupId}`,
        {
          name: trimmedName,
          unit: trimmedUnit,
        },
      );

      setMetrics((current) => [
        ...current,
        response.data,
      ]);

      setName('');
      setUnit('');
      setModalVisible(false);
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 409) {
        Alert.alert(
          'Метрика уже существует',
          'В этой группе уже есть метрика с таким названием.',
        );
      } else {
        Alert.alert(
          'Ошибка',
          err?.response?.data?.message ??
            'Не удалось создать метрику.',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeMetricStatus(metric: GroupMetric) {
    if (processingId !== null) return;

    const action = metric.isActive ? 'archive' : 'restore';

    try {
      setProcessingId(metric.groupMetricId);

      await api.patch(
        `/GroupMetrics/${metric.groupMetricId}/${action}`,
      );

      setMetrics((current) =>
        current.map((item) =>
          item.groupMetricId === metric.groupMetricId
            ? { ...item, isActive: !item.isActive }
            : item,
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status;

      let message = 'Не удалось изменить статус метрики.';

      if (status === 409) {
        message =
          'В группе уже есть метрика с таким названием.';
      }

      Alert.alert('Ошибка', message);
    } finally {
      setProcessingId(null);
    }
  }

  function confirmChangeStatus(metric: GroupMetric) {
    const action = metric.isActive ? 'архивировать' : 'восстановить';

    Alert.alert(
      metric.isActive ? 'Архивировать метрику?' : 'Восстановить метрику?',
      `Метрика «${metric.name}» будет ${metric.isActive ? 'перемещена в архив' : 'снова доступна для измерений'}.`,
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: metric.isActive ? 'Архивировать' : 'Восстановить',
          onPress: () => void changeMetricStatus(metric),
        },
      ],
    );
  }

  const activeMetrics = metrics.filter((item) => item.isActive);
  const archivedMetrics = metrics.filter((item) => !item.isActive);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Метрики группы</Text>
          <Text style={styles.subtitle}>
            {activeMetrics.length} активных
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Добавить</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.muted}>Загружаем метрики...</Text>
        </View>
      ) : error ? (
        <View>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void loadMetrics()}>
            <Text style={styles.retry}>Повторить</Text>
          </Pressable>
        </View>
      ) : metrics.length === 0 ? (
        <Text style={styles.muted}>
          Метрики пока не добавлены.
        </Text>
      ) : (
        <>
          {activeMetrics.map((metric) => (
            <View key={metric.groupMetricId} style={styles.metricRow}>
              <View style={styles.metricInfo}>
                <Text style={styles.metricName}>{metric.name}</Text>
                <Text style={styles.metricUnit}>
                  Единица измерения: {metric.unit}
                </Text>
              </View>

              <Pressable
                style={styles.archiveButton}
                disabled={processingId !== null}
                onPress={() => confirmChangeStatus(metric)}
              >
                {processingId === metric.groupMetricId ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text style={styles.archiveButtonText}>
                    В архив
                  </Text>
                )}
              </Pressable>
            </View>
          ))}

          {archivedMetrics.length > 0 && (
            <View style={styles.archiveSection}>
              <Text style={styles.archiveTitle}>
                Архив ({archivedMetrics.length})
              </Text>

              {archivedMetrics.map((metric) => (
                <View
                  key={metric.groupMetricId}
                  style={styles.metricRow}
                >
                  <View style={styles.metricInfo}>
                    <Text style={styles.archivedName}>
                      {metric.name}
                    </Text>
                    <Text style={styles.metricUnit}>
                      {metric.unit}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.restoreButton}
                    disabled={processingId !== null}
                    onPress={() => confirmChangeStatus(metric)}
                  >
                    {processingId === metric.groupMetricId ? (
                      <ActivityIndicator
                        size="small"
                        color="#2563EB"
                      />
                    ) : (
                      <Text style={styles.restoreButtonText}>
                        Вернуть
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Новая метрика
            </Text>

            <Text style={styles.inputLabel}>
              Название
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Например, Приседания"
              placeholderTextColor="#9CA3AF"
              maxLength={100}
            />

            <Text style={styles.inputLabel}>
              Единица измерения
            </Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="Например, раз или кг"
              placeholderTextColor="#9CA3AF"
              maxLength={30}
            />

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              disabled={saving}
              onPress={() => void createMetric()}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  Создать метрику
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              disabled={saving}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>
                Отмена
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },
  addButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
  },
  muted: {
    fontSize: 13,
    color: '#6B7280',
    paddingVertical: 8,
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    paddingVertical: 8,
  },
  retry: {
    color: '#2563EB',
    fontWeight: '700',
    paddingVertical: 6,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  metricInfo: {
    flex: 1,
    minWidth: 0,
  },
  metricName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  metricUnit: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },
  archiveButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginLeft: 8,
  },
  archiveButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  archiveSection: {
    marginTop: 12,
  },
  archiveTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
  },
  archivedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  restoreButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    marginLeft: 8,
  },
  restoreButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 14,
    color: '#111827',
    marginBottom: 16,
  },
  saveButton: {
    minHeight: 48,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});