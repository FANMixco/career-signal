# Microsoft Store packaging

This repository's Store workflow builds **AppX packages** for x64 and ARM64.
`npm run desktop:dist` produces the separate NSIS/portable EXE distribution for both x64 and ARM64. `npm run desktop:release:all` also builds Store and signed sideload packages using your private local helpers.

The Store identity, packaging configuration, helper scripts and artwork are local
files intentionally excluded from Git. This guide documents how to use them and
how to build without the private helper scripts. Examples contain placeholders,
not the maintainer's Partner Center identity or certificate details.

## Local files

| Ignored path | Purpose |
| --- | --- |
| `store-package.local.ps1` | Sets the local Partner Center identity and optional packaging overrides. |
| `electron-builder.store.cjs` | Extends the public Electron configuration with the AppX target and Store identity. |
| `scripts/build-store-app.ps1` | Prepares the app, builds x64/ARM64 packages and collects upload files. |
| `scripts/create-sideload-cert.ps1` | Creates a development signing certificate for optional local installation. |
| `scripts/build-sideload-app.ps1` | Builds AppX files and signs separate copies for local installation. |
| `scripts/trust-sideload-cert-machine.ps1` | Optional elevated machine-wide trust helper; not needed for Store submission. |
| `build/appx/` | AppX tile and Store-logo assets. |
| `frontend/img/store-logos/` | Separate listing artwork used in Partner Center. |
| `release/` | Completed packages and optional exported public test certificates. |

Restore the private helpers/artwork from your own backup on a new workstation.
They will not appear after cloning the repository. Alternatively, use the generic
configuration and direct commands below. Do not force-add ignored local files to
Git. Keep private keys and certificate exports in private storage; this guide does
not require creating or committing a PFX file.

## Prerequisites

Use Windows with PowerShell and Node.js 24/npm. From the repository root:

```powershell
npm ci
npm --prefix backend ci
```

