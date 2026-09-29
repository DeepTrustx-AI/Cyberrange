# Public deployment workflow

This repository uses a deliberately gated release path:

`change -> pull request -> CI -> exact release candidate -> staging -> smoke/security checks -> explicit production promotion`

An ordinary push never deploys. The current production Cloudflare Worker and
the existing EC2 backend are not changed by this repository split.

## 1. Merge gate

Every change goes through a pull request. The required CI checks are the
frontend checks and secret scan in `.github/workflows/ci.yml`. Configure the
`main` branch to require those checks, at least one approval, resolution of all
review threads, and no force pushes or deletion.

The application contract remains:

- build root: `backup/`
- build command: `npm run build`
- deployment command: `npx wrangler deploy --config ../wrangler.jsonc`
- Worker routes: `/api/*`, `/health`, `/health/*`, `/compliance-lab`, and
  `/compliance-lab/*`

Do not change the route list or the backend hostname during the repository
split without a separately reviewed coordinated change.

## 2. Produce a release candidate

After a pull request is merged and CI succeeds on `main`, manually run
**Verify public release candidate**. Supply the full 40-character merged commit
SHA and an approved change-ticket reference. The workflow rejects commits not
contained in `main`, checks out that exact SHA, repeats the routing guard, lint,
build, and secret scan, and uploads the built site plus an evidence manifest and
checksums. It does not deploy or receive Cloudflare credentials.

Record the workflow-run URL and artifact checksum in the change ticket. A
candidate is invalid if its SHA differs from the SHA later staged or promoted.

## 3. Staging gate

No staging Cloudflare account, zone, route, or secret has yet been approved in
this split. Therefore this repository intentionally contains no staging deploy
job. Before enabling one, owners must document and review:

1. a non-production Cloudflare account/project and non-production hostname;
2. a staging backend whose schema and API are compatible with the candidate;
3. least-privilege credentials stored as GitHub environment secrets;
4. the exact immutable artifact or SHA being deployed;
5. the rollback target and the person responsible for promotion.

Deploy the coordinated backend candidate to staging first, then deploy this
frontend candidate. Never point staging frontend traffic at production merely
to make a test pass.

After staging deployment, run:

```bash
./scripts/smoke-public.sh https://APPROVED-STAGING-HOST
```

Also test login, one representative API-backed journey, and the compliance-lab
route with non-production accounts. Review Cloudflare and backend logs for new
errors. Security validation must include the candidate's successful Gitleaks
result, dependency review, authentication/authorization checks, and confirmation
that browser assets contain no secrets.

## 4. Production promotion

Production promotion is a manual change-management event, never a consequence
of a push. The approver must verify all of the following:

- the change ticket identifies the exact SHA and successful release-candidate
  workflow run;
- CI and staging validation are green for that same SHA;
- the staging and production configurations differ only where documented;
- the backend/API version is already compatible;
- the previous known-good SHA and its artifact are available;
- monitoring, an operator, and a rollback decision-maker are present;
- no change freeze is active.

Only then may an authorized operator deploy that exact checked-out SHA from
`backup/` with the preserved command:

```bash
npx wrangler deploy --config ../wrangler.jsonc
```

Immediately run `./scripts/smoke-public.sh https://PRODUCTION-HOST`, inspect
error rates, and keep the change open through the agreed observation period.
Do not edit production Worker code or assets directly during normal operation.

## Rollback

If smoke checks fail, error rates regress, authentication breaks, or the Worker
routes no longer reach the backend, stop the rollout. Redeploy the previous
known-good, already verified SHA with the same command and configuration, then
repeat the production smoke check. A frontend rollback must not assume that a
database migration can be reversed; coordinate with the private repository
owner and use backward-compatible API/schema changes. Record the incident,
failed SHA, rollback SHA, timestamps, and validation outcome.

## Change freeze and emergency handling

During a declared freeze, do not create or promote release candidates except
under the organization's emergency-change process. Emergency releases still
require an exact SHA, recorded authorization, automated verification, smoke
checks, monitoring, and a rollback target. Document any temporarily bypassed
control and restore it immediately afterward.

## GitHub plan limitation

GitHub Free supports protected branches/rulesets and deployment-environment
protection for public repositories. Configure those controls after the new
public repository exists. Repository workflow files cannot prove that the
server-side rules are enabled, so the owner must capture that configuration in
the migration checklist before accepting production changes.
