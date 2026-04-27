# moducreate-jpz

moducreate-jpz organizes feature files inside your existing layer folders.

It works with Express, MERN, Laravel, and LaraVue projects without forcing a new top-level modules folder.

## What It Does

- Detects your project type automatically.
- Scans existing files and groups them by module (default behavior).
- Moves matched files into feature subfolders inside current layer folders.
- Keeps your existing project layout.
- Generates a report after changes.

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

Apply changes:

```bash
npx moducreate-jpz
```

Create folders manually for selected modules:

```bash
npx moducreate-jpz --type express --modules auth,user
```

## Important Commands

```bash
npx moducreate-jpz
npx moducreate-jpz --dry-run
npx moducreate-jpz --copy-existing
npx moducreate-jpz --type mern --dry-run
npx moducreate-jpz --type laravel --modules auth,user
```

## Important Options

- `-t, --type <type>`: Set project type (`express`, `mern`, `laravel`, `laravue`) when auto-detection is not correct.
- `-m, --modules <list>`: Create module folders manually using comma-separated names like `auth,user,booking`.
- `--dry-run`: Show the full preview without writing files.
- `--copy-existing`: Copy existing matched files into module folders instead of moving.
- `--move-existing`: Move existing matched files into module folders (default).
- `--no-backup`: Skip backup creation before copy/move operations.
- `--folders-only`: Create only folders, without starter files.
- `--force`: Overwrite existing target files.

## Supported Stacks

- Express API
- MERN (`client/server` or `frontend/backend` layouts)
- Laravel
- LaraVue

## Safety Notes

- A preview is shown before writing changes.
- Existing target files are skipped unless `--force` is used.
- Copy/move operations create a backup by default.
- Dry run mode makes no file changes.
- A report file is created after execution (`moducreate-jpz-report.md`, or a timestamped name if one already exists).

## Development

```bash
npm install
npm run build
npm run dev -- --dry-run --type express --modules auth,user
```
