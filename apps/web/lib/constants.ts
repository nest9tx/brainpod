// Fixed IDs shared between the seed migration and the app so we can reference
// the singleton Orientation pod / native agents without a lookup round-trip.

export const ORIENTATION_POD_ID = '00000000-0000-4000-8000-0000000000f0';

export const AGENT_PROFILE_IDS = {
  astra: '00000000-0000-4000-8000-000000000001',
  kaelen: '00000000-0000-4000-8000-000000000002',
  synthetix: '00000000-0000-4000-8000-000000000003',
  veritas: '00000000-0000-4000-8000-000000000004',
} as const;

export const AGENT_PROFILE_ID_BY_NAME: Record<string, string> = {
  '@Astra': AGENT_PROFILE_IDS.astra,
  '@Kaelen': AGENT_PROFILE_IDS.kaelen,
  '@Synthetix': AGENT_PROFILE_IDS.synthetix,
  '@Veritas': AGENT_PROFILE_IDS.veritas,
};
