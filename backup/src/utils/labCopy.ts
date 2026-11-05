// One-line summaries for the catalogue, written from each lab's real module list.
// The API still returns placeholder text ("Hands-on X Lab challenge.") for most
// labs; these stand in until the backend carries proper descriptions.
const SUMMARIES: Record<string, string> = {
  'command-line-lab': 'Start with Linux navigation and files, then write real programs in Python, C and C++.',
  'lab1-recon': 'Find every port and service on a live network, uncover hidden services and credentials, then get in.',
  'cloud-security-lab': 'Work through a misconfigured AWS estate: open S3 data, leaked keys, Lambda, IAM and Secrets Manager.',
  'linux-sysadmin-lab': 'Build pipelines, scripts, backups and shared directories on a real Linux server, checked by an autograder.',
  'linux-security-workshop': 'Provision users, repair services and investigate a compromised Linux box, then contain and recover it.',
  'ot-security-lab': 'Map an industrial network, change PLC registers, read Modbus and S7 traffic, then respond to the incident.',
  'ot-railroad-north': "Probe a railway's PLCs over Modbus, tamper with signals and switches, then trace it in the logs.",
  'ot-water-treatment': "Scan a water plant's Modbus coils, check the chemical dosing setpoints and defend the PLCs.",
  'puzzle-lab': 'Twenty levels of permissions, setuid, sudoers, user and systemd puzzles on a live system.',
};

const PLACEHOLDER = /^hands-on .* challenge\.?$|scratch seed/i;

export function labSummary(labId: string, description: string) {
  const own = description.trim();
  if (own && !PLACEHOLDER.test(own)) return own;
  return SUMMARIES[labId] ?? own;
}

