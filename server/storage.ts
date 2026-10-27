import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Preferred production path on Ubuntu VM, or fallback to relative ./data/screenshots
export const PREFERRED_DIR = process.env.SCREENSHOTS_DIR || '/srv/app-data/screenshots/';
export const FALLBACK_DIR = path.resolve(process.cwd(), 'data', 'screenshots');

let activeStorageDir = PREFERRED_DIR;

// Determine and initialize safe storage directory
export function initStorage(): { path: string; isPreferred: boolean; isWritable: boolean; error?: string } {
  // First test if PREFERRED_DIR is usable and writable
  try {
    if (!fs.existsSync(PREFERRED_DIR)) {
      fs.mkdirSync(PREFERRED_DIR, { recursive: true, mode: 0o775 });
    }
    // Test write permission on PREFERRED_DIR
    const testFile = path.join(PREFERRED_DIR, `.test_write_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    activeStorageDir = PREFERRED_DIR;
    return {
      path: activeStorageDir,
      isPreferred: true,
      isWritable: true,
    };
  } catch (err: any) {
    console.warn(`[Storage] Preferred directory ${PREFERRED_DIR} is not writable (${err.message}). Falling back to: ${FALLBACK_DIR}`);
    
    // Fallback to FALLBACK_DIR inside application directory
    try {
      if (!fs.existsSync(FALLBACK_DIR)) {
        fs.mkdirSync(FALLBACK_DIR, { recursive: true, mode: 0o775 });
      }
      const testFile = path.join(FALLBACK_DIR, `.test_write_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      activeStorageDir = FALLBACK_DIR;
      return {
        path: activeStorageDir,
        isPreferred: false,
        isWritable: true,
        error: `Preferred dir ${PREFERRED_DIR} not writable: ${err.message}. Menggunakan fallback lokal.`,
      };
    } catch (fallbackErr: any) {
      console.error(`[Storage] Fallback directory also failed:`, fallbackErr);
      return {
        path: activeStorageDir,
        isPreferred: false,
        isWritable: false,
        error: fallbackErr.message,
      };
    }
  }
}

export function getStorageDir(): string {
  // Re-verify if preferred directory became writable (e.g. after user ran chown/chmod)
  if (activeStorageDir !== PREFERRED_DIR) {
    try {
      if (fs.existsSync(PREFERRED_DIR)) {
        const testFile = path.join(PREFERRED_DIR, `.perm_check_${Date.now()}`);
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        activeStorageDir = PREFERRED_DIR;
        console.log(`[Storage] Detected write permission on ${PREFERRED_DIR}! Restored as active storage.`);
      }
    } catch {
      // Still not writable, keep fallback
    }
  }
  return activeStorageDir;
}

// Generate unique, non-guessable filename
export function generateUniqueFilename(originalName: string, mimeType: string): string {
  const ext = mimeType === 'image/png' || originalName.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `screen_${timestamp}_${randomSuffix}${ext}`;
}

// Prevent path traversal and safely locate screenshot file
export function getSafeFilePath(filename: string): string | null {
  // Sanitize and extract just the base filename
  const baseFilename = path.basename(filename.replace(/\\/g, '/')).trim();
  if (!baseFilename || baseFilename.includes('..') || baseFilename.includes('\0')) {
    return null;
  }

  // Candidate locations
  const candidates = [
    path.resolve(activeStorageDir, baseFilename),
    path.resolve(activeStorageDir, 'screenshots', baseFilename),
    path.resolve(process.cwd(), 'screenshots', baseFilename),
    path.resolve(process.cwd(), 'data', 'screenshots', baseFilename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Return primary resolved path inside activeStorageDir
  return path.resolve(activeStorageDir, baseFilename);
}

// Validate image file header / mime
export function validateImageBuffer(buffer: Buffer): { valid: boolean; mimeType: string; error?: string } {
  if (buffer.length < 8) {
    return { valid: false, mimeType: '', error: 'Ukuran file terlalu kecil atau file kosong.' };
  }

  // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png' };
  }

  // Check JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  return {
    valid: false,
    mimeType: '',
    error: 'Format file tidak didukung. Hanya file JPG/JPEG dan PNG yang diizinkan.',
  };
}

