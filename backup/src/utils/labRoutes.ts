// Where the student app opens each lab.
export function labPath(labId: string): string {
  const id = labId.toLowerCase();
  const compact = id.replace(/[\s_-]+/g, '');

  if (id === 'linux-security-workshop') return '/labs/linux-security-workshop';
  if (id === 'race-conditions-lab') return '/labs/race-conditions-lab';
  if (compact === 'linuxsysadminlab') return '/labs/linux-sysadmin';
  if (compact === 'commandlinelab') return '/labs/command-line-lab/session/sess-cll-01';
  if (compact === 'cryptographylab') return '/labs/cryptography-lab/session/sess-crypto-01';
  if (compact === 'complianceportal') return '/labs/compliance-portal/session/sess-compliance-01';
  if (compact.includes('cloud')) return '/labs/cloud-security-lab/session/sess-cloud-01';
  if (id === 'lab1-recon' || id === 'recon-lab') return '/labs/lab1-recon/session/sess-recon-01';
  if (id === 'techcorp-sysadmin-labs' || id.includes('puzzle')) return '/puzzle';
  return `/labs/${labId}/session/sess-123`;
}
