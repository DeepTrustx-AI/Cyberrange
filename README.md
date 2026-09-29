# CyberRange frontend

React/Vite client and Cloudflare Worker. The backend is accessed exclusively
through HTTP/WebSocket APIs. No backend checkout is required to build this client.

Use Node 22 (22.12 or later). The build root remains `backup`:

```sh
cd backup
npm ci
npm run check:api-routing
npm run build
```

For local development, run `npm run dev`. The Vite proxy uses an independently
running API at `http://127.0.0.1:8000`; alternatively configure `VITE_API_URL`.
Only public configuration belongs in `VITE_*` variables.

The API must implement authenticated course catalogs, simulation commands and
submissions under `/api/v1/private-lab-content`, plus authenticated study-material
downloads under `/api/v1/study-materials/{id}/pdf`. These APIs supply course content;
none is bundled in this repository. Existing routes and API clients remain in place.

Cloudflare build configuration remains:

- Build root: `backup`
- Build command: `npm run build`
- Deploy command (run from the build root): `npx wrangler deploy --config ../wrangler.jsonc`

Wrangler handles `/api/*`, `/health`, `/health/*`, `/compliance-lab`, and
`/compliance-lab/*` before static assets. Build output is generated in `backup/dist`
and ignored by Git. Deployment is a separate, explicitly approved operation.

Pull requests and pushes to `main` run locked dependency installation, the API
routing guard, lint, a production build, and a pinned Gitleaks source scan. The
workflow has read-only repository permissions and contains no deployment step.
