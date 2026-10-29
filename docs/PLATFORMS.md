# Platform status

[Русский](PLATFORMS.ru.md) · [Development](DEVELOPMENT.md)

## Linux

The available build environment is Debian 13, Linux x86-64 with GCC. Release
verification is recorded in [VERIFICATION.md](VERIFICATION.md); build success
and runtime success are separate checks. A binary built on Debian 13 is not
implicitly compatible with older glibc distributions. Rebuild on the oldest
supported distribution before making wider compatibility claims.

Tauri 2 is suitable for a local Linux application and embeds the Next.js static
export. Production does not need Node.js, npm or a Next.js server. Monaco's
editor code and workers, course artwork, lesson Markdown, test metadata and
compiler resources are local assets. Development still needs downloaded build
dependencies or populated offline caches.

Linux system components are:

- WebKitGTK **4.1** and GTK 3 for the desktop webview. WebKitGTK 4.0 is a different
  package family and does not satisfy this build.
- A C11 compiler, libc development files, binutils and pthread for generated C.
  The packaged runner uses the system backend available in its isolated `/usr`.
- Bubblewrap at `/usr/bin/bwrap`, with usable user, mount, PID and network
  namespaces. Some containers, hardened distributions or policies deny these
  operations even when the binary is installed.
- A graphical desktop session and D-Bus/file-dialog support. Headless release
  checks use a virtual display; this does not establish every desktop portal.

The custom C++ `.run` installer installs for one user. The Debian package
records system dependencies, but neither package silently downloads them or
bundles an entire Linux desktop runtime. Offline installation requires those
compatible packages to be installed already or supplied separately using the
distribution's offline package workflow.

## Windows

**There is no verified native Windows build, execution path or Windows
installer in version 0.1.0.** The interface framework supports Windows, but the
actual compiler and runner do not thereby become portable. The non-Linux
execution path refuses compilation/execution rather than running without
isolation.

A real native port of upstream Kremen would have to replace or adapt:

| Area | Current mechanism | Windows work required |
| --- | --- | --- |
| Processes | `fork`, `execvp`, `waitpid`, POSIX exit/signal behavior | `CreateProcessW`, argv encoding/quoting, inherited handles, exit propagation |
| Paths/files | `/` paths, `realpath`, `mkstemp`, `mkdtemp`, `unlink`, POSIX directories | UTF-16 Win32 paths, drive/UNC semantics, canonical containment, temporary files, symlink/reparse behavior |
| Threads | pthreads and POSIX runtime services | Compatible pthread backend or native Windows synchronization and runtime implementation |
| Backend | GCC C11 plus pthread and POSIX headers | A documented compatible compiler/runtime distribution and reproducible packaging |
| Isolation | Linux namespaces/Bubblewrap and rlimits | Separate access boundary such as AppContainer plus process/job lifecycle and resource controls |
| Tree stopping | PID-namespace init termination and child reaping | Job containment and descendant termination; a Job Object alone is not an access sandbox |

Tauri on Windows additionally requires WebView2. An offline Windows installer
would have to verify a compatible installed runtime or include an allowed
standalone installer; an online bootstrapper would not satisfy offline setup.
That packaging path has not been implemented or tested here.

The optional [PowerShell WSLg scripts](../windows/README.md) install and start
the Linux application in an existing Debian 13+ x86-64 WSL2 distribution. They
use explicit argv, detect the distribution/architecture, convert the installer
path and probe dependencies/namespaces. They do not install WSL or supply a
native Windows app. No hidden automatic WSL fallback exists. These scripts have
not been run on Windows: process and path behavior, display, cancellation,
file-dialog behavior and the complete Windows-host learning path remain
unverified. The Linux application retains its Linux staging and sandbox logic.

## Explicitly unverified areas

Windows native and WSLg; ARM targets; macOS; older glibc distributions; all Linux
window managers and desktop portals; machines that disable unprivileged user
namespaces; accessibility integration across every webview version. These are
specific missing coverage areas, not claims that they have passed.

When WSL is detected, the toolchain panel explicitly labels it `Linux / WSLg
(unverified)`. This label is not evidence of Windows runtime testing.
