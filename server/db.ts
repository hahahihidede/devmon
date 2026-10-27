import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Read config strictly from environment variables
const dbConfig: pg.PoolConfig = {
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'device_activity_db',
  ssl: process.env.PGSSL === 'true' || process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
  max: 10,
};

let pool: pg.Pool | null = null;
let isConnected = false;
let lastConnectionError: string | null = null;
let activeKeywordTable: string = 'events';
let activeKeywordColumnMapping = {
  keyword: 'details',
  timestamp: 'timestamp',
  deviceId: 'device_id',
  eventType: 'event_type',
  details: 'details',
};

// Memory fallback store when PostgreSQL server is not connected
export interface MockActivityLog {
  id: string;
  keyword: string;
  event_type: string;
  device_id: string;
  timestamp: string; // ISO UTC
  details?: string;
  consent_verified: boolean;
}

export interface ScreenshotMetadata {
  id: string;
  filename: string;
  original_filename: string;
  timestamp: string; // ISO UTC
  file_size: number;
  mime_type: string;
  storage_status: string;
  device_id: string;
  notes?: string;
}

const mockActivityLogs: MockActivityLog[] = [
  {
    id: 'act-001',
    keyword: 'dokumen_rahasia_finansial_q3.xlsx',
    event_type: 'FILE_OPEN',
    device_id: 'LAPTOP-OFFICE-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    details: 'Aplikasi: MS Excel - Direktori: D:\\Financial_Reports',
    consent_verified: true,
  },
  {
    id: 'act-002',
    keyword: 'https://internal.terralogiq.com/portal/audit',
    event_type: 'URL_VISIT',
    device_id: 'LAPTOP-OFFICE-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    details: 'Browser: Google Chrome - Window: Portal Audit Internal',
    consent_verified: true,
  },
  {
    id: 'act-003',
    keyword: 'terralogiq vpn connect asia-east',
    event_type: 'SYSTEM_COMMAND',
    device_id: 'WORKSTATION-ENG-12',
    timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    details: 'Terminal: bash - Status: CONNECTED',
    consent_verified: true,
  },
  {
    id: 'act-004',
    keyword: 'revisi_kontrak_kerjasama_2026.pdf',
    event_type: 'FILE_DOWNLOAD',
    device_id: 'LAPTOP-LEGAL-02',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    details: 'Ukuran: 2.4 MB - Sumber: Google Drive Workspace',
    consent_verified: true,
  },
  {
    id: 'act-005',
    keyword: 'git commit -m "feat: audit logging policy v2"',
    event_type: 'KEYSTROKE_EVENT',
    device_id: 'WORKSTATION-ENG-12',
    timestamp: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    details: 'Repository: backend-audit-service - Branch: main',
    consent_verified: true,
  },
  {
    id: 'act-006',
    keyword: 'docker compose -f docker-compose.prod.yml up -d',
    event_type: 'SYSTEM_COMMAND',
    device_id: 'SERVER-STAGING-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    details: 'Pengguna: sysadmin (consent policy enforced)',
    consent_verified: true,
  },
  {
    id: 'act-007',
    keyword: 'laporan_harian_kegiatan_oktober.docx',
    event_type: 'FILE_PRINT',
    device_id: 'LAPTOP-OFFICE-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    details: 'Printer: Canon-iR-ADV-C3525 - Halaman: 1-12',
    consent_verified: true,
  },
  {
    id: 'act-008',
    keyword: 'https://github.com/org/compliance-engine/pull/48',
    event_type: 'URL_VISIT',
    device_id: 'WORKSTATION-ENG-12',
    timestamp: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    details: 'Review pull request audit trail parser',
    consent_verified: true,
  },
  {
    id: 'act-009',
    keyword: 'SELECT count(*) FROM user_consents WHERE is_active = true;',
    event_type: 'KEYSTROKE_EVENT',
    device_id: 'WORKSTATION-ENG-12',
    timestamp: new Date(Date.now() - 1000 * 60 * 960).toISOString(),
    details: 'Database IDE: DBeaver - Client: Read-only analytics',
    consent_verified: true,
  },
  {
    id: 'act-010',
    keyword: 'ssh -i ~/.ssh/bastion deploy@10.0.1.5',
    event_type: 'SYSTEM_COMMAND',
    device_id: 'WORKSTATION-ENG-12',
    timestamp: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    details: 'Session ID: ssh-session-9812 - Authorized maintenance',
    consent_verified: true,
  },
];

