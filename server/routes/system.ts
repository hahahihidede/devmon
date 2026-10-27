import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import {
  inspectDatabaseSchema,
  getDbConnectionStatus,
  setActiveKeywordTableMapping,
  seedSampleActivityTable,
  ensureScreenshotMetadataTable,
  updateAndTestDbConnection,
  getMonitoringStatus,
  setMonitoringStatus,
  getScreenshotRecords,
  getKeywordLogs,
  clearDatabaseRecords,
} from '../db.js';
import { getStorageStats } from '../storage.js';

const router = Router();

// GET /api/system/status
router.get('/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const dbStatus = getDbConnectionStatus();
  const storageStatus = getStorageStats();
  const monitoring = getMonitoringStatus();
  const now = new Date();

  // WIB representation
  const wibTime = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(now);

  res.json({
    success: true,
    serverTimeUtc: now.toISOString(),
    serverTimeWib: wibTime,
    timezone: 'Asia/Jakarta (WIB)',
    database: dbStatus,
    storage: storageStatus,
    monitoring,
  });
});

// GET & POST /api/system/monitoring-control
router.get('/monitoring-control', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, ...getMonitoringStatus() });
});

router.post('/monitoring-control', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Nilai active (boolean) wajib disertakan.' });
  }
  const result = setMonitoringStatus(active);
  res.json({ success: true, ...result });
});

// POST /api/system/test-db-connection
router.post('/test-db-connection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { host, port, user, password, database, ssl } = req.body;
  const result = await updateAndTestDbConnection({
    host: host ? String(host).trim() : undefined,
    port: port ? parseInt(port, 10) : undefined,
    user: user ? String(user).trim() : undefined,
    password: password !== undefined ? String(password) : undefined,
    database: database ? String(database).trim() : undefined,
    ssl: Boolean(ssl),
  });

  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// GET /api/system/backup/download
router.get('/backup/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const screenshots = await getScreenshotRecords({ limit: 1000 });
    const keywords = await getKeywordLogs({ limit: 1000 });
    const storageStats = getStorageStats();
    const dbStatus = getDbConnectionStatus();

    const backupPayload = {
      manifestVersion: '1.0',
      exportedAtUtc: new Date().toISOString(),
      timezone: 'Asia/Jakarta (WIB)',
      databaseStatus: dbStatus,
      storageStats,
      screenshotMetadataCount: screenshots.records.length,
      screenshotMetadata: screenshots.records,
      activityLogsCount: keywords.records.length,
      activityLogs: keywords.records,
    };

    const filename = `backup_device_activity_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal membuat arsip backup: ' + err.message });
  }
});

// GET /api/system/schema
router.get('/schema', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = await inspectDatabaseSchema();
    res.json({ success: true, schema });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/schema/configure
router.post('/schema/configure', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { tableName, mapping } = req.body;
  if (!tableName) {
    return res.status(400).json({ error: 'Nama tabel wajib disertakan.' });
  }
  setActiveKeywordTableMapping(tableName, mapping || {});
  res.json({
    success: true,
    message: `Mapping tabel sumber keyword berhasil diperbarui ke: ${tableName}`,
  });
});

// POST /api/system/seed-sample
router.post('/seed-sample', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actRes = await seedSampleActivityTable();
    const metaRes = await ensureScreenshotMetadataTable();
    res.json({
      success: actRes.success && metaRes.success,
      activity: actRes,
      screenshotMetadata: metaRes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/clear-data
router.post('/clear-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await clearDatabaseRecords();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/system/deployment-guide
router.get('/deployment-guide', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const guide = {
    os: 'Ubuntu 22.04 LTS / 24.04 LTS',
    appDirectory: '/opt/device-activity-dashboard',
    storageDirectory: '/srv/app-data/screenshots/',
    steps: [
      {
        step: 1,
        title: 'Persiapan Direktori Penyimpanan Screenshot VM',
        command: `sudo mkdir -p /srv/app-data/screenshots\nsudo chown -R www-data:www-data /srv/app-data/screenshots\nsudo chmod 750 /srv/app-data/screenshots`,
        note: 'Direktori berada di luar public web root dan dilindungi hak akses permission 750.',
      },
      {
        step: 2,
        title: 'Konfigurasi PostgreSQL Database',
        command: `sudo -u postgres psql -c "CREATE USER activity_user WITH PASSWORD 'strong_password_here';"\nsudo -u postgres psql -c "CREATE DATABASE device_activity_db OWNER activity_user;"\nsudo -u postgres psql -d device_activity_db -c "GRANT ALL PRIVILEGES ON DATABASE device_activity_db TO activity_user;"`,
        note: 'Pastikan user PostgreSQL memiliki hak CREATE TABLE untuk tabel screenshot_metadata.',
      },
      {
        step: 3,
        title: 'Instalasi Node.js 20 & Build Aplikasi',
        command: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt-get install -y nodejs\ncd /opt/device-activity-dashboard\nnpm install\nnpm run build`,
        note: 'File dist/ dan server.ts akan melayani antarmuka web dan REST API.',
      },
      {
        step: 4,
        title: 'Konfigurasi Systemd Service',
        command: `sudo nano /etc/systemd/system/device-dashboard.service`,
        content: `[Unit]
Description=Device Activity Monitor Dashboard
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/device-activity-dashboard
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=PGHOST=127.0.0.1
Environment=PGPORT=5432
Environment=PGUSER=activity_user
Environment=PGPASSWORD=strong_password_here
Environment=PGDATABASE=device_activity_db
Environment=SCREENSHOTS_DIR=/srv/app-data/screenshots/
Environment=AUTH_USERNAME=admin
Environment=AUTH_PASSWORD=admin_secure_password
Environment=AUTH_SECRET=ganti_dengan_random_hash_panjang

[Install]
WantedBy=multi-user.target`,
        subcommand: `sudo systemctl daemon-reload\nsudo systemctl enable device-dashboard\nsudo systemctl start device-dashboard`,
      },
      {
        step: 5,
        title: 'Konfigurasi Nginx Reverse Proxy & SSL',
        command: `sudo nano /etc/nginx/sites-available/device-dashboard`,
        content: `server {
    listen 80;
    server_name dashboard.internal.company.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
# Aktifkan konfigurasi
sudo ln -s /etc/nginx/sites-available/device-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx`,
      },
      {
        step: 6,
        title: 'Mekanisme Backup Berkala & Monitoring Kapasitas Disk',
        command: `sudo nano /usr/local/bin/backup-screenshots.sh`,
        content: `#!/bin/bash
BACKUP_DIR="/var/backups/device-activity"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup screenshot filesystem
tar -czf "$BACKUP_DIR/screenshots_$DATE.tar.gz" -C /srv/app-data/screenshots .

# Backup database metadata
pg_dump -U activity_user -h 127.0.0.1 device_activity_db > "$BACKUP_DIR/db_$DATE.sql"

# Hapus backup yang lebih tua dari 14 hari
find "$BACKUP_DIR" -type f -mtime +14 -delete
`,
        subcommand: `sudo chmod +x /usr/local/bin/backup-screenshots.sh\n# Tambahkan ke crontab (setiap jam 02:00 WIB)\n(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-screenshots.sh") | crontab -`,
      },
    ],
  };

  res.json(guide);
});

export default router;
