import { ActivityLog, ScreenshotItem, UserSession, SystemStatus, SchemaInspectionResult } from '../types.js';

const TOKEN_KEY = 'device_monitor_token';
const USER_KEY = 'device_monitor_user';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setSession(token: string, user: UserSession) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable
    }
  },
  getUser(): UserSession | null {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Storage unavailable
    }
  },
};

// Generic fetch wrapper with automatic Bearer token
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authStorage.clear();
    // Dispatch auth state change event
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

// Auth API
export async function login(username: string, password: string):Promise<{ success: boolean; token: string; user: UserSession }> {
  const res = await apiRequest<{ success: boolean; token: string; user: UserSession }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  authStorage.setSession(res.token, res.user);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } finally {
    authStorage.clear();
  }
}

export async function verifyCurrentSession(): Promise<{ user: UserSession }> {
  return apiRequest<{ user: UserSession }>('/api/auth/me');
}

// Keywords API
export interface KeywordsResponse {
  success: boolean;
  records: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: 'postgresql' | 'local_fallback';
  tableName: string;
  columnsUsed?: { keywordCol: string; timestampCol: string };
  timezone: string;
}

export async function fetchKeywords(params: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  tableName?: string;
} = {}): Promise<KeywordsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.search) query.set('search', params.search);
  if (params.tableName) query.set('tableName', params.tableName);

  return apiRequest<KeywordsResponse>(`/api/keywords?${query.toString()}`);
}

// Screenshots API
export interface ScreenshotsResponse {
  success: boolean;
  records: ScreenshotItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  storagePath: string;
  timezone: string;
}

export async function fetchScreenshots(params: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  deviceId?: string;
} = {}): Promise<ScreenshotsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.deviceId) query.set('deviceId', params.deviceId);

  return apiRequest<ScreenshotsResponse>(`/api/screenshots?${query.toString()}`);
}

export function getScreenshotImageUrl(id: string): string {
  const token = authStorage.getToken();
  return `/api/screenshots/${encodeURIComponent(id)}/image?token=${encodeURIComponent(token || '')}`;
}

export async function uploadScreenshot(file: File, deviceId: string = 'DEVICE-01', notes: string = ''): Promise<any> {
  const formData = new FormData();
  formData.append('screenshot', file);
  formData.append('deviceId', deviceId);
  formData.append('notes', notes);

  return apiRequest('/api/screenshots/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadScreenshotsBatch(files: File[], deviceId: string = 'DEVICE-01', notes: string = ''): Promise<any> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('screenshots', file);
  }
  formData.append('deviceId', deviceId);
  formData.append('notes', notes);

  return apiRequest('/api/screenshots/upload', {
    method: 'POST',
    body: formData,
  });
}

// System & Schema API
export async function getSystemStatus(): Promise<SystemStatus> {
  return apiRequest<SystemStatus>('/api/system/status');
}

export async function getSchemaInspection(): Promise<{ success: boolean; schema: SchemaInspectionResult }> {
  return apiRequest<{ success: boolean; schema: SchemaInspectionResult }>('/api/system/schema');
}

export async function configureSchema(tableName: string, mapping: Record<string, string>): Promise<any> {
  return apiRequest('/api/system/schema/configure', {
    method: 'POST',
    body: JSON.stringify({ tableName, mapping }),
  });
}

export async function seedSampleData(): Promise<any> {
  return apiRequest('/api/system/seed-sample', {
    method: 'POST',
  });
}

export async function getDeploymentGuide(): Promise<any> {
  return apiRequest('/api/system/deployment-guide');
}

export async function testDatabaseConnection(params: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message: string; error?: string }> {
  return apiRequest('/api/system/test-db-connection', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function toggleMonitoringStatus(active: boolean): Promise<{ success: boolean; active: boolean; statusText: string }> {
  return apiRequest('/api/system/monitoring-control', {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

export async function downloadBackupManifest(): Promise<void> {
  const token = authStorage.getToken();
  const url = `/api/system/backup/download?token=${encodeURIComponent(token || '')}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Gagal mengunduh berkas cadangan');
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `backup_device_activity_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

export async function clearAllData(): Promise<{ success: boolean; message: string }> {
  return apiRequest('/api/system/clear-data', {
    method: 'POST',
  });
}

