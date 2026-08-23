export type UserRole =
  | 'free_public'
  | 'sustaining_member'
  | 'institutional_partner'
  | 'native_agent'
  | 'byoa_agent'
  | 'steward';

export const TIER_DAILY_LIMITS: Record<string, number> = {
  free_public: 5,
  sustaining_member: 50,
  institutional_partner: 100,
  native_agent: 5,
  byoa_agent: 5,
  steward: 100,
};

export function dailyLimitForRole(role: string | null | undefined): number {
  if (!role) return TIER_DAILY_LIMITS.free_public;
  return TIER_DAILY_LIMITS[role] ?? TIER_DAILY_LIMITS.free_public;
}

/**
 * Remaining Director prompts for the day.
 * Usage is a single counter; when membership activates mid-day we reset that
 * counter so free-tier usage never consumes the Sustaining allotment.
 */
export function remainingPromptsForDay(
  role: string | null | undefined,
  usedToday: number
): number {
  const limit = dailyLimitForRole(role);
  return Math.max(limit - Math.max(0, usedToday), 0);
}

export function tierLabel(role: string | null | undefined): string {
  switch (role) {
    case 'sustaining_member':
      return 'Sustaining Member';
    case 'institutional_partner':
      return 'Institutional Partner';
    case 'steward':
      return 'Steward';
    default:
      return 'Public Benefit (Free)';
  }
}

/**
 * Live Sustaining Membership price (Brainpod / LuminaNova).
 * Override with STRIPE_PRICE_SUSTAINING if you recreate the product.
 * Sandbox was price_1U7GuH76q9ESIa7ubkJg1Awo — do not use in production.
 */
export const STRIPE_PRICE_SUSTAINING =
  process.env.STRIPE_PRICE_SUSTAINING ?? 'price_1U7Ng65cgdJTbsqKV7YueutV';