const mockScreenshots: ScreenshotMetadata[] = [
  {
    id: 'scr-001',
    filename: 'screen_sample_01.jpg',
    original_filename: 'display_audit_workstation12_1020.jpg',
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    file_size: 245800,
    mime_type: 'image/jpeg',
    storage_status: 'AVAILABLE',
    device_id: 'WORKSTATION-ENG-12',
    notes: 'Aktivitas desktop rutin - consent token active',
  },
  {
    id: 'scr-002',
    filename: 'screen_sample_02.jpg',
    original_filename: 'display_audit_laptop04_1100.jpg',
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    file_size: 312450,
    mime_type: 'image/jpeg',
    storage_status: 'AVAILABLE',
    device_id: 'LAPTOP-OFFICE-04',
    notes: 'Aplikasi akuntansi dan lembar kerja',
  },
  {
    id: 'scr-003',
    filename: 'screen_sample_03.jpg',
    original_filename: 'display_audit_legal02_1345.jpg',
    timestamp: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    file_size: 289100,
    mime_type: 'image/jpeg',
    storage_status: 'AVAILABLE',
    device_id: 'LAPTOP-LEGAL-02',
    notes: 'Verifikasi klausul kepatuhan regulasi',
  },
];

let isMonitoringActive = true;

export function getMonitoringStatus() {
  return {
    active: isMonitoringActive,
    statusText: isMonitoringActive ? 'AKTIF (Pemantauan Berjalan)' : 'DIHENTIKAN SEMENTARA (Audit Paused)',
    updatedAt: new Date().toISOString(),
  };
}

export function setMonitoringStatus(active: boolean) {
  isMonitoringActive = active;
  return getMonitoringStatus();
}

// Update DB config dynamically and reconnect
export async function updateAndTestDbConnection(newConfig: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message: string; error?: string }> {
  const testConfig: pg.PoolConfig = {
    ...dbConfig,
    host: newConfig.host || dbConfig.host,
    port: newConfig.port || dbConfig.port,
    user: newConfig.user || dbConfig.user,
    password: newConfig.password !== undefined ? newConfig.password : dbConfig.password,
    database: newConfig.database || dbConfig.database,
    ssl: newConfig.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 4000,
  };

  const testPool = new Pool(testConfig);
  try {
    const client = await testPool.connect();
    await client.query('SELECT 1;');
    client.release();

    // Success! Update active pool
    if (pool) {
      await pool.end().catch(() => {});
    }
    pool = testPool;
    Object.assign(dbConfig, testConfig);
    isConnected = true;
    lastConnectionError = null;

    // Check screenshot metadata table
    await ensureScreenshotMetadataTable();

    return {
      success: true,
      message: `Koneksi berhasil ke PostgreSQL: ${testConfig.user}@${testConfig.host}:${testConfig.port}/${testConfig.database}`,
    };
  } catch (err: any) {
    await testPool.end().catch(() => {});
    isConnected = false;
    lastConnectionError = err.message;
    return {
      success: false,
      message: 'Gagal terhubung ke PostgreSQL dengan kredensial tersebut.',
      error: err.message,
    };
  }
}

