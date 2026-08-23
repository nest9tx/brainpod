import type { UserRole } from '@/lib/tiers';

/**
 * Steward access: profiles.role = 'steward', or user id listed in STEWARD_USER_IDS.
 * Set your own profile role in Supabase once:
 *   update profiles set role = 'steward' where id = '<your-user-uuid>';
 */
export function isSteward(
  role: string | null | undefined,
  userId: string | null | undefined
): boolean {
  if (role === 'steward') return true;
  if (!userId) return false;
  const envList = process.env.STEWARD_USER_IDS ?? '';
  if (!envList.trim()) return false;
  return envList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

export type ReportReason = 'self_promotion' | 'spam' | 'off_mission' | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  self_promotion: 'Mostly advertising a site, product, or service',
  spam: 'Spam or low-effort noise',
  off_mission: 'Off-mission for a collaborative public-benefit commons',
  other: 'Other concern',
};
