import React, { useState } from 'react';
import { Terminal, Copy, Check, X, ShieldAlert, HardDrive, Database, Server, Clock } from 'lucide-react';

interface DeploymentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Buat Direktori Penyimpanan Screenshot di Luar Public Web Root',
      desc: 'Screenshot disimpan langsung sebagai file JPG/PNG pada VM filesystem (bukan Base64 di database). Direktori dilindungi permission 750.',
      icon: HardDrive,
      code: `sudo mkdir -p /srv/app-data/screenshots/
sudo chown -R www-data:www-data /srv/app-data/screenshots/
sudo chmod 750 /srv/app-data/screenshots/`,
    },
    {
      title: '2. Siapkan Database PostgreSQL & Izin Akses',
      desc: 'Buat user dan database terpisah. Aplikasi membutuhkan izin CREATE TABLE untuk tabel terpisah screenshot_metadata.',
      icon: Database,
      code: `sudo -u postgres psql -c "CREATE USER activity_user WITH PASSWORD 'ganti_dengan_password_kuat';"\n` +
            `sudo -u postgres psql -c "CREATE DATABASE device_activity_db OWNER activity_user;"\n` +
            `sudo -u postgres psql -d device_activity_db -c "GRANT ALL PRIVILEGES ON DATABASE device_activity_db TO activity_user;"`,
    },
    {
      title: '3. Clone Repository & Build Aplikasi di Ubuntu VM',
      desc: 'Pastikan Node.js 20 LTS terinstal di VM Anda.',
      icon: Server,
      code: `cd /opt
sudo git clone <URL_REPO_ANDA> /opt/device-activity-dashboard
cd /opt/device-activity-dashboard
sudo chown -R www-data:www-data /opt/device-activity-dashboard
npm install
npm run build`,
    },
    {
      title: '4. Pasang Systemd Service (device-dashboard.service)',
      desc: 'Menjalankan backend REST API dan web dashboard sebagai service latar belakang otomatis dengan environment variables aman.',
      icon: Terminal,
      code: `sudo tee /etc/systemd/system/device-dashboard.service > /dev/null << 'EOF'
[Unit]
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
Environment=PGPASSWORD=ganti_dengan_password_kuat
Environment=PGDATABASE=device_activity_db
Environment=SCREENSHOTS_DIR=/srv/app-data/screenshots/
Environment=AUTH_USERNAME=admin
Environment=AUTH_PASSWORD=admin_secure_password
Environment=AUTH_SECRET=rahasia_jwt_token_acak_yang_sangat_panjang_dan_aman_2026

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable device-dashboard
sudo systemctl start device-dashboard`,
    },
    {
      title: '5. Pasang Nginx Reverse Proxy dengan Batasan Ukuran Upload',
      desc: 'Konfigurasi client_max_body_size untuk mendukung upload screenshot hingga 25MB serta proxy header.',
      icon: Server,
      code: `sudo tee /etc/nginx/sites-available/device-dashboard > /dev/null << 'EOF'
server {
    listen 80;
    server_name dashboard.example.internal;

    # Batas ukuran payload upload screenshot
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
EOF

sudo ln -s /etc/nginx/sites-available/device-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx`,
    },
    {
      title: '6. Script Backup Otomatis & Penanganan Kapasitas Disk',
      desc: 'Melakukan rotasi backup direktori screenshot dan dump database PostgreSQL ke arsip lokal harian.',
      icon: Clock,
      code: `sudo tee /usr/local/bin/backup-device-activity.sh > /dev/null << 'EOF'
#!/bin/bash
set -e
BACKUP_DIR="/var/backups/device-activity"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)

# 1. Backup file screenshot dari VM filesystem
tar -czf "$BACKUP_DIR/screenshots_$DATE.tar.gz" -C /srv/app-data/screenshots .

# 2. Backup database metadata
PGPASSWORD="ganti_dengan_password_kuat" pg_dump -U activity_user -h 127.0.0.1 device_activity_db > "$BACKUP_DIR/db_$DATE.sql"

# 3. Rotasi: hapus backup lebih lama dari 14 hari
find "$BACKUP_DIR" -type f -mtime +14 -delete
EOF

sudo chmod +x /usr/local/bin/backup-device-activity.sh
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-device-activity.sh") | sudo crontab -`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-100 text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Panduan Lengkap Deployment Ubuntu VM
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Target: Ubuntu 22.04 LTS / 24.04 LTS &bull; Node.js 20 &bull; PostgreSQL 14+
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Important Security Notice */}
          <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="block text-amber-300 font-medium mb-0.5">
                Ketentuan Keamanan &amp; Kepatuhan:
              </strong>
              Monitoring wajib dilakukan secara transparan dengan persetujuan pengguna. Folder <code className="text-amber-200 font-mono">/srv/app-data/screenshots/</code> tidak boleh diletakkan di dalam folder public web root atau dapat diakses langsung tanpa autentikasi backend.
            </div>
          </div>

          {/* Steps */}
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCopied = copiedIndex === idx;
            return (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-200 text-xs">
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span>{s.title}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(s.code, idx)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                    title="Salin perintah ke clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">{s.desc}</p>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] text-sky-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {s.code}
                </pre>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium cursor-pointer"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
