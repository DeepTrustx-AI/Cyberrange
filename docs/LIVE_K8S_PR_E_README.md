# PR E — Guided student UI for Live Kubernetes Security Assessment

## Scope

Public repository (`DeepTrustx-AI/Cyberrange`), targeting frontend at `backup/`.
Builds on the **private backend PR D** API contract. Adds a new authenticated
page, a typed API client, predictable workflow helpers, an assignment-ID-aware
launch link, and dependency-light contract tests. Existing labs remain unchanged.

**This is not a release of the live lab.** Client-side `VITE_LIVE_K8S_UI_ENABLED`
defaults to disabled. Backend `LIVE_K8S_STUDENT_API_ENABLED` also defaults to
false, and backend Patch D still lacks a trusted remediation executor.

## New route and assignment context

`/labs/live-kubernetes-security-lab?assignment_id=<active-assignment-id>`

The Assignments page adds the assignment ID **only for this lab**; existing
lab links remain unchanged. Do not pass arbitrary `sessionId` through generic
lab-launch routes: the new page keeps an opaque session ID in per-tab
`sessionStorage`, keyed by authenticated student ID and assignment ID. The
backend reauthorizes ownership and assignment on every request. A browser
refresh can resume a session on the same tab, but new tabs cannot recover
an existing session without a future server-side list/resume endpoint.

## UX contract

1. Briefing and namespace launch; pending sessions show a readiness state.
2. Investigate (200 preview points): six fixed questions, live read-only
   observations, per-question server feedback.
3. Assess (100 preview points): four impact/scope questions.
4. Remediate (150 preview points): six fixed action IDs; each calls the
   trusted backend endpoint and refreshes live evidence. Enforcing Restricted
   requires workload hardening first.
5. Verify (50 preview points): only enabled after all six actions are recorded;
   calls `/verify`, which must prove fresh hardened cluster isolation.

The UI displays `score_preview` as **validated progress, not awarded points**.
Only the backend verification response can state `points_awarded`. The client
never sends scores, kubeconfig, namespace, pod names, target addresses,
manifest YAML, commands, or claimed probe results.

### Server endpoints used

- `GET /api/v1/live-k8s/catalog?assignment_id=N`
- `POST /api/v1/live-k8s/sessions` `{assignment_id}`
- `GET /api/v1/live-k8s/sessions/{id}?assignment_id=N`
- `GET /api/v1/live-k8s/sessions/{id}/evidence?assignment_id=N`
- `POST /api/v1/live-k8s/sessions/{id}/investigate` with
  `{assignment_id,expected_revision,answers}`
- `POST /api/v1/live-k8s/sessions/{id}/assess` with the same shape
- `POST /api/v1/live-k8s/sessions/{id}/actions/{fixed_action_id}` with
  `{assignment_id,expected_revision}`
- `POST /api/v1/live-k8s/sessions/{id}/verify` with the same shape
- `DELETE /api/v1/live-k8s/sessions/{id}?assignment_id=N`

Errors (notably 409 stale revisions and 503 unavailable runtime) display
plain-language recovery guidance. A 409 triggers a read-only refresh but no
automatic retry of a potentially mutating request.

## Validate locally

```bash
cd backup
npm ci
node scripts/test-live-k8s-ui.mjs
npm run check:api-routing
npm run build
```

`npm run build` includes TypeScript compilation and the production Vite build.
The route is lazy-loaded, keeping the new lab out of existing initial chunks.
The repo should not set `VITE_LIVE_K8S_UI_ENABLED=true` in production until all
release prerequisites are met.

## Release blockers

1. PR C and PR D merged and private API version deployed in an approved release.
2. Manual session and grading migrations reviewed/applied in a controlled window.
3. Approved pooled teaching cluster with strict admission, CNI isolation,
   resource quotas, safe images and live canary/traffic verification.
4. Production trusted remediation executor, lease/controller injection, and
   independent cleanup sweeper implemented and exercised; fake clients prohibited.
5. Catalog registered only once the live runtime passes full operator testing.
6. End-to-end assigned-student test proves reload, failed answers, action failures,
   session timeout, collision handling and exactly-once 500-point completion.

Setting the UI feature flag alone must never enable a lab in production.
