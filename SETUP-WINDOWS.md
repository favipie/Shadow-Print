# Windows setup

Install Git, Node.js 20.9 or newer, pnpm, VS Code, and the VS Code Codex extension. Install SQL Server Express and a management tool only if you will work on the later backend/database milestone.

```powershell
git clone https://github.com/favipie/shadowprint.git
cd shadowprint
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Next.js. Validate before committing:

```powershell
pnpm test
pnpm typecheck
pnpm build
node node_modules/tsx/dist/cli.mjs --test database/tests/artifacts.test.ts
```

For local SQL Server Express, confirm the Windows service is running and that Windows Authentication can connect to your intended local instance/database. Do not expose a database port publicly. The current SQL source is MySQL reference code; SQL Server setup and execution remain pending under `database/sqlserver/`.

Use Codex Cloud against the GitHub repository and VS Code against a local clone. At the start of work run `git status` and `git pull --ff-only`; after verified work use `git add`, `git commit`, and `git push`. Never use a force push for this repository. Pull before pushing from either Cloud or local work so the two environments do not overwrite each other.
