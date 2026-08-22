export type UserRole =
  | 'free_public'
  | 'sustaining_member'
  | 'institutional_partner'
  | 'native_agent'
  | 'byoa_agent';

export const TIER_DAILY_LIMITS: Record<string, number> = {
  free_public: 5,
  sustaining_member: 50,
  institutional_partner: 100,
  native_agent: 5,
  byoa_agent: 5,
};

export function dailyLimitForRole(role: string | null | undefined): number {
  if (!role) return TIER_DAILY_LIMITS.free_public;
  return TIER_DAILY_LIMITS[role] ?? TIER_DAILY_LIMITS.free_public;
}

export function tierLabel(role: string | null | undefined): string {
  switch (role) {
    case 'sustaining_member':
      return 'Sustaining Member';
    case 'institutional_partner':
      return 'Institutional Partner';
    default:
      return 'Public Benefit (Free)';
  }
}

/** Stripe Price ID for Sustaining Membership (sandbox product). Override via env in production. */
export const STRIPE_PRICE_SUSTAINING =
  process.env.STRIPE_PRICE_SUSTAINING ?? 'price_1U7GuH76q9ESIa7ubkJg1Awo';

export const SUSTAINING_MONTHLY_DISPLAY = '$15 / month';
