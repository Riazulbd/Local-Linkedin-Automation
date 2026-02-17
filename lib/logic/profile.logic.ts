import type { LinkedInProfile } from '@/types';

export function getProfileDisplayName(profile: LinkedInProfile): string {
  return profile.name || profile.linkedin_email || profile.adspower_profile_id;
}

export function isProfileBusy(profile: LinkedInProfile): boolean {
  return profile.status === 'running';
}

export function getProfileTotalDailyActions(profile: LinkedInProfile): number {
  return (
    profile.daily_visit_count +
    profile.daily_connect_count +
    profile.daily_message_count +
    profile.daily_follow_count
  );
}
