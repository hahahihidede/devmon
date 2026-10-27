/**
 * Utility functions for formatting dates in Asia/Jakarta (WIB) timezone
 * and helper formatters.
 */

export function formatToWIB(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB';
  } catch {
    return String(dateInput);
  }
}

export function formatDateOnlyWIB(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

export function formatTimeOnlyWIB(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB';
  } catch {
    return String(dateInput);
  }
}

export function formatRelativeTime(dateInput: string | Date | number): string {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'Baru saja';
    if (diffSec < 60) return `${diffSec} detik lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} hari lalu`;
    return formatDateOnlyWIB(d);
  } catch {
    return '';
  }
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
