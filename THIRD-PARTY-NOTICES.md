# Third-party software

Kremen Learn is distributed under the MIT license; see [LICENSE](LICENSE).
The pinned Kremen compiler and runtime are MIT, Copyright (c) 2026 Sopp Andrey.
Their original source and license are preserved in `vendor/kremen/` and the
runtime license is included in installed resources.

The interface uses React (MIT), Next.js (MIT), Monaco Editor (MIT),
Motion (MIT), Lucide (ISC), and react-markdown (MIT). The desktop shell uses
Tauri (MIT OR Apache-2.0), Rust dependencies under their respective licenses,
SQLite (public domain) via rusqlite (MIT), and rfd (MIT).
Exact dependency versions are recorded in `package-lock.json` and
`src-tauri/Cargo.lock`. Installed npm dependency license files are retained by
npm; source distributions include the lockfiles for complete auditability.

System packages are not copied into the installer. WebKitGTK, GTK, libc, GCC,
and Bubblewrap retain their upstream licenses and are supplied by the operating
system. A C compiler is needed to compile user programs. The custom installer
uses a self-contained SHA-256 implementation and does not bundle GCC or WebKit.

No Apple artwork, logos, fonts, or other proprietary reference assets are
included. Course artwork is original SVG geometry distributed with this project.