Have access to the app's reserved product in Partner Center. Copy the identity
fields from **Product management → Product identity** exactly. Identity, publisher
and publisher display name must match the package manifest. See Microsoft's
[Store readiness checklist](https://learn.microsoft.com/en-us/windows/apps/publish/store-readiness-checklist).

Initial packaging may download Electron and build tools, so prepare those while
online. Optional sideload signing also needs `signtool.exe`; the private helper
looks in its bundled-tools path, specific Windows SDK paths, then `PATH`. If that
lookup fails, install the Windows SDK signing tools and make SignTool available
on `PATH`.

## Configure your identity

Create or edit the ignored `store-package.local.ps1` in the repository root:

```powershell
$env:WINDOWS_STORE_IDENTITY_NAME = '<Package/Identity/Name from Partner Center>'
$env:WINDOWS_STORE_PUBLISHER = '<Package/Identity/Publisher from Partner Center>'
$env:WINDOWS_STORE_PUBLISHER_DISPLAY_NAME = '<Publisher display name from Partner Center>'

# Optional app-facing metadata.
$env:WINDOWS_STORE_APPLICATION_ID = 'CareerSignalEngine'
$env:WINDOWS_STORE_DISPLAY_NAME = 'Career Signal Engine'
$env:WINDOWS_STORE_BACKGROUND_COLOR = '#f6f4ef'

# Leave empty to derive a four-part version from package.json.
$env:WINDOWS_STORE_PACKAGE_VERSION = ''
```

Replace the angle-bracket placeholders locally. The build helper loads this file
automatically. Direct builds load it with:

```powershell
. .\store-package.local.ps1
```

The private configuration uses these variables:

| Variable | Meaning |
| --- | --- |
| `WINDOWS_STORE_IDENTITY_NAME` | Required Partner Center package identity name. |
| `WINDOWS_STORE_PUBLISHER` | Required manifest publisher string. |
| `WINDOWS_STORE_PUBLISHER_DISPLAY_NAME` | Required publisher display name. |
| `WINDOWS_STORE_APPLICATION_ID` | Optional application identifier; defaults to `CareerSignalEngine`. |
| `WINDOWS_STORE_DISPLAY_NAME` | Optional display name; defaults to the public product name. |
| `WINDOWS_STORE_BACKGROUND_COLOR` | Optional tile background color. |
| `WINDOWS_STORE_PACKAGE_VERSION` | Optional four-part Store version override. |
| `WINDOWS_STORE_OUTPUT_DIR` | Optional repository-relative output base directory. |
| `WINDOWS_STORE_ELECTRON_DIST` | Legacy direct-config override; updated helpers clear it and let the public wrapper prepare the correct runtime. |

## Version and artwork

For a normal release, update the root `package.json` version, then run:

```powershell
npm run version:sync
```

The sync script uses the newer version from root/backend manifests, then updates
the related manifests, lockfiles and frontend version labels. The Store config
converts a three-part version such as `1.3.0` to `1.3.0.0`. An update must have a
version suitable for replacing the published package. Keep the fourth component
at zero for Store submission, following Microsoft's
[package version requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements#package-version-numbering).

The existing AppX artwork uses these filenames in `build/appx/`:

- `StoreLogo.png`
- `Square150x150Logo.png`
- `Square44x44Logo.png`
- `Wide310x150Logo.png`

Restore those assets before making a release. electron-builder can substitute its
sample assets when files are missing, so a successful build alone does not prove
that the intended branding is present. Partner Center listing artwork in
`frontend/img/store-logos/` is maintained separately from the package tile assets.

## Build with the private helper

From the repository root, build both architectures:

```powershell
powershell.exe -NoProfile -File .\scripts\build-store-app.ps1 -Architecture all
```

For one architecture, use `-Architecture x64` or `-Architecture arm64`. `all` is
the Store helper's default. Running in a child PowerShell process also keeps the
helper's temporary output/runtime environment variables out of the parent shell.
If your execution policy blocks a trusted local helper, add
`-ExecutionPolicy Bypass` to that invocation only; changing the machine-wide
execution policy is not required.

The helper runs version synchronization and `desktop:prepare`, then calls
`scripts/package-desktop.cjs` with `electron-builder.store.cjs`. Default output:

```text
release/store-build/<version>/
  upload/    # x64 and ARM64 AppX files
```

The package filenames follow `Career Signal Engine-Store-<version>-<arch>.appx`.
The optional `WINDOWS_STORE_OUTPUT_DIR` changes the base directory while retaining
the upload subfolder. The helper builds and collects files; it does
not upload them to Partner Center.

### Electron runtime cache after upgrades

The updated private helper delegates to the public packaging wrapper. It clears
legacy `WINDOWS_STORE_ELECTRON_DIST` overrides, prepares the installed Electron
version for each architecture, and omits the unused default-app archive. It does
not search old unpacked builds or repair/reuse cached application folders. This
avoids both stale runtimes after an Electron upgrade and the VS Code ASAR lock.
Each run uses unique architecture staging and restores the original environment
variables on exit. The private scripts remain ignored; restore their updated
local copies on another workstation.

## Fresh checkout or missing private helpers

The following is a **generic reconstruction example**, not a copy of the private
helper scripts. Save this locally as the ignored `electron-builder.store.cjs`:

```javascript
const pkg = require('./package.json');
function required(name) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
}
module.exports = {
  ...pkg.build,
  buildVersion: process.env.WINDOWS_STORE_PACKAGE_VERSION || `${pkg.version}.0`,
  npmRebuild: false,
  directories: {
    ...pkg.build.directories,
    output: process.env.WINDOWS_STORE_OUTPUT_DIR || 'release/store-build/manual'
  },
  win: { ...pkg.build.win, target: ['appx'] },
  appx: {
    applicationId: process.env.WINDOWS_STORE_APPLICATION_ID || 'CareerSignalEngine',
    artifactName: '${productName}-Store-${version}-${arch}.${ext}',
    identityName: required('WINDOWS_STORE_IDENTITY_NAME'),
    publisher: required('WINDOWS_STORE_PUBLISHER'),
    publisherDisplayName: required('WINDOWS_STORE_PUBLISHER_DISPLAY_NAME'),
    displayName: process.env.WINDOWS_STORE_DISPLAY_NAME || pkg.build.productName,
    backgroundColor: process.env.WINDOWS_STORE_BACKGROUND_COLOR || '#f6f4ef'
  }
};
```

Use a three-part numeric `package.json` version with this minimal example. It
uses the public wrapper to prepare the matching Electron runtime in temporary
storage rather than reusing old application folders. It does not implement the
private configuration's `WINDOWS_STORE_ELECTRON_DIST` override.

Load the identity file, prepare the app, and build each architecture explicitly:

```powershell
. .\store-package.local.ps1
npm run desktop:prepare
Remove-Item Env:WINDOWS_STORE_ELECTRON_DIST -ErrorAction SilentlyContinue

$env:WINDOWS_STORE_OUTPUT_DIR = 'release/store-build/manual/x64'
node scripts/package-desktop.cjs --config electron-builder.store.cjs --win --x64 --publish=never "--config.directories.output=$env:WINDOWS_STORE_OUTPUT_DIR"

$env:WINDOWS_STORE_OUTPUT_DIR = 'release/store-build/manual/arm64'
node scripts/package-desktop.cjs --config electron-builder.store.cjs --win --arm64 --publish=never "--config.directories.output=$env:WINDOWS_STORE_OUTPUT_DIR"
```

Stop if preparation or either build fails. These direct commands leave their
AppX files in the two architecture directories; the private helper's combined
`upload` directory is not created. Use unique output directories for separate
releases so an old AppX cannot be mistaken for the current result.

## Optional local sideload test

Store submission does not require the development certificate workflow below.
Microsoft signs AppX/MSIX packages for Store distribution; packages installed
directly outside the Store need an appropriate trusted signature. See Microsoft's
[package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements#msix-appx-signing-for-microsoft-store-submission).

If the private sideload helpers are available, load the same identity and pass the
publisher explicitly. Do not rely on a helper's workstation-specific default
subject or thumbprint:

```powershell
. .\store-package.local.ps1
powershell.exe -NoProfile -File .\scripts\create-sideload-cert.ps1 -Subject $env:WINDOWS_STORE_PUBLISHER
powershell.exe -NoProfile -File .\scripts\build-sideload-app.ps1 -Architecture all -Subject $env:WINDOWS_STORE_PUBLISHER -SkipTrust
```

The certificate helper creates the private key in `Cert:\CurrentUser\My` and
exports a public `.cer` under `release/`. Keep access to that signing key on the
workstation or restore it from your private certificate backup; a public `.cer`
alone cannot sign a package. The subject must match the manifest publisher.
[Microsoft's certificate guide](https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing)
explains that requirement and certificate trust for local testing.

The sideload helper derives its default certificate subject from the local Store publisher and locates SignTool across installed Windows SDK versions. It signs copies into
`release/sideload-build/<version>/install/`, leaving its unsigned source packages
in `release/store-build/<version>/upload/`. The default `-Architecture all` signs both x64/ARM64;
both helpers default to all architectures. After explicitly
trusting the intended development certificate on the test machine, install the
matching package:

```powershell
Add-AppxPackage -Path '<full path to the signed matching-architecture AppX>'
```

`-SkipTrust` prevents the build from modifying certificate trust stores. Without
it, the private helper adds the certificate to Current User `TrustedPeople`;
`-TrustAsRoot` additionally modifies Current User `Root`. The separate machine
helper modifies `LocalMachine\Root` and needs elevation. It is optional: pass
`-CertificatePath` and `-Thumbprint` explicitly if you choose to use it, rather
than trusting its private defaults. None of these trust changes is necessary just
to generate Store upload files. Signing, trusting, installing and uploading are
separate operations; the commands here do not submit an app to the Store.

## Upload and verify

Use the fresh Store-build AppX files, not the `-Sideload-` copies or a cached
unpacked application. In Partner Center, open the product's submission, upload
the x64 and ARM64 packages under **Packages**, check the reported identity,
architecture and version, and complete the required listing/certification steps.
No existing GitHub workflow calls the private Store helper: the public desktop
release workflow currently publishes NSIS/portable EXEs instead.

Before submitting, test startup and an offline evidence check, and run the
Windows App Certification Kit where available. Microsoft's
[readiness checklist](https://learn.microsoft.com/en-us/windows/apps/publish/store-readiness-checklist)
covers identity, signing, capabilities and certification. This documentation was
checked against the local helper interfaces; no Store submission or certificate
trust change was performed while writing it.

## Verify that private files stay untracked

```powershell
git check-ignore electron-builder.store.cjs store-package.local.ps1 scripts/build-store-app.ps1 scripts/build-sideload-app.ps1 scripts/create-sideload-cert.ps1 scripts/trust-sideload-cert-machine.ps1 build/appx frontend/img/store-logos
git ls-files electron-builder.store.cjs store-package.local.ps1 scripts/build-store-app.ps1 scripts/build-sideload-app.ps1 scripts/create-sideload-cert.ps1 scripts/trust-sideload-cert-machine.ps1
git status --short
```

The first command should list the ignored paths. The second should print nothing.
Commit public documentation and intended application changes only; restore or
maintain the private files separately.

The npm shortcuts `desktop:store` and `desktop:sideload` explicitly select both architectures. The sideload shortcut passes `-SkipTrust`: it signs and exports a public certificate but does not install a package or modify certificate trust. Temporary packaging files are created outside `release/` and cleaned after each build.
