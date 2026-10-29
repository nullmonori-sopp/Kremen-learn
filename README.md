# Kremen Learn

[Русский](README.ru.md) · [Architecture](docs/ARCHITECTURE.md) · [Compiler audit](docs/COMPILER-AUDIT.md)

An open-source, offline desktop programming studio for Kremen. A course library,
local editor, compiler, exercises and personal projects share one workspace.
No account, server or subscription is required.

The first version targets **Linux x86-64**. Windows support is unfinished;
there is no verified Windows installer. See [platform status](docs/PLATFORMS.md).

![Kremen Learn](artifacts/desktop-home.png)

## Install

The custom C++ installer is `artifacts/Kremen-Learn-0.1.0-linux-x86_64.run`.
It embeds the desktop application, compiler, runtime, lessons and original art.
Binary installers accompany the delivery and are not committed to Git; source
checkouts create them with the build commands below.

```sh
chmod +x Kremen-Learn-0.1.0-linux-x86_64.run
./Kremen-Learn-0.1.0-linux-x86_64.run --help
./Kremen-Learn-0.1.0-linux-x86_64.run
```

Read the [installer guide](installer/README.md) for prefix selection and removal.
A Debian package is also built under `src-tauri/target/release/bundle/deb/`.

The operating system must provide **WebKitGTK 4.1, GTK 3, GCC with libc development
headers and pthread, and Bubblewrap with usable user namespaces**. Installation
can be offline once these system packages are available. The installer checks
availability and never downloads or silently installs system dependencies.
The application itself makes no network requests.

## What is included

- Dark and light themes, Russian and English interface, keyboard focus, reduced
  motion and scalable interface; animated library, course pages and lesson dock.
- Twelve introductory lessons with separate bilingual Markdown and versioned
  metadata, runnable examples, starter code, exact tests and progressive hints.
- Local Monaco Editor, `.kr` / `.krh` files, file tabs, project tree, search and
  replace, real compiler formatting, JSON diagnostics and error explanations.
- Real `check`, build/run, `emit-c`, `fmt`, `explain` and `--mode=work|learn`.
- SQLite progress and session storage, local project files, backup/import/export.
- Isolated temporary runs, output/time/resource limits and process-tree stopping.

The compiler is pinned to Kremen **0.4.6**, commit
`671140cd1ef4ea453a07047df07c945efa7184e2`. Its original MIT source is included
in `vendor/kremen/`; no moving branch is used to build the bundled compiler.
Kremen generates C and requires an external C backend. Semantic completion is
not claimed; editor suggestions are keywords.

## Development and build

See [development instructions](docs/DEVELOPMENT.md). The interface uses Next.js
static export, React, TypeScript and Monaco; the desktop host and task engine
use Rust/Tauri 2; the custom installer is C++; build helpers use JavaScript,
Python and shell. The original Kremen compiler is C11.

```sh
npm ci
sh scripts/build-toolchain.sh
python3 scripts/verify-lessons.py
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib -- --include-ignored --test-threads=1
npm run desktop
npm run package -- --bundles deb
bash scripts/build-installer.sh
```

Opening the browser preview lets you inspect the interface. Compilation and
native files require the desktop host; preview never fabricates a successful
run, test or save.

## First session

Open Settings and check that the real toolchain probe is ready. Choose a course,
open the first lesson, edit the code, use Ctrl+Enter to run, then Check solution.
The exercise records completion only after its actual tests pass.

For independent development, choose My projects → Open by path and enter an
absolute local directory with a `.kr` entry file. The system folder chooser is
also available. Recent projects reload from disk. Ctrl+S saves disk files;
the active editor session is saved separately. Save project edits before
switching learning contexts.

## Trust and limits

Read [the execution model](docs/EXECUTION.md) before running unfamiliar code.
Resource limits alone are not an access sandbox. Linux execution requires
Bubblewrap namespaces; unavailable isolation is reported as an error. The
application is an educational tool, not a security boundary against kernel
exploits. Tests stored in a local open-source application are inspectable.

[Verification and known limits](docs/VERIFICATION.md) records the actual checks
and exact platform coverage. This is a first release, not a claim of complete
cross-platform support. MIT license; [third-party notices](THIRD-PARTY-NOTICES.md).