// Inspect storage metrics (file count, total size)
export function getStorageStats() {
  try {
    if (!fs.existsSync(activeStorageDir)) {
      return { fileCount: 0, totalBytes: 0, path: activeStorageDir, writable: false };
    }

    const files = fs.readdirSync(activeStorageDir);
    let totalBytes = 0;
    let fileCount = 0;

    for (const file of files) {
      if (file.startsWith('.')) continue;
      try {
        const stats = fs.statSync(path.join(activeStorageDir, file));
        if (stats.isFile()) {
          fileCount++;
          totalBytes += stats.size;
        }
      } catch {
        // Skip inaccessible files
      }
    }

    return {
      fileCount,
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      path: activeStorageDir,
      isPreferred: activeStorageDir === PREFERRED_DIR,
      writable: true,
    };
  } catch (err: any) {
    return {
      fileCount: 0,
      totalBytes: 0,
      totalMB: '0',
      path: activeStorageDir,
      isPreferred: false,
      writable: false,
      error: err.message,
    };
  }
}

// Safely delete a screenshot file from the VM disk
export function deleteScreenshotFile(filename: string): {
  success: boolean;
  deleted: boolean;
  filePath?: string;
  error?: string;
} {
  try {
    if (!filename) {
      return { success: false, deleted: false, error: 'Nama file tidak boleh kosong.' };
    }

    const safePath = getSafeFilePath(filename);
    if (!safePath) {
      return { success: false, deleted: false, error: 'Nama file tidak valid atau berpotensi path traversal.' };
    }

    // Verify file actually exists before unlinking
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
      console.log(`[Storage] Berhasil menghapus file screenshot fisik: ${safePath}`);
      return { success: true, deleted: true, filePath: safePath };
    }

    // Also check fallback location if different
    const fallbackPath = path.resolve(FALLBACK_DIR, path.basename(filename));
    if (fallbackPath !== safePath && fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath);
      console.log(`[Storage] Berhasil menghapus file fallback: ${fallbackPath}`);
      return { success: true, deleted: true, filePath: fallbackPath };
    }

    return {
      success: true,
      deleted: false,
      filePath: safePath,
      error: 'File fisik tidak ditemukan pada disk (mungkin sudah dihapus sebelumnya).',
    };
  } catch (err: any) {
    console.error(`[Storage] Gagal menghapus file ${filename}:`, err);
    return {
      success: false,
      deleted: false,
      error: `Gagal menghapus file dari disk: ${err.message}`,
    };
  }
}

// List all physical image files in active storage dir and fallback dir
export function listDiskScreenshotFiles(): Array<{
  filename: string;
  fullPath: string;
  size: number;
  mtime: Date;
  mimeType: string;
}> {
  const dirs = [getStorageDir()];
  if (FALLBACK_DIR !== getStorageDir() && fs.existsSync(FALLBACK_DIR)) {
    dirs.push(FALLBACK_DIR);
  }

  const seen = new Set<string>();
  const results: Array<{
    filename: string;
    fullPath: string;
    size: number;
    mtime: Date;
    mimeType: string;
  }> = [];

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const ext = path.extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
        if (seen.has(file)) continue;

        try {
          const fullPath = path.join(dir, file);
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            seen.add(file);
            results.push({
              filename: file,
              fullPath,
              size: stats.size,
              mtime: stats.mtime,
              mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
            });
          }
        } catch {
          // ignore unreadable file
        }
      }
    } catch (err) {
      console.warn(`[Storage] Gagal membaca direktori ${dir}:`, err);
    }
  }

  return results;
}