// Minutes a student needs for each module on a first pass, reading the brief and
// a retry or two included. The API sends 45 for every module and 1.5 h for every
// lab; these stand in until the lab files carry their own estimates.
const MODULE_MINUTES: Record<string, Record<string, number>> = {
  'cloud-security-lab': {
    'cloud-security-lab_cloud_mod1': 30,
    'cloud-security-lab_cloud_mod2': 45,
    'cloud-security-lab_cloud_mod3': 40,
    'cloud-security-lab_cloud_mod4': 60,
    'cloud-security-lab_cloud_mod5': 45,
  },
  'cloudcorp-aws-lab': {
    'cloudcorp-aws-lab_cloud_cloud_mod1': 40,
    'cloudcorp-aws-lab_cloud_cloud_mod2': 50,
    'cloudcorp-aws-lab_cloud_cloud_mod3': 60,
    'cloudcorp-aws-lab_cloud_cloud_mod4': 60,
    'cloudcorp-aws-lab_cloud_cloud_mod5': 50,
    'cloudcorp-aws-lab_cloud_cloud_mod6': 75,
  },
  'command-line-lab': {
    'command-line-lab_linux_module1': 20,
    'command-line-lab_linux_module2': 20,
    'command-line-lab_linux_module3': 25,
    'command-line-lab_linux_module4': 30,
    'command-line-lab_linux_module5': 30,
    'command-line-lab_python_module1': 20,
    'command-line-lab_python_module2': 25,
    'command-line-lab_python_module3': 30,
    'command-line-lab_python_module4': 30,
    'command-line-lab_python_module5': 30,
    'command-line-lab_java_module1': 25,
    'command-line-lab_java_module2': 30,
    'command-line-lab_java_module3': 35,
    'command-line-lab_java_module4': 35,
    'command-line-lab_java_module5': 35,
    'command-line-lab_c_module1': 20,
    'command-line-lab_c_module2': 25,
    'command-line-lab_c_module3': 30,
    'command-line-lab_c_module4': 30,
    'command-line-lab_c_module5': 45,
  },
  'compliance-portal': {
    'compliance-portal_compliance_module1': 40,
    'compliance-portal_compliance_module2': 45,
    'compliance-portal_compliance_module3': 50,
    'compliance-portal_compliance_module4': 50,
    'compliance-portal_compliance_module5': 70,
  },
  'cryptography-lab': {
    'cryptography-lab_crypto_module1': 30,
    'cryptography-lab_crypto_module2': 25,
    'cryptography-lab_crypto_module3': 30,
    'cryptography-lab_crypto_module4': 40,
    'cryptography-lab_crypto_module5': 35,
    'cryptography-lab_crypto_module6': 35,
    'cryptography-lab_crypto_module7': 50,
  },
  'lab1-recon': {
    'lab1-recon_module1': 30,
    'lab1-recon_module2': 30,
    'lab1-recon_module3': 40,
    'lab1-recon_module4': 45,
    'lab1-recon_module5': 60,
  },
  'linux-security-workshop': {
    'WS-CORE-001': 25,
    'WS-CORE-002': 30,
    'WS-CORE-003': 30,
    'WS-CORE-004': 30,
    'WS-CORE-005': 30,
    'WS-ADV-001': 50,
    'WS-CORE-006': 35,
    'WS-CORE-007': 40,
    'WS-CORE-008': 30,
    'WS-CORE-009': 40,
    'WS-ADV-002': 55,
    'WS-ADV-003': 70,
  },
  'linux-sysadmin-lab': {
    'TUPE-C03-001': 20,
    'TUPE-C03-002': 20,
    'TUPE-C03-003': 20,
    'TUPE-C03-004': 20,
    'TUPE-C03-005': 20,
    'TUPE-C03-006': 20,
    'TUPE-C03-007': 25,
    'TUPE-C03-008': 20,
    'TUPE-C03-009': 20,
    'TUPE-C03-010': 25,
    'TUPE-C03-011': 35,
    'RHSA-SHELL-001': 25,
    'RHSA-FILE-001': 30,
    'RHSA-USERS-001': 30,
    'RHSA-TEXT-001': 30,
    'RHSA-BACKUP-001': 30,
    'RHSA-RACE-001': 40,
    'RHSA-SUDO-001': 35,
    'RHSA-PROC-001': 30,
    'RHSA-PKG-001': 35,
    'RHSA-SSH-001': 40,
    'RHSA-SCHED-001': 40,
  },
  'ot-security-lab': {
    'ot-security-lab_module1': 40,
    'ot-security-lab_module2': 50,
    'ot-security-lab_module3': 45,
    'ot-security-lab_module4': 50,
    'ot-security-lab_module5': 70,
  },
  'ot-railroad-north': {
    'ot-railroad-north_module1': 40,
    'ot-railroad-north_module2': 50,
    'ot-railroad-north_module3': 45,
    'ot-railroad-north_module4': 50,
    'ot-railroad-north_module5': 75,
  },
  'ot-water-treatment': {
    'ot-water-treatment_module1': 35,
    'ot-water-treatment_module2': 40,
    'ot-water-treatment_module3': 45,
    'ot-water-treatment_module4': 50,
    'ot-water-treatment_module5': 70,
  },
  'puzzle-lab': {
    'puzzle-lab_module1': 15,
    'puzzle-lab_module2': 15,
    'puzzle-lab_module3': 20,
    'puzzle-lab_module4': 20,
    'puzzle-lab_module5': 20,
    'puzzle-lab_module6': 15,
    'puzzle-lab_module7': 25,
    'puzzle-lab_module8': 20,
    'puzzle-lab_module9': 20,
    'puzzle-lab_module10': 20,
    'puzzle-lab_module11': 20,
    'puzzle-lab_module12': 20,
    'puzzle-lab_module13': 20,
    'puzzle-lab_module14': 30,
    'puzzle-lab_module15': 15,
    'puzzle-lab_module16': 20,
    'puzzle-lab_module17': 25,
    'puzzle-lab_module18': 20,
    'puzzle-lab_module19': 20,
    'puzzle-lab_module20': 25,
    'puzzle-lab_module21': 30,
    'puzzle-lab_module22': 20,
    'puzzle-lab_module23': 20,
    'puzzle-lab_module24': 25,
    'puzzle-lab_module25': 25,
    'puzzle-lab_module26': 25,
    'puzzle-lab_module27': 30,
    'puzzle-lab_module28': 35,
    'puzzle-lab_module29': 25,
    'puzzle-lab_module30': 25,
    'puzzle-lab_module31': 35,
    'puzzle-lab_module32': 20,
    'puzzle-lab_module33': 25,
    'puzzle-lab_module34': 45,
  },
  'race-conditions-lab': {
    'RACE-DESK-001': 35,
    'RACE-DESK-002': 30,
    'RACE-DESK-003': 30,
    'RACE-DESK-004': 40,
    'RACE-DESK-005': 45,
    'RACE-DESK-006': 50,
    'RACE-DESK-007': 55,
    'RACE-DESK-008': 40,
    'RACE-DESK-009': 45,
    'RACE-DESK-010': 55,
    'RACE-DESK-011': 55,
    'RACE-DESK-012': 50,
    'RACE-DESK-013': 70,
    'RACE-DESK-014': 70,
    'RACE-DESK-015': 90,
  },
};

// Difficulty the catalogue shows where the API's value is out of date.
const DIFFICULTY: Record<string, string> = {
  'race-conditions-lab': 'advanced',
};

export function moduleMinutes(labId: string, moduleId: string, fallback: number) {
  return MODULE_MINUTES[labId]?.[moduleId] ?? fallback;
}

// Whole lab, to the nearest half hour.
export function labHours(labId: string, fallback: number) {
  const known = MODULE_MINUTES[labId];
  if (!known) return fallback;
  const total = Object.values(known).reduce((sum, minutes) => sum + minutes, 0);
  return Math.round(total / 30) / 2;
}

export function labDifficulty(labId: string, difficulty: string) {
  return DIFFICULTY[labId] ?? difficulty;
}
