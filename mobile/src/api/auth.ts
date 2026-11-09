
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from './client';

const TOKEN_KEY = 'mmt_access_token';
const ROLE_KEY = 'mmt_user_role';
const USER_KEY = 'mmt_user_profile';

export type AuthUser = {
  userId: number | string | null;
  name: string;
  surname: string;
  email: string;
  role: string;
  isMainCoach: boolean;
};

let authenticated = false;
let currentRole: string | null = null;
let currentUser: AuthUser | null = null;

const listeners = new Set<(value: boolean) => void>();
const roleListeners = new Set<(value: string | null) => void>();
const userListeners = new Set<(value: AuthUser | null) => void>();

function publishAuthState(value: boolean) {
  authenticated = value;
  listeners.forEach((listener) => listener(value));
}

function publishRole(role: string | null) {
  currentRole = role;
  roleListeners.forEach((listener) => listener(role));
}

function publishUser(user: AuthUser | null) {
  currentUser = user;
  userListeners.forEach((listener) => listener(user));
}

export function subscribeAuthState(listener: (value: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeRole(listener: (value: string | null) => void) {
  roleListeners.add(listener);
  return () => {
    roleListeners.delete(listener);
  };
}

export function subscribeUser(listener: (value: AuthUser | null) => void) {
  userListeners.add(listener);
  return () => {
    userListeners.delete(listener);
  };
}

export function getCurrentRole() {
  return currentRole;
}

export function getCurrentUser() {
  return currentUser;
}

type LoginResponse = {
  token?: string;
  accessToken?: string;
  userId?: number | string;
  name?: string;
  surname?: string;
  email?: string;
  role?: string;
  roles?: string[];
  isMainCoach?: boolean;
  [key: string]: unknown;
};

export async function login(email: string, password: string) {
  const response = await api.post<LoginResponse>('/Auth/login', {
    email: email.trim(),
    password,
  });

  const data = response.data;
  const token = data.token ?? data.accessToken;

  if (!token) {
    throw new Error('Сервер не вернул токен в ожидаемом поле');
  }

  const role = data.role ?? data.roles?.[0] ?? null;

  const user: AuthUser = {
    userId: data.userId ?? null,
    name: data.name?.trim() ?? '',
    surname: data.surname?.trim() ?? '',
    email: data.email?.trim() ?? email.trim(),
    role: role ?? '',
    isMainCoach: data.isMainCoach === true,
  };

  const storageEntries: [string, string][] = [
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ];

  if (role) {
    storageEntries.push([ROLE_KEY, role]);
  }

  await AsyncStorage.multiSet(storageEntries);

  if (!role) {
    await AsyncStorage.removeItem(ROLE_KEY);
  }

  setAuthToken(token);
  publishUser(user);
  publishRole(role);
  publishAuthState(true);

  return data;
}

export async function restoreSession() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);

  if (!token) {
    setAuthToken(null);
    publishUser(null);
    publishRole(null);
    publishAuthState(false);
    return false;
  }

  const [savedRole, savedUser] = await Promise.all([
    AsyncStorage.getItem(ROLE_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);

  let user: AuthUser | null = null;

  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser) as Partial<AuthUser>;

      user = {
        userId: parsed.userId ?? null,
        name: typeof parsed.name === 'string' ? parsed.name : '',
        surname: typeof parsed.surname === 'string' ? parsed.surname : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
        role:
          typeof parsed.role === 'string'
            ? parsed.role
            : savedRole ?? '',
        isMainCoach: parsed.isMainCoach === true,
      };
    } catch {
      // Повреждённый профиль не должен блокировать восстановление сессии.
      user = null;
    }
  }

  const role = user?.role || savedRole || null;

  // Совместимость со старыми сессиями без сохранённого профиля.
  if (!user && role) {
    user = {
      userId: null,
      name: '',
      surname: '',
      email: '',
      role,
      isMainCoach: false,
    };
  }

  setAuthToken(token);
  publishUser(user);
  publishRole(role);
  publishAuthState(true);

  return true;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY, USER_KEY]);
  setAuthToken(null);
  publishUser(null);
  publishRole(null);
  publishAuthState(false);
}
