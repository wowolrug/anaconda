
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
import { useRouter } from 'expo-router';
import { api } from '@/api/client';
import { restoreSession } from '@/api/auth';
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
  const router = useRouter();

  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<TrainingGroup[]>([]);
  const [archivedAthletes, setArchivedAthletes] = useState<Athlete[]>([]);

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
  const [removingAthleteId, setRemovingAthleteId] = useState<number | null>(null);

  const [archivedGroupsExpanded, setArchivedGroupsExpanded] = useState(false);
  const [archivedAthletesExpanded, setArchivedAthletesExpanded] = useState(false);
  const [loadingArchivedGroups, setLoadingArchivedGroups] = useState(false);
  const [loadingArchivedAthletes, setLoadingArchivedAthletes] = useState(false);
  const [archivingGroupId, setArchivingGroupId] = useState<number | null>(null);
  const [archivingAthleteId, setArchivingAthleteId] = useState<number | null>(null);
  const [restoringGroupId, setRestoringGroupId] = useState<number | null>(null);
  const [restoringAthleteId, setRestoringAthleteId] = useState<number | null>(null);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

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

  async function loadGroups() {
    const response = await api.get<TrainingGroup[]>('/Groups');
    setGroups(response.data);
  }

  async function loadAllAthletes() {
    const response = await api.get<Athlete[]>('/Groups/athletes/available');
    setAllAthletes(response.data);
  }

  async function loadArchivedGroups() {
    setLoadingArchivedGroups(true);
    try {
      const response = await api.get<TrainingGroup[]>('/Groups/archived');
      setArchivedGroups(response.data);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить архив групп.');
    } finally {
      setLoadingArchivedGroups(false);
    }
  }

  async function loadArchivedAthletes() {
    setLoadingArchivedAthletes(true);
    try {
      const response = await api.get<Athlete[]>('/Groups/athletes/archived');
      setArchivedAthletes(response.data);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить архив спортсменов.');
    } finally {
      setLoadingArchivedAthletes(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        await restoreSession();

        const [groupsResponse, athletesResponse] = await Promise.all([
          api.get<TrainingGroup[]>('/Groups'),
          api.get<Athlete[]>('/Groups/athletes/available'),
        ]);

        if (!active) return;

        setGroups(groupsResponse.data);
        setAllAthletes(athletesResponse.data);
        setAthletesError(null);
      } catch {
        if (active) setError('Не удалось загрузить данные.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  async function handleRefresh() {
    if (refreshing) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      await restoreSession();

      try {
        await loadGroups();
        setError(null);
      } catch {
        setRefreshError('Не удалось обновить список групп.');
      }

      try {
        await loadAllAthletes();
        setAthletesError(null);
      } catch {
        setAthletesError('Не удалось обновить список спортсменов.');
      }

      if (expandedGroupId !== null) {
        try {
          const response = await api.get<Athlete[]>(
            `/Groups/${expandedGroupId}/athletes`,
          );
          setGroupAthletes(response.data);
          setGroupError(null);
        } catch {
          setGroupError('Не удалось обновить участников группы.');
        }
      }

      if (archivedGroupsExpanded) {
        try {
          const response = await api.get<TrainingGroup[]>('/Groups/archived');
          setArchivedGroups(response.data);
        } catch {
          // Архив можно загрузить отдельно.
        }
      }

      if (archivedAthletesExpanded) {
        try {
          const response = await api.get<Athlete[]>('/Groups/athletes/archived');
          setArchivedAthletes(response.data);
        } catch {
          // Архив можно загрузить отдельно.
        }
      }
    } catch {
      setRefreshError('Не удалось обновить данные. Проверь соединение.');
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshGroups() {
    await loadGroups();
  }

  async function createGroup() {
    const name = newGroupName.trim();
    const description = newGroupDescription.trim();

    if (name.length < 2) {
      Alert.alert('Проверь название', 'Название группы должно содержать минимум 2 символа.');
      return;
    }

    if (creatingGroup) return;

    setCreatingGroup(true);

    try {
      const response = await api.post<TrainingGroup>('/Groups', {
        name,
        description: description || null,
      });

      setGroups((current) => [
        response.data,
        ...current.filter(
          (group) => group.trainingGroupId !== response.data.trainingGroupId,
        ),
      ]);

      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateGroupModal(false);

      Alert.alert('Группа создана', `Группа «${response.data.name}» успешно создана.`);
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err?.response?.data?.message ?? 'Не удалось создать группу.',
      );
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
      const response = await api.get<Athlete[]>(`/Groups/${groupId}/athletes`);
      setGroupAthletes(response.data);
    } catch {
      setGroupError('Не удалось загрузить спортсменов этой группы.');
    } finally {
      setLoadingGroupId((current) => current === groupId ? null : current);
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
      Alert.alert('Ошибка', 'Не удалось загрузить доступных спортсменов.');
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function addAthlete(athlete: Athlete) {
    if (!addToGroup || addingAthleteId !== null) return;

    const group = addToGroup;
    setAddingAthleteId(athlete.athleteId);

    try {
      await api.post(`/Groups/${group.trainingGroupId}/athletes`, {
        athleteId: athlete.athleteId,
      });

      const response = await api.get<Athlete[]>(
        `/Groups/${group.trainingGroupId}/athletes`,
      );

      setGroupAthletes(response.data);
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
      let message = 'Не удалось добавить спортсмена.';

      if (status === 409) message = 'Этот спортсмен уже состоит в группе.';
      else if (status === 404) message = 'Группа или спортсмен не найдены.';
      else if (status === 400) {
        message = err?.response?.data?.message ?? 'Проверь данные запроса.';
      }

      Alert.alert('Ошибка добавления', message);
    } finally {
      setAddingAthleteId(null);
    }
  }

  async function removeAthleteFromGroup(athlete: Athlete) {
    if (expandedGroupId === null || removingAthleteId !== null) return;

    const groupId = expandedGroupId;
    setRemovingAthleteId(athlete.athleteId);

    try {
      await api.delete(`/Groups/${groupId}/athletes/${athlete.athleteId}`);

      setGroupAthletes((current) =>
        current.filter((item) => item.athleteId !== athlete.athleteId),
      );

      await refreshGroups();

      Alert.alert(
        'Готово',
        `${athlete.name} ${athlete.surname} исключён(а) из группы.`,
      );
    } catch {
      Alert.alert('Ошибка', 'Не удалось исключить спортсмена из группы.');
    } finally {
      setRemovingAthleteId(null);
    }
  }

  function confirmRemoveAthleteFromGroup(athlete: Athlete) {
    const group = groups.find((item) => item.trainingGroupId === expandedGroupId);
    if (!group) return;

    Alert.alert(
      'Исключить из группы?',
      `${athlete.name} ${athlete.surname} будет исключён(а) из группы «${group.name}». Аккаунт спортсмена останется в системе.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Исключить',
          style: 'destructive',
          onPress: () => void removeAthleteFromGroup(athlete),
        },
      ],
    );
  }

  async function archiveGroup(group: TrainingGroup) {
    if (archivingGroupId !== null) return;

    setArchivingGroupId(group.trainingGroupId);

    try {
      await api.delete(`/Groups/${group.trainingGroupId}/archive`);

      setGroups((current) =>
        current.filter((item) => item.trainingGroupId !== group.trainingGroupId),
      );

      if (expandedGroupId === group.trainingGroupId) {
        setExpandedGroupId(null);
        setGroupAthletes([]);
      }

      if (archivedGroupsExpanded) await loadArchivedGroups();

      Alert.alert('Группа архивирована', `Группа «${group.name}» перемещена в архив.`);
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err?.response?.data?.message ?? 'Не удалось архивировать группу.',
      );
    } finally {
      setArchivingGroupId(null);
    }
  }

  function confirmArchiveGroup(group: TrainingGroup) {
    Alert.alert(
      'Архивировать группу?',
      `Группа «${group.name}» исчезнет из активного списка. История тренировок и участников сохранится. Группу можно будет восстановить из архива.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Архивировать',
          style: 'destructive',
          onPress: () => void archiveGroup(group),
        },
      ],
    );
  }

  async function archiveAthlete(athlete: Athlete) {
    if (archivingAthleteId !== null) return;

    setArchivingAthleteId(athlete.athleteId);

    try {
      await api.delete(`/Groups/athletes/${athlete.athleteId}/archive`);

      setAllAthletes((current) =>
        current.filter((item) => item.athleteId !== athlete.athleteId),
      );

      setGroupAthletes((current) =>
        current.filter((item) => item.athleteId !== athlete.athleteId),
      );

      await refreshGroups();

      if (archivedAthletesExpanded) await loadArchivedAthletes();

      Alert.alert(
        'Спортсмен архивирован',
        `${athlete.name} ${athlete.surname} больше не сможет войти в систему. Его история сохранена.`,
      );
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err?.response?.data?.message ??
          'Не удалось архивировать спортсмена. Убедись, что он состоит в активной группе.',
      );
    } finally {
      setArchivingAthleteId(null);
    }
  }

  function confirmArchiveAthlete(athlete: Athlete) {
    Alert.alert(
      'Архивировать спортсмена?',
      `Аккаунт ${athlete.name} ${athlete.surname} будет отключён. Он будет исключён из активных групп, но история тренировок и показатели сохранятся. Операцию можно отменить восстановлением из архива.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Архивировать',
          style: 'destructive',
          onPress: () => void archiveAthlete(athlete),
        },
      ],
    );
  }

  async function restoreGroup(group: TrainingGroup) {
    if (restoringGroupId !== null) return;

    setRestoringGroupId(group.trainingGroupId);

    try {
      await api.post(`/Groups/${group.trainingGroupId}/restore`);

      setArchivedGroups((current) =>
        current.filter((item) => item.trainingGroupId !== group.trainingGroupId),
      );

      await refreshGroups();

      Alert.alert('Группа восстановлена', `Группа «${group.name}» снова активна.`);
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err?.response?.data?.message ?? 'Не удалось восстановить группу.',
      );
    } finally {
      setRestoringGroupId(null);
    }
  }

  async function restoreAthlete(athlete: Athlete) {
    if (restoringAthleteId !== null) return;

    setRestoringAthleteId(athlete.athleteId);

    try {
      await api.post(`/Groups/athletes/${athlete.athleteId}/restore`);

      setArchivedAthletes((current) =>
        current.filter((item) => item.athleteId !== athlete.athleteId),
      );

      await loadAllAthletes();

      Alert.alert(
        'Спортсмен восстановлен',
        `${athlete.name} ${athlete.surname} снова может пользоваться системой.`,
      );
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err?.response?.data?.message ?? 'Не удалось восстановить спортсмена.',
      );
    } finally {
      setRestoringAthleteId(null);
    }
  }

  async function toggleArchivedGroups() {
    const next = !archivedGroupsExpanded;
    setArchivedGroupsExpanded(next);
    if (next) await loadArchivedGroups();
  }

  async function toggleArchivedAthletes() {
    const next = !archivedAthletesExpanded;
    setArchivedAthletesExpanded(next);
    if (next) await loadArchivedAthletes();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
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
            <Text style={styles.subtitle}>Спортсмены твоих групп</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{allAthletes.length}</Text>
          </View>
        </View>

        <Pressable
          style={styles.createGroupButton}
          onPress={() => setShowCreateGroupModal(true)}
        >
          <Text style={styles.createGroupButtonText}>+ Создать группу</Text>
        </Pressable>

        {refreshError && <Text style={styles.error}>{refreshError}</Text>}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.message}>Загружаем данные...</Text>
          </View>
        )}

        {error && !loading && (
          <View>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void handleRefresh()}>
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {!loading && (!error || groups.length > 0) && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Мои группы</Text>
                <Text style={styles.sectionCount}>{groups.length}</Text>
              </View>

              {groups.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Групп пока нет</Text>
                  <Text style={styles.emptyText}>
                    Создай первую группу, чтобы добавлять в неё спортсменов.
                  </Text>
                  <Pressable
                    style={styles.emptyCreateButton}
                    onPress={() => setShowCreateGroupModal(true)}
                  >
                    <Text style={styles.emptyCreateButtonText}>Создать первую группу</Text>
                  </Pressable>
                </View>
              ) : (
                groups.map((group) => {
                  const isExpanded = expandedGroupId === group.trainingGroupId;
                  const isArchiving = archivingGroupId === group.trainingGroupId;

                  return (
                    <View key={group.trainingGroupId} style={styles.groupCard}>
                      <View style={styles.groupHeader}>
                        <Pressable
                          style={styles.groupMain}
                          onPress={() => void toggleGroup(group.trainingGroupId)}
                        >
                          <View style={styles.groupIcon}>
                            <Text style={styles.groupIconText}>
                              {group.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.groupInfo}>
                            <Text style={styles.groupName}>{group.name}</Text>
                            <Text style={styles.groupCount}>
                              {group.athletesCount} {getCountLabel(group.athletesCount)}
                            </Text>
                            {group.description ? (
                              <Text style={styles.groupDescription} numberOfLines={2}>
                                {group.description}
                              </Text>
                            ) : null}
                          </View>

                          <Text style={styles.chevron}>{isExpanded ? '⌃' : '›'}</Text>
                        </Pressable>

                        <Pressable
                          style={styles.archiveIconButton}
                          disabled={isArchiving}
                          onPress={() => confirmArchiveGroup(group)}
                        >
                          {isArchiving ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Text style={styles.archiveIconText}>×</Text>
                          )}
                        </Pressable>
                      </View>

                      {isExpanded && (
                        <View style={styles.groupRoster}>
                          <View style={styles.rosterDivider} />

                          <GroupMetricsSection groupId={group.trainingGroupId} />

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
                              <ActivityIndicator size="small" color="#2563EB" />
                              <Text style={styles.message}>Загружаем спортсменов...</Text>
                            </View>
                          ) : groupError ? (
                            <Text style={styles.error}>{groupError}</Text>
                          ) : groupAthletes.length === 0 ? (
                            <Text style={styles.message}>
                              В этой группе пока нет спортсменов
                            </Text>
                          ) : (
                            groupAthletes.map((athlete) => (
                              <View key={athlete.athleteId} style={styles.memberRow}>
                                <View style={styles.memberInfo}>
                                  <AthleteRow
                                    athlete={athlete}
                                    onPress={() => openAthlete(athlete)}
                                  />
                                </View>

                                <Pressable
                                  style={styles.removeButton}
                                  disabled={removingAthleteId === athlete.athleteId}
                                  onPress={() => confirmRemoveAthleteFromGroup(athlete)}
                                  accessibilityLabel={`Исключить ${athlete.name} ${athlete.surname} из группы`}
                                >
                                  {removingAthleteId === athlete.athleteId ? (
                                    <ActivityIndicator size="small" color="#DC2626" />
                                  ) : (
                                    <Text style={styles.removeButtonText}>−</Text>
                                  )}
                                </Pressable>

                                <Pressable
                                  style={styles.archiveAthleteButton}
                                  disabled={archivingAthleteId === athlete.athleteId}
                                  onPress={() => confirmArchiveAthlete(athlete)}
                                  accessibilityLabel={`Архивировать ${athlete.name} ${athlete.surname}`}
                                >
                                  {archivingAthleteId === athlete.athleteId ? (
                                    <ActivityIndicator size="small" color="#DC2626" />
                                  ) : (
                                    <Text style={styles.archiveAthleteButtonText}>×</Text>
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
                <Text style={styles.sectionTitle}>Все спортсмены</Text>
                <Text style={styles.sectionCount}>{allAthletes.length}</Text>
              </View>

              {loadingAthletes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.message}>Загружаем список...</Text>
                </View>
              ) : athletesError ? (
                <Text style={styles.error}>{athletesError}</Text>
              ) : allAthletes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Спортсменов пока нет</Text>
                  <Text style={styles.emptyText}>
                    Зарегистрированные спортсмены появятся здесь.
                  </Text>
                </View>
              ) : (
                <View style={styles.allAthletesCard}>
                  {allAthletes.map((athlete, index) => (
                    <View key={athlete.athleteId}>
                      {index > 0 && <View style={styles.rosterDivider} />}
                      <View style={styles.memberRow}>
                        <View style={styles.memberInfo}>
                          <AthleteRow
                            athlete={athlete}
                            onPress={() => openAthlete(athlete)}
                          />
                        </View>
                        <Pressable
                          style={styles.archiveAthleteButton}
                          disabled={archivingAthleteId === athlete.athleteId}
                          onPress={() => confirmArchiveAthlete(athlete)}
                        >
                          {archivingAthleteId === athlete.athleteId ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Text style={styles.archiveAthleteButtonText}>×</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Pressable style={styles.archiveSectionHeader} onPress={() => void toggleArchivedGroups()}>
                <Text style={styles.sectionTitle}>Архив групп</Text>
                <Text style={styles.sectionCount}>
                  {archivedGroups.length} {archivedGroupsExpanded ? '⌃' : '›'}
                </Text>
              </Pressable>

              {archivedGroupsExpanded && (
                <View style={styles.archiveCard}>
                  {loadingArchivedGroups ? (
                    <ActivityIndicator color="#2563EB" />
                  ) : archivedGroups.length === 0 ? (
                    <Text style={styles.message}>Архивных групп нет</Text>
                  ) : (
                    archivedGroups.map((group) => (
                      <View key={group.trainingGroupId} style={styles.archivedRow}>
                        <View style={styles.archivedInfo}>
                          <Text style={styles.athleteName}>{group.name}</Text>
                          <Text style={styles.athleteEmail}>
                            {group.athletesCount} {getCountLabel(group.athletesCount)}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.restoreButton}
                          disabled={restoringGroupId === group.trainingGroupId}
                          onPress={() => void restoreGroup(group)}
                        >
                          {restoringGroupId === group.trainingGroupId ? (
                            <ActivityIndicator size="small" color="#2563EB" />
                          ) : (
                            <Text style={styles.restoreButtonText}>Вернуть</Text>
                          )}
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Pressable style={styles.archiveSectionHeader} onPress={() => void toggleArchivedAthletes()}>
                <Text style={styles.sectionTitle}>Архив спортсменов</Text>
                <Text style={styles.sectionCount}>
                  {archivedAthletes.length} {archivedAthletesExpanded ? '⌃' : '›'}
                </Text>
              </Pressable>

              {archivedAthletesExpanded && (
                <View style={styles.archiveCard}>
                  {loadingArchivedAthletes ? (
                    <ActivityIndicator color="#2563EB" />
                  ) : archivedAthletes.length === 0 ? (
                    <Text style={styles.message}>Архивных спортсменов нет</Text>
                  ) : (
                    archivedAthletes.map((athlete) => (
                      <View key={athlete.athleteId} style={styles.archivedRow}>
                        <View style={styles.archivedInfo}>
                          <Text style={styles.athleteName}>
                            {athlete.name} {athlete.surname}
                          </Text>
                          {athlete.email ? (
                            <Text style={styles.athleteEmail}>{athlete.email}</Text>
                          ) : null}
                        </View>
                        <Pressable
                          style={styles.restoreButton}
                          disabled={restoringAthleteId === athlete.athleteId}
                          onPress={() => void restoreAthlete(athlete)}
                        >
                          {restoringAthleteId === athlete.athleteId ? (
                            <ActivityIndicator size="small" color="#2563EB" />
                          ) : (
                            <Text style={styles.restoreButtonText}>Вернуть</Text>
                          )}
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

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
                <Text style={styles.modalTitle}>Добавить спортсмена</Text>
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
                <Text style={styles.message}>Загружаем доступных спортсменов...</Text>
              </View>
            ) : availableAthletes.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.emptyTitle}>Нет доступных спортсменов</Text>
                <Text style={styles.emptyText}>
                  Все зарегистрированные спортсмены уже состоят в этой группе или список пока пуст.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.availableList} keyboardShouldPersistTaps="handled">
                {availableAthletes.map((athlete) => {
                  const isAdding = addingAthleteId === athlete.athleteId;

                  return (
                    <Pressable
                      key={athlete.athleteId}
                      style={styles.availableAthlete}
                      disabled={addingAthleteId !== null}
                      onPress={() => void addAthlete(athlete)}
                    >
                      <View style={styles.athleteAvatar}>
                        <Text style={styles.athleteAvatarText}>{getInitials(athlete)}</Text>
                      </View>
                      <View style={styles.availableAthleteInfo}>
                        <Text style={styles.athleteName}>
                          {athlete.name} {athlete.surname}
                        </Text>
                        {athlete.email ? (
                          <Text style={styles.athleteEmail}>{athlete.email}</Text>
                        ) : null}
                      </View>
                      {isAdding ? (
                        <ActivityIndicator size="small" color="#2563EB" />
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

      <Modal
        visible={showCreateGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!creatingGroup) setShowCreateGroupModal(false);
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
              style={[styles.createSubmitButton, creatingGroup && styles.disabledButton]}
              onPress={() => void createGroup()}
              disabled={creatingGroup}
            >
              {creatingGroup ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createSubmitButtonText}>Создать группу</Text>
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
    <Pressable style={styles.athleteRow} onPress={onPress} disabled={!onPress}>
      <View style={styles.athleteAvatar}>
        <Text style={styles.athleteAvatarText}>{getInitials(athlete)}</Text>
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
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#6B7280' },
  totalBadge: {
    minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: 22,
    backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center',
  },
  totalBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  createGroupButton: {
    marginTop: 18, backgroundColor: '#111827', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  createGroupButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#111827' },
  sectionCount: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  groupCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  groupMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  groupIcon: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  groupIconText: { color: '#2563EB', fontSize: 18, fontWeight: '700' },
  groupInfo: { flex: 1, minWidth: 0 },
  groupName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  groupCount: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  groupDescription: { marginTop: 5, fontSize: 12, color: '#9CA3AF' },
  chevron: { marginLeft: 10, fontSize: 24, color: '#9CA3AF' },
  archiveIconButton: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  archiveIconText: { color: '#DC2626', fontSize: 25, lineHeight: 27 },
  groupRoster: { paddingHorizontal: 16, paddingBottom: 8 },
  rosterDivider: { height: 1, backgroundColor: '#F0F1F4', marginBottom: 4 },
  addAthleteButton: {
    alignSelf: 'flex-start', marginTop: 10, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#EEF2FF',
  },
  addAthleteButtonText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberInfo: { flex: 1, minWidth: 0 },
  removeButton: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  removeButtonText: { color: '#DC2626', fontSize: 25, lineHeight: 27, fontWeight: '500' },
  archiveAthleteButton: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFF1F2',
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  archiveAthleteButtonText: { color: '#B91C1C', fontSize: 23, lineHeight: 26 },
  allAthletesCard: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16 },
  athleteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  athleteAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  athleteAvatarText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  athleteInfo: { flex: 1, minWidth: 0 },
  athleteName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  athleteEmail: { marginTop: 3, fontSize: 12, color: '#9CA3AF' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  emptyText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: '#6B7280' },
  emptyCreateButton: {
    alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, marginTop: 15,
  },
  emptyCreateButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  message: { fontSize: 13, color: '#6B7280' },
  error: { paddingVertical: 10, fontSize: 13, lineHeight: 19, color: '#DC2626' },
  retryButton: {
    alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  archiveSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  archiveCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, gap: 8 },
  archivedRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F0F1F4',
  },
  archivedInfo: { flex: 1, minWidth: 0 },
  restoreButton: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#EEF2FF', marginLeft: 8,
  },
  restoreButtonText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', justifyContent: 'flex-end' },
  modalCard: {
    maxHeight: '82%', backgroundColor: '#F5F6F8', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 28,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitleContainer: { flex: 1, paddingRight: 12 },
  modalTitle: { fontSize: 21, fontWeight: '700', color: '#111827' },
  modalSubtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  modalCloseButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCloseText: { fontSize: 25, lineHeight: 28, color: '#374151' },
  modalLoading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 12 },
  modalEmpty: { paddingVertical: 24 },
  availableList: { flexGrow: 0 },
  availableAthlete: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 14, paddingHorizontal: 12, marginBottom: 8,
  },
  availableAthleteInfo: { flex: 1, paddingVertical: 12 },
  availablePlus: { fontSize: 27, fontWeight: '400', color: '#2563EB', paddingHorizontal: 8 },
  modalCancelButton: {
    alignItems: 'center', justifyContent: 'center', minHeight: 48,
    backgroundColor: '#E5E7EB', borderRadius: 13, marginTop: 12,
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  createModalCard: {
    backgroundColor: '#F5F6F8', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 22, paddingBottom: 32,
  },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 18, marginBottom: 7 },
  groupInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#111827',
  },
  descriptionInput: { minHeight: 100 },
  createSubmitButton: {
    backgroundColor: '#2563EB', borderRadius: 13, minHeight: 48,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  createSubmitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
});