// Initial DB connection pool
export async function initDbPool(): Promise<boolean> {
  const res = await updateAndTestDbConnection({});
  if (!res.success) {
    console.warn(`[Database] Notice: ${res.error}. Running in local mock/hybrid mode.`);
  } else {
    console.log(`[Database] PostgreSQL connection established: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  }
  return res.success;
}


// Ensure the dedicated screenshot metadata table exists
export async function ensureScreenshotMetadataTable(): Promise<{ success: boolean; created?: boolean; message?: string }> {
  if (!pool || !isConnected) {
    return { success: false, message: 'Database tidak terhubung' };
  }

  const client = await pool.connect();
  try {
    const checkRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'screenshot_metadata'
      );
    `);

    const exists = checkRes.rows[0]?.exists;
    if (!exists) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS screenshot_metadata (
          id VARCHAR(64) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          original_filename VARCHAR(255),
          timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          file_size BIGINT NOT NULL,
          mime_type VARCHAR(64) NOT NULL,
          storage_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
          device_id VARCHAR(128) DEFAULT 'DEVICE-01',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_screenshot_timestamp ON screenshot_metadata (timestamp DESC);
      `);
      return { success: true, created: true, message: 'Tabel screenshot_metadata berhasil dibuat.' };
    }
    return { success: true, created: false, message: 'Tabel screenshot_metadata sudah tersedia.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  } finally {
    client.release();
  }
}

// Ensure sample consented device activity logs table exists if user wants to seed
export async function seedSampleActivityTable(): Promise<{ success: boolean; message: string }> {
  if (!pool || !isConnected) {
    return { success: false, message: 'Database tidak terhubung' };
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_activity_logs (
        id VARCHAR(64) PRIMARY KEY,
        keyword TEXT NOT NULL,
        event_type VARCHAR(64) NOT NULL DEFAULT 'KEYSTROKE_EVENT',
        device_id VARCHAR(128) NOT NULL DEFAULT 'WORKSTATION-01',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        consent_verified BOOLEAN DEFAULT TRUE
      );
      CREATE INDEX IF NOT EXISTS idx_device_activity_timestamp ON device_activity_logs (timestamp DESC);
    `);

    // Insert mock entries if empty
    const countRes = await client.query('SELECT COUNT(*) FROM device_activity_logs;');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      for (const item of mockActivityLogs) {
        await client.query(
          `INSERT INTO device_activity_logs (id, keyword, event_type, device_id, timestamp, details, consent_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [item.id, item.keyword, item.event_type, item.device_id, item.timestamp, item.details, item.consent_verified]
        );
      }
    }

    return { success: true, message: 'Tabel device_activity_logs dan sampel data aktivitas berhasil disiapkan di PostgreSQL.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  } finally {
    client.release();
  }
}

// Schema Inspector: dynamically inspect tables and columns
export async function inspectDatabaseSchema(): Promise<{
  connected: boolean;
  dbConfigSafe: { host: string; port: number; user: string; database: string; ssl: boolean };
  tables: Array<{
    name: string;
    rowCount: number;
    columns: Array<{ name: string; type: string; nullable: boolean; isTimestamp: boolean; isPrimaryKey: boolean }>;
    candidateKeywordColumn?: string;
    candidateTimestampColumn?: string;
  }>;
  activeKeywordTable: string;
  activeKeywordColumnMapping: typeof activeKeywordColumnMapping;
  error?: string;
}> {
  const dbConfigSafe = {
    host: dbConfig.host || '127.0.0.1',
    port: dbConfig.port || 5432,
    user: dbConfig.user || 'postgres',
    database: dbConfig.database || 'device_activity_db',
    ssl: Boolean(dbConfig.ssl),
  };

  if (!pool || !isConnected) {
    // Return mock schema reflection
    return {
      connected: false,
      dbConfigSafe,
      error: lastConnectionError || 'PostgreSQL belum terhubung. Menggunakan mode demonstrasi/fallback lokal.',
      activeKeywordTable,
      activeKeywordColumnMapping,
      tables: [
        {
          name: 'device_activity_logs (Local Fallback)',
          rowCount: mockActivityLogs.length,
          columns: [
            { name: 'id', type: 'varchar(64)', nullable: false, isTimestamp: false, isPrimaryKey: true },
            { name: 'keyword', type: 'text', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'event_type', type: 'varchar(64)', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'device_id', type: 'varchar(128)', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'timestamp', type: 'timestamptz', nullable: false, isTimestamp: true, isPrimaryKey: false },
            { name: 'details', type: 'text', nullable: true, isTimestamp: false, isPrimaryKey: false },
            { name: 'consent_verified', type: 'boolean', nullable: true, isTimestamp: false, isPrimaryKey: false },
          ],
          candidateKeywordColumn: 'keyword',
          candidateTimestampColumn: 'timestamp',
        },
        {
          name: 'screenshot_metadata (Local Fallback)',
          rowCount: mockScreenshots.length,
          columns: [
            { name: 'id', type: 'varchar(64)', nullable: false, isTimestamp: false, isPrimaryKey: true },
            { name: 'filename', type: 'varchar(255)', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'original_filename', type: 'varchar(255)', nullable: true, isTimestamp: false, isPrimaryKey: false },
            { name: 'timestamp', type: 'timestamptz', nullable: false, isTimestamp: true, isPrimaryKey: false },
            { name: 'file_size', type: 'bigint', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'mime_type', type: 'varchar(64)', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'storage_status', type: 'varchar(32)', nullable: false, isTimestamp: false, isPrimaryKey: false },
            { name: 'device_id', type: 'varchar(128)', nullable: true, isTimestamp: false, isPrimaryKey: false },
          ],
          candidateKeywordColumn: 'filename',
          candidateTimestampColumn: 'timestamp',
        },
      ],
    };
  }

  const client = await pool.connect();
  try {
    // 1. Fetch all public tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = [];
    for (const row of tableRes.rows) {
      const tableName = row.table_name;

      // 2. Fetch columns for each table
      const colRes = await client.query(
        `
        SELECT 
          c.column_name, 
          c.data_type, 
          c.is_nullable,
          CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_pk
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu 
          ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema
        LEFT JOIN information_schema.table_constraints tc 
          ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema AND tc.constraint_type = 'PRIMARY KEY'
        WHERE c.table_schema = 'public' AND c.table_name = $1
        ORDER BY c.ordinal_position;
      `,
        [tableName]
      );

      // Estimate row count safely
      let rowCount = 0;
      try {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM "${tableName}";`);
        rowCount = parseInt(countRes.rows[0]?.count || '0', 10);
      } catch {
        rowCount = 0;
      }

      const columns = colRes.rows.map((c: any) => {
        const typeLower = c.data_type.toLowerCase();
        const isTimestamp = typeLower.includes('timestamp') || typeLower.includes('date') || typeLower.includes('time');
        return {
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          isTimestamp,
          isPrimaryKey: Boolean(c.is_pk),
        };
      });

      // Find candidate keyword/event and timestamp columns
      let candidateKeyword = columns.find((c: any) =>
        ['keyword', 'event', 'event_name', 'action', 'title', 'query', 'content', 'text', 'message'].includes(c.name.toLowerCase())
      )?.name;
      if (!candidateKeyword) {
        candidateKeyword = columns.find((c: any) => !c.isPrimaryKey && !c.isTimestamp && c.type.includes('char'))?.name;
      }

      const candidateTimestamp = columns.find((c: any) => c.isTimestamp)?.name || 'timestamp';

      tables.push({
        name: tableName,
        rowCount,
        columns,
        candidateKeywordColumn: candidateKeyword,
        candidateTimestampColumn: candidateTimestamp,
      });
    }

    return {
      connected: true,
      dbConfigSafe,
      tables,
      activeKeywordTable,
      activeKeywordColumnMapping,
    };
  } catch (err: any) {
    return {
      connected: false,
      dbConfigSafe,
      tables: [],
      activeKeywordTable,
      activeKeywordColumnMapping,
      error: err.message,
    };
  } finally {
    client.release();
  }
}

