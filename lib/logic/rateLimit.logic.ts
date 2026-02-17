import type { LinkedInProfile } from '@/types';
import type { AppLimits } from '@/lib/config/limits';

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  action: string;
}

export function checkVisitLimit(profile: LinkedInProfile, limits: AppLimits): LimitCheckResult {
  return { allowed: profile.daily_visit_count < limits.dailyVisitLimit, current: profile.daily_visit_count, limit: limits.dailyVisitLimit, action: 'visit' };
}

export function checkConnectLimit(profile: LinkedInProfile, limits: AppLimits): LimitCheckResult {
  return { allowed: profile.daily_connect_count < limits.dailyConnectLimit, current: profile.daily_connect_count, limit: limits.dailyConnectLimit, action: 'connect' };
}

export function checkMessageLimit(profile: LinkedInProfile, limits: AppLimits): LimitCheckResult {
  return { allowed: profile.daily_message_count < limits.dailyMessageLimit, current: profile.daily_message_count, limit: limits.dailyMessageLimit, action: 'message' };
}

export function checkFollowLimit(profile: LinkedInProfile, limits: AppLimits): LimitCheckResult {
  return { allowed: profile.daily_follow_count < limits.dailyFollowLimit, current: profile.daily_follow_count, limit: limits.dailyFollowLimit, action: 'follow' };
}

export function needsDailyReset(profile: LinkedInProfile, todayBD: string): boolean {
  return profile.last_reset_date !== todayBD;
}
