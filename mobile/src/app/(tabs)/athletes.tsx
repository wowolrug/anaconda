
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { restoreSession } from '@/api/auth';
import { useRouter } from 'expo-router';
import GroupMetricsSection from '@/components/GroupMetricsSection';

type TrainingGroup = {
  trainingGroupId: number;
  name: string;
  description: string | null;
  athletesCount: number;
};

type Athlete = {
  athleteId: number;
  name: string;
  surname: string;
  email: string | null;
  joinedDate?: string;
};

function getCountLabel(count: number) {
  const lastTwo = count % 100;
  const lastOne = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return 'спортсменов';
  if (lastOne === 1) return 'спортсмен';
  if (lastOne >= 2 && lastOne <= 4) return 'спортсмена';

  return 'спортсменов';
}

function getInitials(athlete: Athlete) {
  return `${athlete.name.charAt(0)}${athlete.surname.charAt(0)}`.toUpperCase();
}

export default function AthletesScreen() {
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingGroupId, setLoadingGroupId] = useState<number | null>(null);

  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [groupAthletes, setGroupAthletes] = useState<Athlete[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [athletesError, setAthletesError] = useState<string | null>(null);

  const [addToGroup, setAddToGroup] = useState<TrainingGroup | null>(null);
  const [availableAthletes, setAvailableAthletes] = useState<Athlete[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addingAthleteId, setAddingAthleteId] = useState<number | null>(null);
  const [removingAthleteId, setRemovingAthleteId] = useState<number | null>(
    null,
  );

  // Создание группы.
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  const router = useRouter();

  function openAthlete(athlete: Athlete) {
    router.push({
      pathname: '/athlete-details',
      params: {
        athleteId: String(athlete.athleteId),
        name: athlete.name,
        surname: athlete.surname,
      },
    });
  }

  // Первоначальная загрузка.
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        await restoreSession();

        const response = await api.get<TrainingGroup[]>('/Groups');

        if (!active) return;

        setGroups(response.data);

        setLoadingAthletes(true);

        try {
          const athletesResponse = await api.get<Athlete[]>(
            '/Groups/athletes/available',
          );

          if (active) {
            setAllAthletes(athletesResponse.data);
            setAthletesError(null);
          }
        } catch {
          if (active) {
            setAthletesError('Не удалось загрузить список спортсменов');
          }
        } finally {
          if (active) {
            setLoadingAthletes(false);
          }
        }
      } catch {
        if (active) {
          setError('Не удалось загрузить группы');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  // Обновление всех данных жестом pull-to-refresh.
  async function handleRefresh() {
    if (refreshing) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      await restoreSession();

      // Обновляем группы.
      try {
        const response = await api.get<TrainingGroup[]>('/Groups');
        setGroups(response.data);
        setError(null);
      } catch {
        setRefreshError('Не удалось обновить список групп.');
      }

      // Обновляем общий список спортсменов.
      try {
        const athletesResponse = await api.get<Athlete[]>(
          '/Groups/athletes/available',
        );

        setAllAthletes(athletesResponse.data);
        setAthletesError(null);
      } catch {
        setAthletesError('Не удалось обновить список спортсменов.');
      }

      // Если группа раскрыта — обновляем её участников.
      if (expandedGroupId !== null) {
        try {
          const membersResponse = await api.get<Athlete[]>(
            `/Groups/${expandedGroupId}/athletes`,
          );

          setGroupAthletes(membersResponse.data);
          setGroupError(null);
        } catch {
          setGroupError(
            'Не удалось обновить список спортсменов этой группы.',
          );
        }
      }
    } catch {
      setRefreshError('Не удалось обновить данные. Проверь соединение.');
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshGroups() {
    const response = await api.get<TrainingGroup[]>('/Groups');
    setGroups(response.data);
  }

  // Создание новой группы.
  async function createGroup() {
    const name = newGroupName.trim();
    const description = newGroupDescription.trim();

    if (name.length < 2) {
      Alert.alert(
        'Проверь название',
        'Название группы должно содержать минимум 2 символа.',
      );
      return;
    }

    if (creatingGroup) return;

    setCreatingGroup(true);

    try {
      const response = await api.post<TrainingGroup>('/Groups', {
        name,
        description: description || null,
      });

      const createdGroup = response.data;

      setGroups((current) => [
        createdGroup,
        ...current.filter(
          (group) =>
            group.trainingGroupId !== createdGroup.trainingGroupId,
        ),
      ]);

      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateGroupModal(false);

      Alert.alert(
        'Группа создана',
        `Группа «${createdGroup.name}» успешно создана.`,
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        'Не удалось создать группу. Попробуй ещё раз.';

      Alert.alert('Ошибка', message);
    } finally {
      setCreatingGroup(false);
    }
  }

  async function toggleGroup(groupId: number) {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      setGroupAthletes([]);
      setGroupError(null);
      return;
    }

    setExpandedGroupId(groupId);
    setGroupAthletes([]);
    setGroupError(null);
    setLoadingGroupId(groupId);

    try {
      const response = await api.get<Athlete[]>(
        `/Groups/${groupId}/athletes`,
      );

      setGroupAthletes(response.data);
    } catch {
      setGroupError('Не удалось загрузить спортсменов этой группы');
    } finally {
      setLoadingGroupId((current) =>
        current === groupId ? null : current,
      );
    }
  }

  async function openAddModal(group: TrainingGroup) {
    setAddToGroup(group);
    setAvailableAthletes([]);
    setLoadingAvailable(true);

    try {
      const response = await api.get<Athlete[]>(
        `/Groups/${group.trainingGroupId}/athletes/available`,
      );

      setAvailableAthletes(response.data);
    } catch {
      Alert.alert(
        'Ошибка',
        'Не удалось загрузить список доступных спортсменов.',
      );
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function addAthlete(athlete: Athlete) {
    if (!addToGroup || addingAthleteId !== null) return;

    const group = addToGroup;
    setAddingAthleteId(athlete.athleteId);

    try {
      await api.post(
        `/Groups/${group.trainingGroupId}/athletes`,
        {
          athleteId: athlete.athleteId,
        },
      );

      const membersResponse = await api.get<Athlete[]>(
        `/Groups/${group.trainingGroupId}/athletes`,
      );

      setGroupAthletes(membersResponse.data);
      setGroupError(null);

      await refreshGroups();

      setAddToGroup(null);
      setAvailableAthletes([]);

      Alert.alert(
        'Готово',
        `${athlete.name} ${athlete.surname} добавлен(а) в группу «${group.name}».`,
      );
    } catch (err: any) {
      const status = err?.response?.status;

      let message = 'Не удалось добавить спортсмена. Попробуй ещё раз.';

      if (status === 409) {
        message = 'Этот спортсмен уже состоит в группе.';
      } else if (status === 404) {
        message = 'Группа или спортсмен не найдены.';
      } else if (status === 400) {
        message =
          err?.response?.data?.message ?? 'Проверь данные запроса.';
      }

      Alert.alert('Ошибка добавления', message);
    } finally {
      setAddingAthleteId(null);
    }
  }

  async function removeAthlete(athlete: Athlete) {
    if (expandedGroupId === null || removingAthleteId !== null) return;

    const groupId = expandedGroupId;
    setRemovingAthleteId(athlete.athleteId);

    try {
      await api.delete(
        `/Groups/${groupId}/athletes/${athlete.athleteId}`,
      );

      setGroupAthletes((current) =>
        current.filter((item) => item.athleteId !== athlete.athleteId),
      );

      await refreshGroups();

      Alert.alert(
        'Готово',
        `${athlete.name} ${athlete.surname} исключён(а) из группы.`,
      );
    } catch {
      Alert.alert(
        'Ошибка',
        'Не удалось исключить спортсмена из группы.',
      );
    } finally {
      setRemovingAthleteId(null);
    }
  }

  function confirmRemoveAthlete(athlete: Athlete) {
    const group = groups.find(
      (item) => item.trainingGroupId === expandedGroupId,
    );

    if (!group) return;

    Alert.alert(
      'Исключить из группы?',
      `Спортсмен ${athlete.name} ${athlete.surname} будет исключён из группы «${group.name}».`,
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Исключить',
          style: 'destructive',
          onPress: () => {
            void removeAthlete(athlete);
          },
        },
      ],
    );
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
            <Text style={styles.title}>Спортсмены</Text>
            <Text style={styles.subtitle}>
              Спортсмены твоих групп
            </Text>
          </View>

          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>
              {allAthletes.length}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.createGroupButton}
          onPress={() => setShowCreateGroupModal(true)}
        >
          <Text style={styles.createGroupButtonText}>
            + Создать группу
          </Text>
        </Pressable>

        {refreshError && (
          <Text style={styles.error}>{refreshError}</Text>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.message}>Загружаем данные...</Text>
          </View>
        )}

        {error && !loading && (
          <View>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                void handleRefresh();
              }}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {!loading && (!error || groups.length > 0) && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Мои группы</Text>
                <Text style={styles.sectionCount}>
                  {groups.length}
                </Text>
              </View>

              {groups.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    Групп пока нет
                  </Text>
                  <Text style={styles.emptyText}>
                    Создай первую группу, чтобы добавлять в неё спортсменов.
                  </Text>
                  <Pressable
                    style={styles.emptyCreateButton}
                    onPress={() => setShowCreateGroupModal(true)}
                  >
                    <Text style={styles.emptyCreateButtonText}>
                      Создать первую группу
                    </Text>
                  </Pressable>
                </View>
              ) : (
                groups.map((group) => {
                  const isExpanded =
                    expandedGroupId === group.trainingGroupId;

                  return (
                    <View
                      key={group.trainingGroupId}
                      style={styles.groupCard}
                    >
                      <Pressable
                        style={styles.groupHeader}
                        onPress={() =>
                          void toggleGroup(group.trainingGroupId)
                        }
                      >
                        <View style={styles.groupIcon}>
                          <Text style={styles.groupIconText}>
                            {group.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.groupInfo}>
                          <Text style={styles.groupName}>
                            {group.name}
                          </Text>

                          <Text style={styles.groupCount}>
                            {group.athletesCount}{' '}
                            {getCountLabel(group.athletesCount)}
                          </Text>

                          {group.description ? (
                            <Text
                              style={styles.groupDescription}
                              numberOfLines={2}
                            >
                              {group.description}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={styles.chevron}>
                          {isExpanded ? '⌃' : '›'}
                        </Text>
                      </Pressable>

                      {isExpanded && (
                        <View style={styles.groupRoster}>
                          <View style={styles.rosterDivider} />

                          <GroupMetricsSection
                            groupId={group.trainingGroupId}
                          />

                          <Pressable
                            style={styles.addAthleteButton}
                            onPress={() => void openAddModal(group)}
                          >
                            <Text style={styles.addAthleteButtonText}>
                              + Добавить спортсмена
                            </Text>
                          </Pressable>

                          {loadingGroupId === group.trainingGroupId ? (
                            <View style={styles.loadingContainer}>
                              <ActivityIndicator
                                size="small"
                                color="#2563EB"
                              />
                              <Text style={styles.message}>
                                Загружаем спортсменов...
                              </Text>
                            </View>
                          ) : groupError ? (
                            <Text style={styles.error}>{groupError}</Text>
                          ) : groupAthletes.length === 0 ? (
                            <Text style={styles.message}>
                              В этой группе пока нет спортсменов
                            </Text>
                          ) : (
                            groupAthletes.map((athlete) => (
                              <View
                                key={athlete.athleteId}
                                style={styles.memberRow}
                              >
                                <View style={styles.memberInfo}>
                                  <AthleteRow
                                    athlete={athlete}
                                    onPress={() => openAthlete(athlete)}
                                  />
                                </View>

                                <Pressable
                                  style={styles.removeButton}
                                  disabled={
                                    removingAthleteId === athlete.athleteId
                                  }
                                  onPress={() =>
                                    confirmRemoveAthlete(athlete)
                                  }
                                  accessibilityLabel={`Исключить ${athlete.name} ${athlete.surname} из группы`}
                                >
                                  {removingAthleteId === athlete.athleteId ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#DC2626"
                                    />
                                  ) : (
                                    <Text style={styles.removeButtonText}>
                                      −
                                    </Text>
                                  )}
                                </Pressable>
                              </View>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Все спортсмены
                </Text>
                <Text style={styles.sectionCount}>
                  {allAthletes.length}
                </Text>
              </View>

              {loadingAthletes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="small"
                    color="#2563EB"
                  />
                  <Text style={styles.message}>
                    Загружаем список...
                  </Text>
                </View>
              ) : athletesError ? (
                <Text style={styles.error}>{athletesError}</Text>
              ) : allAthletes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    Спортсменов пока нет
                  </Text>
                  <Text style={styles.emptyText}>
                    Зарегистрированные спортсмены появятся здесь.
                  </Text>
                </View>
              ) : (
                <View style={styles.allAthletesCard}>
                  {allAthletes.map((athlete, index) => (
                    <View key={athlete.athleteId}>
                      {index > 0 && (
                        <View style={styles.rosterDivider} />
                      )}
                      <AthleteRow
                        athlete={athlete}
                        onPress={() => openAthlete(athlete)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Окно добавления спортсмена */}
      <Modal
        visible={addToGroup !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAddToGroup(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  Добавить спортсмена
                </Text>

                <Text style={styles.modalSubtitle} numberOfLines={2}>
                  {addToGroup?.name}
                </Text>
              </View>

              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setAddToGroup(null)}
                disabled={addingAthleteId !== null}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </Pressable>
            </View>

            {loadingAvailable ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.message}>
                  Загружаем доступных спортсменов...
                </Text>
              </View>
            ) : availableAthletes.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.emptyTitle}>
                  Нет доступных спортсменов
                </Text>
                <Text style={styles.emptyText}>
                  Все зарегистрированные спортсмены уже состоят в этой
                  группе или список пока пуст.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.availableList}
                keyboardShouldPersistTaps="handled"
              >
                {availableAthletes.map((athlete) => {
                  const isAdding =
                    addingAthleteId === athlete.athleteId;

                  return (
                    <Pressable
                      key={athlete.athleteId}
                      style={styles.availableAthlete}
                      disabled={addingAthleteId !== null}
                      onPress={() => void addAthlete(athlete)}
                    >
                      <View style={styles.athleteAvatar}>
                        <Text style={styles.athleteAvatarText}>
                          {getInitials(athlete)}
                        </Text>
                      </View>

                      <View style={styles.availableAthleteInfo}>
                        <Text style={styles.athleteName}>
                          {athlete.name} {athlete.surname}
                        </Text>
                        {athlete.email ? (
                          <Text style={styles.athleteEmail}>
                            {athlete.email}
                          </Text>
                        ) : null}
                      </View>

                      {isAdding ? (
                        <ActivityIndicator
                          size="small"
                          color="#2563EB"
                        />
                      ) : (
                        <Text style={styles.availablePlus}>+</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setAddToGroup(null)}
              disabled={addingAthleteId !== null}
            >
              <Text style={styles.modalCancelText}>Закрыть</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Окно создания группы */}
      <Modal
        visible={showCreateGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!creatingGroup) {
            setShowCreateGroupModal(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.createModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая группа</Text>

              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowCreateGroupModal(false)}
                disabled={creatingGroup}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Название группы</Text>

            <TextInput
              style={styles.groupInput}
              placeholder="Например, MMA — начинающие"
              placeholderTextColor="#9CA3AF"
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={100}
              editable={!creatingGroup}
            />

            <Text style={styles.inputLabel}>Описание</Text>

            <TextInput
              style={[styles.groupInput, styles.descriptionInput]}
              placeholder="Необязательно"
              placeholderTextColor="#9CA3AF"
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              multiline
              maxLength={500}
              textAlignVertical="top"
              editable={!creatingGroup}
            />

            <Pressable
              style={[
                styles.createSubmitButton,
                creatingGroup && styles.disabledButton,
              ]}
              onPress={() => void createGroup()}
              disabled={creatingGroup}
            >
              {creatingGroup ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createSubmitButtonText}>
                  Создать группу
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setShowCreateGroupModal(false)}
              disabled={creatingGroup}
            >
              <Text style={styles.modalCancelText}>Отмена</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AthleteRow({
  athlete,
  onPress,
}: {
  athlete: Athlete;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.athleteRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.athleteAvatar}>
        <Text style={styles.athleteAvatarText}>
          {getInitials(athlete)}
        </Text>
      </View>

      <View style={styles.athleteInfo}>
        <Text style={styles.athleteName}>
          {athlete.name} {athlete.surname}
        </Text>

        {athlete.email ? (
          <Text style={styles.athleteEmail}>{athlete.email}</Text>
        ) : null}
      </View>
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
  totalBadge: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  createGroupButton: {
    marginTop: 18,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupIconText: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '700',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  groupCount: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  groupDescription: {
    marginTop: 5,
    fontSize: 12,
    color: '#9CA3AF',
  },
  chevron: {
    marginLeft: 10,
    fontSize: 24,
    color: '#9CA3AF',
  },
  groupRoster: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  rosterDivider: {
    height: 1,
    backgroundColor: '#F0F1F4',
    marginBottom: 4,
  },
  addAthleteButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  addAthleteButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    color: '#DC2626',
    fontSize: 25,
    lineHeight: 27,
    fontWeight: '500',
  },
  allAthletesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  athleteAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  athleteAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  athleteInfo: {
    flex: 1,
    minWidth: 0,
  },
  athleteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  athleteEmail: {
    marginTop: 3,
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
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
  emptyCreateButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 15,
  },
  emptyCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
  },
  error: {
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#DC2626',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '82%',
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 25,
    lineHeight: 28,
    color: '#374151',
  },
  modalLoading: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  modalEmpty: {
    paddingVertical: 24,
  },
  availableList: {
    flexGrow: 0,
  },
  availableAthlete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  availableAthleteInfo: {
    flex: 1,
    paddingVertical: 12,
  },
  availablePlus: {
    fontSize: 27,
    fontWeight: '400',
    color: '#2563EB',
    paddingHorizontal: 8,
  },
  modalCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#E5E7EB',
    borderRadius: 13,
    marginTop: 12,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  createModalCard: {
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 32,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 18,
    marginBottom: 7,
  },
  groupInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  },
  descriptionInput: {
    minHeight: 100,
  },
  createSubmitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 13,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  createSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
