
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://192.168.0.174:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
