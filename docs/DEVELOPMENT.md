# Development and packaging

The first release targets Linux x86-64. These development instructions describe
Debian 13 and Ubuntu 24.04 with a desktop session. Build and runtime verification
for the distributed artifact is recorded separately in `VERIFICATION.md`;
commands for a distribution are not evidence that a binary was tested there.
Native Windows compilation/execution and WSL integration are not implemented
release targets.

## System prerequisites

Install a C/C++ toolchain, WebKitGTK 4.1 development files and the Linux packaging
dependencies:

```sh
sudo apt-get update
sudo apt-get install -y build-essential curl file pkg-config libssl-dev \
  libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev \
  libayatana-appindicator3-dev patchelf bubblewrap xdg-desktop-portal xdg-desktop-portal-gtk
```

Install a current stable Rust toolchain using [rustup](https://rustup.rs/) and
Node.js 22 LTS with npm. Rust must satisfy the version in
`src-tauri/Cargo.toml`; use a current stable toolchain for current dependency
versions. Python 3 is used by the lesson/installer verification tools, not by
Kremen itself or by the installed application.

```sh
rustup toolchain install 1.99.1 --profile minimal --component rustfmt
rustc --version
cargo --version
node --version
npm --version
gcc --version
g++ --version
pkg-config --modversion webkit2gtk-4.1
bwrap --version
```

Bubblewrap also needs working unprivileged user/PID/network namespaces. A binary
in `PATH` does not establish that isolation works. The application's toolchain
panel performs the native readiness check. Containers or restricted machines
may disallow namespace creation; do not remove isolation checks to make a
lesson appear successful.

## First build

From the repository root:

```sh
npm ci
./scripts/build-toolchain.sh
npm run verify:lessons
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

`vendor/kremen/` contains the pinned upstream source. The toolchain build copies
the actual compiler executable and runtime header into the resources consumed
by the desktop package. `toolchain.lock.json` records its source commit.
The lessons are verified against that compiler rather than a JavaScript
substitute.

`npm run build` synchronizes the curriculum and creates the Next.js static export
in `out/`. The final application embeds these files and local Monaco assets;
there is no production Node.js or Next.js server.

Start the desktop development window with:

```sh
npm run desktop
```

Tauri starts the development Next.js server and the Rust application together.
For visual frontend work only, run `npm run dev` and open
`http://127.0.0.1:1420`. Compiler and filesystem operations require the Tauri
window. The browser preview reports that requirement instead of returning
simulated execution results.

## Tests

```sh
npm run verify:lessons
cargo test --manifest-path src-tauri/Cargo.toml
python3 installer/test_installer.py
```

The lesson verifier checks real examples and solution outputs. Native tests
cover the implemented process, diagnostic and persistence contracts. The
installer tests compile small real installers and exercise safe extraction,
launchers and uninstall preservation. The release verification report identifies
which checks ran successfully and any environmental gaps; it is the source of
truth for platform claims.

## Release packages

```sh
npm run package -- --bundles deb
./scripts/build-installer.sh
```

Tauri writes the Debian package under
`src-tauri/target/release/bundle/deb/`. The custom C++ installer and its checksum
are written to:

```text
artifacts/Kremen-Learn-0.1.0-linux-x86_64.run
artifacts/Kremen-Learn-0.1.0-linux-x86_64.run.sha256
```

The custom installer is documented in [English](../installer/README.md) and
[Russian](../installer/README.ru.md). It installs for the current user without
administrator privileges. It packages the desktop application, compiler,
runtime header and lessons. It checks system prerequisites but does not fetch
or install them.

Runtime dependencies include WebKitGTK 4.1, GTK 3, GCC with C11/POSIX-thread
support, libc development files and Bubblewrap. An offline machine must already
have compatible system packages installed, or receive them through the
distribution's offline package-management workflow. A `.deb` declaring a
dependency does not bundle that dependency.

Linux binaries depend on the builder's libc and shared-library ABI. To support
older distributions, build and test in the oldest supported distribution;
building on Debian 13 alone does not establish Ubuntu 24.04 compatibility.

## Rebuilding without network access

The first build normally downloads npm packages, Rust crates and operating-system
development packages. After populating and retaining those caches, the
corresponding offline commands are:

```sh
npm ci --offline
cargo build --offline --release --manifest-path src-tauri/Cargo.toml
```

The frontend export and toolchain can then be built from local files. Package
creation also needs all platform-specific Tauri packaging tools already
available. Missing caches or system packages must be supplied beforehand;
offline operation of the installed application does not imply an uncached
offline development build.

`rust-toolchain.toml` pins Rust 1.99.1. The native suite includes tests that
require namespaces: run `cargo test --manifest-path src-tauri/Cargo.toml --lib
-- --include-ignored --test-threads=1` to include the real compiler and isolation
checks. `node scripts/verify-ui.mjs` tests the static export using Chromium;
set `CHROMIUM_PATH` if the executable is elsewhere.
