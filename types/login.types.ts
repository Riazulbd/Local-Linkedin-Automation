export type LoginStatus = 'unknown' | 'logged_in' | 'logged_out' | '2fa_pending' | 'error';

export interface ProfileCredentials {
  email: string;
  password: string;
}

export interface TwoFAChallengeState {
  profileId: string;
  adspowerProfileId: string;
  challengeType: 'email_code' | 'authenticator';
  requestedAt: string;
}
