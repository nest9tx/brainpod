/**
 * Steward access is independent of membership tier.
 * Prefer profiles.is_steward = true (keeps sustaining_member / free_public intact).
 * Fallback: STEWARD_USER_IDS env (comma-separated profile UUIDs).
 */
export function isSteward(
  isStewardFlag: boolean | null | undefined,
  userId: string | null | undefined
): boolean {
  if (isStewardFlag === true) return true;
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
