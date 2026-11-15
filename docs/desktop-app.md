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

Create a Windows installer and portable executable:

```bash
npm run desktop:dist
```

Create a Windows ARM64 installer and portable executable:

```bash
npm run desktop:dist:arm64
```

The generated files are written to the `release` folder. API keys are not bundled into the desktop app. Users can paste cloud-provider keys in the app, provide runtime environment variables while testing, or use Ollama locally without a key.

## EPERM / EBUSY while extracting Electron

If packaging fails while moving `win-unpacked.tmp` and reports a locked
`resources/default_app.asar`, another process may be holding the staging files.
Windows Restart Manager identified VS Code processes holding that file during a
local build. This can occur without the packaged app itself running.

Close the editor window or process that is actually holding those build files,
or build in a fresh directory while keeping the editor open:

```powershell
npm run desktop:prepare
$retryOutput = 'release/windows-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
npx --no-install electron-builder --win --publish=never "--config.directories.output=$retryOutput"
```

Stop if preparation fails. The fresh build directory contains the installer,
portable executable and unpacked app. Avoid concurrent builds targeting the same
directory. A new output path bypasses a lock on an old staging folder; if the new
path is also locked, identify the owning process rather than repeatedly deleting
files or terminating every Node process. Restore or remove failed build folders
only once their locks are released. No antivirus exclusions or machine-wide
permission changes are required by this workaround.
