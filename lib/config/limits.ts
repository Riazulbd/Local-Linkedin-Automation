export interface AppLimits {
  dailyVisitLimit: number;
  dailyConnectLimit: number;
  dailyMessageLimit: number;
  dailyFollowLimit: number;
  minActionDelaySec: number;
  maxActionDelaySec: number;
  minLeadDelaySec: number;
  maxLeadDelaySec: number;
}

export const DEFAULT_LIMITS: AppLimits = {
  dailyVisitLimit: 80,
  dailyConnectLimit: 20,
  dailyMessageLimit: 15,
  dailyFollowLimit: 30,
  minActionDelaySec: 3,
  maxActionDelaySec: 12,
  minLeadDelaySec: 10,
  maxLeadDelaySec: 30,
};
