
import { useEffect, useState } from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import {
  getCurrentRole,
  restoreSession,
  subscribeRole,
} from '@/api/auth';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [role, setRole] = useState<string | null>(getCurrentRole);

  useEffect(() => {
    const unsubscribe = subscribeRole(setRole);

    void restoreSession();

    return unsubscribe;
  }, []);

  const isCoach = role?.toLowerCase() === 'coach';

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{
        selected: {
          color: colors.text,
        },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home_filled' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trainings">
        <NativeTabs.Trigger.Label>Тренировки</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar' }}
          md="calendar_month"
        />
      </NativeTabs.Trigger>

      {isCoach && (
        <NativeTabs.Trigger name="athletes">
          <NativeTabs.Trigger.Label>Спортсмены</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.2', selected: 'person.2.fill' }}
            md="groups"
          />
        </NativeTabs.Trigger>
      )}

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>Ещё</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }}
          md="more_horiz"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
