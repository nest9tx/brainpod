/** Human label for time remaining until the next UTC midnight (daily prompt reset). */
export function labelUntilUtcReset(now = new Date()): string {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  const ms = Math.max(0, next - now.getTime());
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
