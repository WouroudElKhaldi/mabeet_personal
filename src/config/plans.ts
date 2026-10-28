// Host plans. Prices are shown on /pricing; Stripe charges whatever its price objects say
// (STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS), so keep the two in step. null means unlimited.

export const PLANS = ["FREE", "PRO", "BUSINESS"] as const;
export type PlanName = (typeof PLANS)[number];

/** The plans a host can pay for. */
export const PAID_PLANS = ["PRO", "BUSINESS"] as const satisfies readonly PlanName[];
export type PaidPlan = (typeof PAID_PLANS)[number];

export interface PlanLimits {
  monthlyUsd: number;
  rooms: number | null;
  offerings: number | null;
  members: number | null;
  /** The team AI assistant and the host MCP server. */
  ai: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: { monthlyUsd: 0, rooms: 3, offerings: 1, members: 2, ai: false },
  PRO: { monthlyUsd: 10, rooms: 15, offerings: null, members: 10, ai: true },
  BUSINESS: { monthlyUsd: 20, rooms: null, offerings: null, members: null, ai: true },
};
