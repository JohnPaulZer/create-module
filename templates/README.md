# Templates

Each stack folder includes a sample project you can use to test how the CLI moves many files and rewrites callers.

```text
templates/
|-- express/before
|-- express/after
|-- mern/before
|-- mern/after
|-- laravel/before
|-- laravel/after
|-- laravue/before
`-- laravue/after
```

Use the `before` folder as a disposable project:

```powershell
Copy-Item -Recurse templates\express\before .\tmp-express
Set-Location .\tmp-express
npx moducreate-jpz --dry-run
npx moducreate-jpz
```

Compare the result with the matching `after` folder to see the expected module folders and import or namespace rewrites.
