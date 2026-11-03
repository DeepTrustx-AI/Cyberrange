# PR E — Container-first Live Kubernetes Security guided UI

This frontend-only patch adds the student workflow, authenticated API client,
assignment-aware navigation and client-side contract tests.

**No cluster, production migration or lab registration is performed.** The new
student page is hidden behind `VITE_LIVE_K8S_UI_ENABLED=true` (unset by default).
The backend remains authoritative and cannot finish a lab without a trusted
remediation executor and a real live probe result.

See `docs/LIVE_K8S_PR_E_README.md` for validation and deployment prerequisites.
