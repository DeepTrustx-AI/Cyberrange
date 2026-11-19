# CISF beginner practice

Four separate lab pages are added: `/labs/aws-cisf`, `/labs/gcp-cisf`, `/labs/kubernetes-cisf` and `/labs/iac-cisf`. They open through the existing assigned-lab route helper, retaining `?assignment_id=...`. A missing assignment shows a link to My assignments, not local completion.

Learners see a short introduction and two plain-language definitions, then change two sample settings and answer one explanation question. They can reveal hints, retry, check their work and save completion after backend validation. These are clearly labelled guided sample-setting exercises, with no terminal, cloud credentials or live execution claims. The four estimates are 15, 10, 20 and 15 minutes.

The page uses the existing authenticated `apiFetch`, calling the private backend's `/api/v1/cisf-labs/{lab_id}/workspace`, `/check` and `/submit`. Contracts reject a mismatched lab/assignment, malformed criteria and inconsistent completion results. Editing a choice clears previous feedback; switching assignments resets the lesson. Completion displayed after refresh comes from the server.

Deploy with the coordinated `DeepTrustx-AI/Cyberrange-Private` backend branch `codex/cisf-beginner-labs`. That branch includes the four catalogue definitions, server grading, completion integration and a registration command. Deploy the backend first, then this frontend; register the four labs and assign them to the training group through the admin portal. Code deployment alone does not create those assignments.

No live cloud runtime or new frontend dependency is needed. The old advanced cloud/Kubernetes pages retain their existing routes. The new page reuses neutral panels, selected peach states, pill actions, native keyboard-accessible radio groups and hint disclosures, with dark-theme counterparts. It introduces no new art or animation.

Validation: `npm run build` includes six CISF route/contract/transport tests alongside existing routing, authentication, assignment and dashboard tests. Run `npm run lint` too. Local preview files, fake authentication and test databases must not be deployed.
