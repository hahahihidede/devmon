export interface ActivityLog {
  id: string;
  keyword: string;
  event_type: string;
  device_id: string;
  timestamp: string; // ISO 8601 UTC
  details?: string;
  consent_verified?: boolean;
  raw?: Record<string, any>;
}

export interface ScreenshotItem {
  id: string;
  filename: string;
  original_filename: string;
  timestamp: string; // ISO 8601 UTC
  file_size: number;
  mime_type: string;
  storage_status: string;
  device_id: string;
  notes?: string;
}

export interface UserSession {
  username: string;
  role: 'admin' | 'viewer';
}

export interface DbStatus {
  connected: boolean;
  host: string;
  port: number;
  user: string;
  database: string;
  ssl: boolean;
  error: string | null;
}

export interface StorageStatus {
  fileCount: number;
  totalBytes: number;
  totalMB: string;
  path: string;
  isPreferred: boolean;
  writable: boolean;
  error?: string;
}

export interface SystemStatus {
  serverTimeUtc: string;
  serverTimeWib: string;
  timezone: string;
  database: DbStatus;
  storage: StorageStatus;
  monitoring?: {
    active: boolean;
    statusText: string;
    updatedAt: string;
  };
}

export interface TableColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isTimestamp: boolean;
  isPrimaryKey: boolean;
}

export interface TableSchemaInfo {
  name: string;
  rowCount: number;
  columns: TableColumnInfo[];
  candidateKeywordColumn?: string;
  candidateTimestampColumn?: string;
}

export interface SchemaInspectionResult {
  connected: boolean;
  dbConfigSafe: {
    host: string;
    port: number;
    user: string;
    database: string;
    ssl: boolean;
  };
  tables: TableSchemaInfo[];
  activeKeywordTable: string;
  activeKeywordColumnMapping: {
    keyword: string;
    timestamp: string;
    deviceId: string;
    eventType: string;
    details: string;
  };
  error?: string;
}
