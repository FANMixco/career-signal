# Windows Desktop App

For Microsoft Store AppX packages and the ignored local packaging scripts, see
[Microsoft Store packaging](windows-store.md). The commands below create the
ordinary desktop installer and portable EXE distribution.

## Optional: Build A Windows Desktop App

The project also includes an Electron wrapper for Windows. It starts the same local backend internally and opens the app in a desktop window.

Install the desktop and backend dependencies from the project root:

```bash
npm run desktop:setup
```

Run the desktop app in development mode:

```bash
npm run desktop:dev
```

Create an unpacked Windows build for quick testing:

```bash
npm run desktop:pack
```

Create Windows installers and portable executables for **both x64 and ARM64**:

```bash
npm run desktop:dist
```

For a single architecture, use `npm run desktop:dist:x64` or:

```bash
npm run desktop:dist:arm64
```

Final installer/portable EXEs go directly to `release/`, with `x64` or `arm64` in each filename. Temporary Electron runtimes and staging files stay in OS temporary storage and are cleaned after each build. `desktop:pack` keeps its unpacked application under `release/unpacked/<version>/<arch>/`. API keys are not bundled into the desktop app. Users can paste cloud-provider keys in the app, provide runtime environment variables while testing, or use Ollama locally without a key.

## EPERM / EBUSY while extracting Electron

If packaging fails while moving `win-unpacked.tmp` and reports a locked
`resources/default_app.asar`, another process may be holding the staging files.
Windows Restart Manager identified VS Code processes holding that file during a
local build. This can occur without the packaged app itself running.

The standard `desktop:pack`, `desktop:dist`, and architecture-specific npm scripts
now use `scripts/package-desktop.cjs`. On Windows, it downloads the locked
Electron version for the requested architecture into a fresh runtime directory,
omitting Electron's unused `resources/default_app.asar`, then builds using that
runtime. The application itself is supplied separately under `resources/app`.
This prevents the build from creating the default-app archive that editor
processes were locking, including in newly created staging folders.

Run the ordinary command again:

```powershell
npm run desktop:dist
```

For an explicit output path or AppX configuration, use the same public wrapper:

```powershell
npm run desktop:prepare
node scripts/package-desktop.cjs --win --publish=never --config.directories.output=release/windows-retry
```

Stop if preparation fails. The selected output directory receives only completed artifacts. Avoid concurrent builds targeting the same
directory. Do not invoke electron-builder directly when working around this default-app lock; if the new
path is also locked, identify the owning process rather than repeatedly deleting
files or terminating every Node process. Restore or remove failed build folders
only once their locks are released. No antivirus exclusions or machine-wide
permission changes are required by this workaround.

## Build all Windows release formats

After restoring the private Store configuration and signing helpers described in [Windows Store packaging](windows-store.md), run:

```powershell
npm run desktop:release:all
```

This builds installer and portable EXEs, unsigned Store AppX packages, and signed sideload AppX copies for both x64 and ARM64. It does not install the application or change certificate trust. You can also run `npm run desktop:store` or `npm run desktop:sideload` separately.

```text
release/
  Career Signal Engine-Setup-<version>-x64.exe
  Career Signal Engine-Setup-<version>-arm64.exe
  Career Signal Engine-Portable-<version>-x64.exe
  Career Signal Engine-Portable-<version>-arm64.exe
  store-build/<version>/upload/       # unsigned x64 + ARM64 AppX
  sideload-build/<version>/install/   # signed x64 + ARM64 AppX and public certificate
```

Repeated builds replace the completed files for the same version. Older version folders are retained. Avoid running builds concurrently into the same final destination. Store and sideload commands require the ignored private helpers; ordinary EXE builds and public CI do not.
