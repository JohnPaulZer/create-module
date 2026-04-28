# moducreate-jpz

moducreate-jpz organizes feature files inside your existing layer folders.

It works with Express, MERN, Laravel, and LaraVue projects without forcing a new top-level modules folder.

## What It Does

- Detects your project type automatically.
- Scans existing files and groups them by module (default behavior).
- Moves matched files into feature subfolders inside current layer folders.
- Previews import and namespace path updates during dry runs.
- Updates relative and configured alias imports after files are moved.
- Updates Laravel PHP namespaces and `use` statements after PHP classes are moved.
- Removes empty legacy `modules` or `features` folders after successful moves.
- Keeps your existing project layout.

### Example

Before:

```text
backend/src/controllers/health.controller.ts
backend/src/services/health.service.ts
frontend/src/components/HealthStatus.tsx
```

After:

```text
backend/src/controllers/health/health.controller.ts
backend/src/services/health/health.service.ts
frontend/src/components/health/HealthStatus.tsx
```

## Quick Start

Run a safe preview first:

```bash
npx moducreate-jpz --dry-run
```

Use CI-friendly check mode:

```bash
npx moducreate-jpz --check
```

Apply changes:

```bash
npx moducreate-jpz
```

Create folders manually for selected modules:

```bash
npx moducreate-jpz --type express --modules auth,user
```

## Templates

Sample projects live under `templates/<stack>`.

- `before`: flat/mixed project files with multiple modules and import callers.
- `after`: expected structure after running `npx moducreate-jpz`.

Copy a `before` folder to a temporary location before running the CLI so the original sample stays unchanged.

## Important Commands

```bash
npx moducreate-jpz
npx moducreate-jpz --dry-run
npx moducreate-jpz --check
npx moducreate-jpz --copy-existing
npx moducreate-jpz --type mern --dry-run
npx moducreate-jpz --type laravel --modules auth,user
```

## Important Options

- `-t, --type <type>`: Set project type (`express`, `mern`, `laravel`, `laravue`) when auto-detection is not correct.
- `-m, --modules <list>`: Create module folders manually using comma-separated names like `auth,user,booking`.
- `--check`: Preview changes and exit with code `1` when modularization is still needed.
- `--dry-run`: Show the full preview without writing files.
- `--copy-existing`: Copy existing matched files into module folders instead of moving.
- `--move-existing`: Move existing matched files into module folders (default).
- `--folders-only`: Create only folders, without starter files.
- `--force`: Overwrite existing target files.

## Supported Stacks

- Express API
- MERN (`client/server` or `frontend/backend` layouts)
- Laravel
- LaraVue

## Safety Notes

- A preview is shown before writing changes, including import and namespace updates.
- Move operations run automatically after the preview unless you use `--dry-run` or `--check`.
- Relative JavaScript, TypeScript, Vue imports, and common `tsconfig`/`jsconfig`/Vite aliases are updated after moved files land in their new folders.
- Laravel PHP namespaces and `use` statements are updated when classes move under module folders.
- Existing target files are skipped unless `--force` is used.
- Dry run mode makes no file changes.

## Development

```bash
npm install
npm test
npm run build
npm run dev -- --dry-run --type express --modules auth,user
```
