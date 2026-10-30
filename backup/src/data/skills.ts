// What each lab teaches, and the NICE Workforce Framework work roles it builds
// towards (NIST SP 800-181r1 role names). The mapping is CyberRange's own
// judgment and should be reviewed with the lab authors.

export interface LabSkills {
  roles: string[];
  skills: string[];
}

export const LAB_SKILLS: Record<string, LabSkills> = {
  'command-line-lab': {
    roles: ['Systems Administration'],
    skills: ['Linux shell', 'Text processing', 'Python scripting', 'Java basics', 'C programs and binaries'],
  },
  'linux-sysadmin-lab': {
    roles: ['Systems Administration', 'Systems Security Analysis'],
    skills: ['Shell scripting', 'Users and groups', 'File permissions', 'Scheduled jobs', 'Packages', 'SSH keys'],
  },
  'linux-security-workshop': {
    roles: ['Systems Security Analysis', 'Incident Response', 'Defensive Cybersecurity'],
    skills: ['Service troubleshooting', 'Privileged access', 'Log analysis', 'Persistence hunting', 'Containment and recovery'],
  },
  'race-conditions-lab': {
    roles: ['Secure Software Development', 'Software Security Assessment', 'Vulnerability Analysis'],
    skills: ['Check-then-use (TOCTOU) races', 'Symlinks and hard links', 'Interleaving schedules', 'Safe file handling', 'Testing fixes under attack'],
  },
  'puzzle-lab': {
    roles: ['Systems Administration', 'Systems Security Analysis'],
    skills: ['setuid and special permissions', 'sudoers', 'systemd services', 'Firewall rules', 'Disks and LVM'],
  },
  'lab1-recon': {
    roles: ['Vulnerability Analysis', 'Network Operations'],
    skills: ['Port scanning', 'Service fingerprinting', 'Hidden services', 'Credential discovery'],
  },
  'cloud-security-lab': {
    roles: ['Vulnerability Analysis', 'Defensive Cybersecurity'],
    skills: ['S3 exposure', 'Leaked keys', 'Lambda configuration', 'IAM privilege escalation', 'Secrets Manager'],
  },
  'cloudcorp-aws-lab': {
    roles: ['Defensive Cybersecurity', 'Systems Security Analysis'],
    skills: ['S3 hardening', 'IAM policy audit', 'IMDSv2 and SSRF', 'Key revocation', 'Account guardrails'],
  },
  'cryptography-lab': {
    roles: ['Secure Software Development', 'Systems Security Analysis'],
    skills: ['Symmetric encryption', 'Hashing and integrity', 'Password hashing', 'RSA and signatures', 'Key exchange'],
  },
  'compliance-portal': {
    roles: ['Privacy Compliance'],
    skills: ['Consent lifecycle', 'PII discovery', 'Anonymisation', 'DPDP audit'],
  },
  'ot-security-lab': {
    roles: ['Operational Technology (OT) Cybersecurity Engineering', 'Incident Response'],
    skills: ['Modbus and S7comm', 'PLC registers', 'PCAP analysis', 'HMI incident response'],
  },
  'ot-water-treatment': {
    roles: ['Operational Technology (OT) Cybersecurity Engineering', 'Defensive Cybersecurity'],
    skills: ['Modbus coils', 'Dosing setpoints', 'SCADA alarms', 'PLC defence'],
  },
  'ot-railroad-north': {
    roles: ['Operational Technology (OT) Cybersecurity Engineering', 'Incident Response'],
    skills: ['Railway PLCs', 'Signal and switch control', 'Telemetry forensics', 'Control-plane traffic'],
  },
};

export interface LabProgress {
  id: string;
  solved: number;
  total: number;
  completed: boolean;
}

export interface RoleCoverage {
  role: string;
  cleared: number;
  total: number;
  percent: number;
  labs: string[];
}

const clearedOf = (lab: LabProgress) => Math.min(lab.total, lab.completed ? lab.total : Math.max(0, lab.solved));

export function roleCoverage(labs: LabProgress[]): RoleCoverage[] {
  const byRole = new Map<string, RoleCoverage>();
  for (const lab of labs) {
    const mapped = LAB_SKILLS[lab.id];
    if (!mapped || lab.total <= 0) continue;
    for (const role of mapped.roles) {
      const entry = byRole.get(role) ?? { role, cleared: 0, total: 0, percent: 0, labs: [] };
      entry.cleared += clearedOf(lab);
      entry.total += lab.total;
      entry.labs.push(lab.id);
      byRole.set(role, entry);
    }
  }
  const roles = [...byRole.values()].map((entry) => ({ ...entry, percent: Math.round((entry.cleared / entry.total) * 100) }));
  return roles.sort((a, b) => Number(b.cleared > 0) - Number(a.cleared > 0) || b.percent - a.percent || a.role.localeCompare(b.role));
}

export function earnedSkills(labs: LabProgress[]): string[] {
  return labs.filter((lab) => clearedOf(lab) > 0).flatMap((lab) => LAB_SKILLS[lab.id]?.skills ?? []);
}
