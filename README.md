# moducreate-jpz

Create feature folders inside the folders your project already has.

`moducreate-jpz` does **not** need to create one separate `modules/` folder. By default, it detects existing files and moves them into matching layer folders:

```text
backend/src/controllers/health.controller.ts
backend/src/services/health.service.ts
frontend/src/components/HealthStatus.tsx
```

becomes:

```text
backend/src/controllers/health/health.controller.ts
backend/src/services/health/health.service.ts
frontend/src/components/health/HealthStatus.tsx
```

## Supported Stacks

- MERN
- Express API
- Laravel
- LaraVue

## Run

```bash
npx moducreate-jpz
```

Common commands:

```bash
npx moducreate-jpz
npx moducreate-jpz --dry-run
npx moducreate-jpz --copy-existing
npx moducreate-jpz --type express --modules auth,user,booking
npx moducreate-jpz --type mern --dry-run
npx moducreate-jpz --type laravel --modules auth,user
npx moducreate-jpz --type laravue --folders-only
```

## What It Does

- Detects the current project type automatically.
- Keeps the current project structure.
- Creates feature subfolders inside existing layer folders.
- Detects whether a file belongs in `controllers`, `services`, `routes`, `models`, `components`, `pages`, `hooks`, `api`, and similar folders.
- Shows a preview before writing files.
- Moves existing files by default.
- Creates a backup before moving existing files.
- Can copy instead of move with `--copy-existing`.
- Never deletes existing files.
- Skips existing target files unless you confirm overwrite or use `--force`.
- Supports dry-run mode.
- Supports folders-only mode.
- Generates `moducreate-jpz-report.md` after creation.

## Options

```bash
moducreate-jpz [options]

Options:
  -t, --type <type>       express, mern, laravel, or laravue
  -m, --modules <list>    comma-separated module names
  --auto-structure        scan existing files and move them into matching folders
  --copy-existing         copy matching existing files instead of moving
  --move-existing         move matching existing files (default)
  --no-backup             skip backup when copying or moving existing files
  --folders-only          create folders without starter files
  --dry-run               preview changes without writing files
  --force                 overwrite existing target files without prompting
  -y, --yes               kept for script compatibility; no prompts are shown
```

## Express API Output

```text
src/controllers/auth/auth.controller.ts
src/routes/auth/auth.routes.ts
src/services/auth/auth.service.ts
src/models/auth/auth.model.ts
src/middlewares/auth/auth.middleware.ts
src/validations/auth/auth.validation.ts
src/types/auth/auth.types.ts
```

## MERN Output

Backend files are created inside the existing backend layer folders:

```text
backend/src/controllers/auth/auth.controller.ts
backend/src/routes/auth/auth.routes.ts
backend/src/services/auth/auth.service.ts
backend/src/models/auth/auth.model.ts
backend/src/middlewares/auth/auth.middleware.ts
backend/src/validations/auth/auth.validation.ts
backend/src/types/auth/auth.types.ts
```

Frontend files are created inside the existing frontend layer folders:

```text
frontend/src/components/auth/Auth.tsx
frontend/src/pages/auth/AuthPage.tsx
frontend/src/hooks/auth/useAuth.ts
frontend/src/services/auth/auth.service.ts
frontend/src/types/auth/auth.types.ts
```

`server/client` and `backend/frontend` layouts are both supported.

## Laravel Output

```text
app/Http/Controllers/Auth/AuthController.php
app/Services/Auth/AuthService.php
app/Repositories/Auth/AuthRepository.php
app/Http/Requests/Auth/AuthRequest.php
app/Http/Resources/Auth/AuthResource.php
app/Models/Auth/Auth.php
routes/auth/auth.php
```

## LaraVue Output

Laravel files use the Laravel layer folders above.

Vue files are created inside `resources/js` layer folders:

```text
resources/js/components/auth/Auth.vue
resources/js/pages/auth/AuthPage.vue
resources/js/composables/auth/useAuth.ts
resources/js/services/auth/auth.service.ts
resources/js/stores/auth/auth.store.ts
resources/js/types/auth/auth.types.ts
```

## Auto Structure Mode

The default command is automatic and non-interactive:

```bash
npx moducreate-jpz
```

Use dry-run to preview without moving files:

```bash
npx moducreate-jpz --type mern --dry-run
```

If the preview looks right, run without `--dry-run`:

```bash
npx moducreate-jpz --type mern
```

Move mode is the default. Copy mode keeps originals where they are:

```bash
npx moducreate-jpz --copy-existing
```

## Detection Rules

Express API detection checks for:

- `package.json` containing `express`
- `src` folder
- optional `routes`, `controllers`, or `services` folders

MERN detection checks for:

- `package.json` containing `express` and `react`
- `client` and `server` folders
- `frontend` and `backend` folders
- Vite React frontend with an Express backend

Laravel detection checks for:

- `composer.json` containing `laravel/framework`
- `artisan`
- `app/Http/Controllers`

LaraVue detection checks for:

- `composer.json` containing `laravel/framework`
- `package.json` containing `vue`
- `resources/js`
- `vite.config.ts` or `vite.config.js`

## Development

```bash
npm install
npm run build
npm run dev -- --dry-run --type express --modules auth,user
npm run dev -- --type mern --dry-run
```

## Publishing

```bash
npm login
npm publish
```