// Set active keyword table and column mapping
export function setActiveKeywordTableMapping(tableName: string, mapping: Partial<typeof activeKeywordColumnMapping>) {
  activeKeywordTable = tableName;
  activeKeywordColumnMapping = { ...activeKeywordColumnMapping, ...mapping };
}

// --------------------------------------------------------------------------
// Keyword & Event Queries (STRICTLY READ-ONLY parameterized queries)
// --------------------------------------------------------------------------
export interface GetKeywordsParams {
  page?: number;
  limit?: number;
  startDate?: string; // YYYY-MM-DD or ISO
  endDate?: string;   // YYYY-MM-DD or ISO
  search?: string;
  tableName?: string;
}

export async function getKeywordLogs(params: GetKeywordsParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  // If DB not connected, use mock data store
  if (!pool || !isConnected) {
    let filtered = [...mockActivityLogs];

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.keyword.toLowerCase().includes(q) ||
          item.event_type.toLowerCase().includes(q) ||
          item.device_id.toLowerCase().includes(q) ||
          (item.details && item.details.toLowerCase().includes(q))
      );
    }

    if (params.startDate) {
      const startMs = new Date(params.startDate).getTime();
      filtered = filtered.filter(item => new Date(item.timestamp).getTime() >= startMs);
    }

    if (params.endDate) {
      // Include end of day
      const endMs = new Date(params.endDate).getTime() + (params.endDate.length <= 10 ? 24 * 60 * 60 * 1000 - 1 : 0);
      filtered = filtered.filter(item => new Date(item.timestamp).getTime() <= endMs);
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const records = filtered.slice(offset, offset + limit);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'local_fallback',
      tableName: 'device_activity_logs (Local)',
    };
  }

  // Live PostgreSQL query
  const client = await pool.connect();
  try {
    // Determine target table with smart auto-detection
    let table = params.tableName || activeKeywordTable;
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      table = 'events';
    }

    // Inspect columns of the table to safely select
    let colRes = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );

    // If requested table doesn't exist, auto-discover public tables (events, etc.)
    if (colRes.rows.length === 0) {
      const tRes = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`
      );
      const tables = tRes.rows.map((r: any) => r.table_name);
      if (tables.includes('events')) {
        table = 'events';
      } else if (tables.includes('device_activity_logs')) {
        table = 'device_activity_logs';
      } else if (tables.length > 0) {
        table = tables.find((t: string) => t !== 'screenshot_metadata') || tables[0];
      }
      activeKeywordTable = table;

      colRes = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
    }

    if (colRes.rows.length === 0) {
      throw new Error(`Tidak ditemukan tabel aktivitas yang valid dalam database PostgreSQL.`);
    }

    const availableCols = colRes.rows.map((r: any) => r.column_name);
    const colTypes = Object.fromEntries(colRes.rows.map((r: any) => [r.column_name, r.data_type.toLowerCase()]));

    // Determine timestamp column
    let timestampCol = availableCols.includes('timestamp')
      ? 'timestamp'
      : availableCols.find((c: string) =>
          colTypes[c]?.includes('timestamp') || colTypes[c]?.includes('date') || colTypes[c]?.includes('time')
        ) || availableCols[0];

    // Determine keyword/event column
    let keywordCol = availableCols.includes('details')
      ? 'details'
      : availableCols.includes('keyword')
      ? 'keyword'
      : availableCols.find((c: string) =>
          ['keyword', 'event', 'event_name', 'action', 'title', 'query', 'content'].includes(c.toLowerCase())
        ) || availableCols[1] || availableCols[0];

    // Construct parameterized WHERE clauses
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    if (params.search) {
      if (availableCols.includes('details') && availableCols.includes('event_type')) {
        whereClauses.push(`("details"::text ILIKE $${pIdx} OR "event_type"::text ILIKE $${pIdx})`);
      } else {
        whereClauses.push(`("${keywordCol}"::text ILIKE $${pIdx})`);
      }
      queryParams.push(`%${params.search}%`);
      pIdx++;
    }

    if (params.startDate) {
      whereClauses.push(`("${timestampCol}" >= $${pIdx})`);
      queryParams.push(new Date(params.startDate).toISOString());
      pIdx++;
    }

    if (params.endDate) {
      const endParsed = new Date(params.endDate);
      if (params.endDate.length <= 10) {
        endParsed.setUTCHours(23, 59, 59, 999);
      }
      whereClauses.push(`("${timestampCol}" <= $${pIdx})`);
      queryParams.push(endParsed.toISOString());
      pIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM "${table}" ${whereSql};`;
    const countRes = await client.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Fetch records (Sorted newest first)
    const selectSql = `
      SELECT * 
      FROM "${table}"
      ${whereSql}
      ORDER BY "${timestampCol}" DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;

    const fetchParams = [...queryParams, limit, offset];
    const dataRes = await client.query(selectSql, fetchParams);

    // Standardize record output for frontend with intelligent keyword extraction
    const standardizedRecords = dataRes.rows.map((row: any) => {
      const detailsStr = typeof row.details === 'string' ? row.details : '';
      let cleanKeyword = '';

      if (row.event_type === 'keyword' && detailsStr.toLowerCase().startsWith('keyword matched:')) {
        cleanKeyword = detailsStr.replace(/^keyword matched:\s*/i, '').trim();
      } else if (row.event_type === 'keystroke' && detailsStr.toLowerCase().startsWith('typed sentence:')) {
        cleanKeyword = detailsStr.replace(/^typed sentence:\s*/i, '').trim();
      } else if (row.keyword) {
        cleanKeyword = row.keyword;
      } else {
        cleanKeyword = detailsStr || (row.event_type ? `[${row.event_type.toUpperCase()}]` : '(aktivitas tercatat)');
      }

      return {
        id: String(row.id || crypto.randomUUID()),
        keyword: cleanKeyword,
        event_type: (row.event_type || 'ACTIVITY').toUpperCase(),
        device_id: row.device_id || row.device || row.hostname || 'DEVICE-01',
        timestamp: row[timestampCol] ? new Date(row[timestampCol]).toISOString() : new Date().toISOString(),
        details: detailsStr || (row.details ? JSON.stringify(row.details) : undefined),
        screenshot_path: row.screenshot_path || undefined,
        raw: row,
      };
    });

    return {
      records: standardizedRecords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'postgresql',
      tableName: table,
      columnsUsed: { keywordCol, timestampCol },
    };
  } finally {
    client.release();
  }
}

// --------------------------------------------------------------------------
// Screenshot Metadata Queries & Mutations
// --------------------------------------------------------------------------
export interface GetScreenshotsParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  deviceId?: string;
}

export async function getScreenshotRecords(params: GetScreenshotsParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 12));
  const offset = (page - 1) * limit;

  if (!pool || !isConnected) {
    let filtered = [...mockScreenshots];
    if (params.startDate) {
      const startMs = new Date(params.startDate).getTime();
      filtered = filtered.filter(item => new Date(item.timestamp).getTime() >= startMs);
    }
    if (params.endDate) {
      const endMs = new Date(params.endDate).getTime() + (params.endDate.length <= 10 ? 24 * 60 * 60 * 1000 - 1 : 0);
      filtered = filtered.filter(item => new Date(item.timestamp).getTime() <= endMs);
    }
    if (params.deviceId) {
      filtered = filtered.filter(item => item.device_id.toLowerCase().includes(params.deviceId!.toLowerCase()));
    }

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const records = filtered.slice(offset, offset + limit);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'local_fallback',
    };
  }

  const client = await pool.connect();
  try {
    // Check if events table exists and contains screenshot_path records
    const checkEventsRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'screenshot_path'
      );
    `);

    const hasEventsScreenshots = Boolean(checkEventsRes.rows[0]?.exists);

    if (hasEventsScreenshots) {
      const whereClauses: string[] = ["screenshot_path IS NOT NULL", "screenshot_path != ''"];
      const queryParams: any[] = [];
      let pIdx = 1;

      if (params.startDate) {
        whereClauses.push(`timestamp >= $${pIdx}`);
        queryParams.push(new Date(params.startDate).toISOString());
        pIdx++;
      }

      if (params.endDate) {
        const endParsed = new Date(params.endDate);
        if (params.endDate.length <= 10) endParsed.setUTCHours(23, 59, 59, 999);
        whereClauses.push(`timestamp <= $${pIdx}`);
        queryParams.push(endParsed.toISOString());
        pIdx++;
      }

      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
      const countRes = await client.query(`SELECT COUNT(*) as total FROM events ${whereSql};`, queryParams);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const querySql = `
        SELECT id, timestamp, event_type, details, screenshot_path
        FROM events
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT $${pIdx} OFFSET $${pIdx + 1};
      `;

      const dataRes = await client.query(querySql, [...queryParams, limit, offset]);

      return {
        records: dataRes.rows.map((row: any) => {
          const rawPath = String(row.screenshot_path || '');
          const cleanFilename = rawPath.replace(/\\/g, '/').split('/').pop() || 'screenshot.png';
          return {
            id: `evt-${row.id}`,
            filename: cleanFilename,
            original_filename: cleanFilename,
            timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
            file_size: 245800,
            mime_type: cleanFilename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
            storage_status: 'AVAILABLE',
            device_id: 'DEVICE-01',
            notes: `[${(row.event_type || 'activity').toUpperCase()}] ${row.details || ''}`,
          };
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        source: 'postgresql (events)',
      };
    }

    // Fallback: Query screenshot_metadata table
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    if (params.startDate) {
      whereClauses.push(`timestamp >= $${pIdx}`);
      queryParams.push(new Date(params.startDate).toISOString());
      pIdx++;
    }

    if (params.endDate) {
      const endParsed = new Date(params.endDate);
      if (params.endDate.length <= 10) endParsed.setUTCHours(23, 59, 59, 999);
      whereClauses.push(`timestamp <= $${pIdx}`);
      queryParams.push(endParsed.toISOString());
      pIdx++;
    }

    if (params.deviceId) {
      whereClauses.push(`device_id ILIKE $${pIdx}`);
      queryParams.push(`%${params.deviceId}%`);
      pIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await client.query(`SELECT COUNT(*) as total FROM screenshot_metadata ${whereSql};`, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const querySql = `
      SELECT id, filename, original_filename, timestamp, file_size, mime_type, storage_status, device_id, notes
      FROM screenshot_metadata
      ${whereSql}
      ORDER BY timestamp DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;

    const dataRes = await client.query(querySql, [...queryParams, limit, offset]);

    return {
      records: dataRes.rows.map((row: any) => ({
        id: row.id,
        filename: row.filename,
        original_filename: row.original_filename,
        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
        file_size: parseInt(row.file_size, 10),
        mime_type: row.mime_type,
        storage_status: row.storage_status,
        device_id: row.device_id,
        notes: row.notes,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'postgresql',
    };
  } finally {
    client.release();
  }
}

// Find screenshot by ID
export async function getScreenshotById(id: string): Promise<ScreenshotMetadata | null> {
  if (!pool || !isConnected) {
    return mockScreenshots.find(s => s.id === id) || null;
  }

  const client = await pool.connect();
  try {
    // If ID is from events table (e.g. evt-55)
    if (id.startsWith('evt-')) {
      const rawId = parseInt(id.replace('evt-', ''), 10);
      const res = await client.query(
        `SELECT id, timestamp, event_type, details, screenshot_path 
         FROM events WHERE id = $1 LIMIT 1;`,
        [rawId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const rawPath = String(row.screenshot_path || '');
      const cleanFilename = rawPath.replace(/\\/g, '/').split('/').pop() || 'screenshot.png';

      return {
        id: `evt-${row.id}`,
        filename: cleanFilename,
        original_filename: cleanFilename,
        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
        file_size: 245800,
        mime_type: cleanFilename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        storage_status: 'AVAILABLE',
        device_id: 'DEVICE-01',
        notes: `[${(row.event_type || 'activity').toUpperCase()}] ${row.details || ''}`,
      };
    }

    const res = await client.query(
      `SELECT id, filename, original_filename, timestamp, file_size, mime_type, storage_status, device_id, notes
       FROM screenshot_metadata WHERE id = $1 LIMIT 1;`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      filename: row.filename,
      original_filename: row.original_filename,
      timestamp: new Date(row.timestamp).toISOString(),
      file_size: parseInt(row.file_size, 10),
      mime_type: row.mime_type,
      storage_status: row.storage_status,
      device_id: row.device_id,
      notes: row.notes,
    };
  } finally {
    client.release();
  }
}

// Insert screenshot metadata into database
export async function saveScreenshotMetadata(data: {
  id?: string;
  filename: string;
  original_filename: string;
  timestamp?: string;
  file_size: number;
  mime_type: string;
  storage_status?: string;
  device_id?: string;
  notes?: string;
}): Promise<ScreenshotMetadata> {
  const metadata: ScreenshotMetadata = {
    id: data.id || `scr-${crypto.randomBytes(6).toString('hex')}`,
    filename: data.filename,
    original_filename: data.original_filename,
    timestamp: data.timestamp || new Date().toISOString(),
    file_size: data.file_size,
    mime_type: data.mime_type,
    storage_status: data.storage_status || 'AVAILABLE',
    device_id: data.device_id || 'DEVICE-01',
    notes: data.notes || '',
  };

  // If live DB connected, persist to PostgreSQL
  if (pool && isConnected) {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO screenshot_metadata (id, filename, original_filename, timestamp, file_size, mime_type, storage_status, device_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          metadata.id,
          metadata.filename,
          metadata.original_filename,
          metadata.timestamp,
          metadata.file_size,
          metadata.mime_type,
          metadata.storage_status,
          metadata.device_id,
          metadata.notes,
        ]
      );
    } finally {
      client.release();
    }
  } else {
    // Keep in mock store
    mockScreenshots.unshift(metadata);
  }

  return metadata;
}

// Status check helper
export function getDbConnectionStatus() {
  return {
    connected: isConnected,
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    ssl: Boolean(dbConfig.ssl),
    error: lastConnectionError,
  };
}
