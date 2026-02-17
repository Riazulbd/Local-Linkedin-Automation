import { BANGLADESH_TIMEZONE } from '@/lib/config/constants';

export interface WorkingHoursConfig {
  enabled: boolean;
  startHour: number;
  endHour: number;
  skipWeekends: boolean;
}

export function isWithinWorkingHours(config: WorkingHoursConfig): boolean {
  if (!config.enabled) return true;

  const now = new Date();
  const bdTime = new Date(now.toLocaleString('en-US', { timeZone: BANGLADESH_TIMEZONE }));
  const day = bdTime.getDay();
  const hour = bdTime.getHours();
  const minute = bdTime.getMinutes();
  const currentMinutes = hour * 60 + minute;

  if (config.skipWeekends && (day === 0 || day === 6)) return false;

  const startMinutes = config.startHour * 60;
  const endMinutes = config.endHour * 60;
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function getBangladeshDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BANGLADESH_TIMEZONE });
}

export function getBangladeshHour(): number {
  return parseInt(
    new Date().toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: BANGLADESH_TIMEZONE })
  );
}
