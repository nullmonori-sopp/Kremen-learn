# Verification and remaining limits

[Русский](VERIFICATION.ru.md)

Verified on 29 October 2026 in Debian 13, Linux x86-64, GCC 14.2, Rust 1.99.1,
Node.js 24.19 and WebKitGTK 4.1 (engine 2.52.6). The compiler source is Kremen
0.4.6, commit `671140cd1ef4ea453a07047df07c945efa7184e2`.

| Layer | Actual result |
| --- | --- |
| Upstream Kremen | 120 checks passed across diagnostics, profiles, security, input and tutorial suites; see the compiler audit |
| Curriculum | 12 starter checks, 12 compiled/executed examples, 16 solution cases passed, including malformed/EOF/range input and created-file content |
| Native application | 13 tests passed, including all normally ignored integration tests; none skipped in this run |
| Compiler adapter | Real check, build, run, emit-c, fmt and explain passed through the isolated Rust adapter, including a four-file `.kr`/`.krh` project with local imports |
| Storage | SQLite restart, retained completion, external-file conflict, path traversal and symlink rejection passed |
| Isolation | Host temporary file denied, network namespace differs, fast output overflow fails, deadline enforced, Stop terminates a descendant retaining a pipe |
| Installer | Eight scenarios passed: install, launch, reinstall, uninstall/data preservation, damaged payload, traversal, absolute paths, symlinks |
| Interface | Static Next.js export and TypeScript passed; Chromium at 1366×768 passed six covers, Monaco, course/lesson navigation, editor input/autosave, invalidation of old results, Ctrl+Enter, Ctrl+K, light/dark, language and reduced-motion checks |
| Contrast | 23 configured text/editor-comment contrast checks passed at 4.5:1 or higher in the tested token pairs; see `contrast-validation.json` |
| Offline assets | Browser verification observed no external requests and no page errors |
| Packaging | Actual optimized Linux executable, Debian package and C++ self-extracting installer built; custom package verified and installed to a separate prefix |

Evidence lives in `artifacts/lesson-validation.json`, `native-validation.txt`,
`installer-validation.txt`, and `ui-validation.json`. The native suite command is:

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib -- --include-ignored --test-threads=1
```

Ordinary `cargo test` skips namespace-dependent tests. A test command that does
not include them is not equivalent to the verification above. The GitHub workflow
is supplied for future reproducible builds; no remote CI run is claimed.

## Native window checks

The installed application was opened on a virtual display. The first lesson was
opened, code edited in Monaco, and Ctrl+Enter produced `Hello, Kremen!` followed
by `I can program.` with exit 0. Checking the solution recorded
`01-first-program` in SQLite. An intentional `missing` variable produced genuine
E107 diagnostics and an editor marker. That subsequent error retained the
completed lesson. Progress and edited session text survived application restart.
The external project path opens the real filesystem directory, including local
module implementations and a `.krh` header; it runs in Work mode.

The build machine has no system-wide development packages or desktop session.
Dependencies were extracted into an unprivileged build sysroot. For native GUI
verification, the local WebKit library's compiled helper-directory string was
relocated to that sysroot and D-Bus service paths were redirected to the local
packages. The application executable, compiler, lesson tests and execution
sandbox were unchanged. This relocation is test-environment setup, is not
included in installers, and does not establish a clean-machine package-manager
installation test. Normal installations require the listed system packages.
The GTK folder chooser was displayed; its full automated selection flow was
unreliable in this window-manager-free session, so opening by path provides the
verified fallback. Every desktop portal/export/import combination was not tested.

## Visual comparison

The two supplied photos guided composition: a fixed left library, wide featured
cards, large horizontal course covers and a compact floating lower panel.
Kremen Learn uses original coral geometry, blue waves, memory blocks, green
resource forms and amber system meshes, with no copied Apple artwork or logos.
Course-cover transitions share layout identities; the lesson dock and workspace
share a spring transition. Motion follows reduced-motion settings and background
CSS effects stop while the window is inactive.

Native screenshots include `desktop-home.png`, `desktop-run.png`,
`desktop-error.png` and `desktop-project.png`. Browser captures
`preview-home.png`, `preview-course.png`, `preview-lesson.png`, and
`preview-light.png` separately document the 1366×768 layout and light theme.
These are running interfaces, not design mockups. Keyboard focus and shortcut
flows were checked; a comprehensive screen-reader/accessibility audit was not.

## Exact remaining limits

- Windows native compilation, isolation and `.exe` installation are not
  implemented. Optional PowerShell/WSLg helpers are source-reviewed and untested
  on Windows. No verified Windows support is claimed.
- The supplied binaries target Debian 13 x86-64. Other distributions, older glibc,
  ARM, and all desktop portals are not verified. System GCC/libc, WebKitGTK/GTK,
  Bubblewrap/user namespaces and a graphical D-Bus session are required.
- Memory and CPU limits apply per process; process count uses a shared real-UID
  baseline plus 128. There is no aggregate cgroup memory/CPU budget or total disk
  quota. Read-only system files are visible. See the precise execution model.
- The session retains the active workspace; there is no multi-workspace draft
  history or version control UI. Session autosave is debounced by 700 ms; abrupt
  shutdown before the pending save can lose the most recent unsaved edit. Save disk-project changes before switching
  learning contexts. Recent project opening reloads disk files, and external
  changes cause a conflict instead of overwrite.
- Backup exports include progress/settings/session/project records. Import
  restores progress; there is no one-click restoration of every backup field.
  Files outside the project `.kr`/`.krh` snapshot are not included in execution or
  project export. The project sidebar lists relative file paths rather than an
  expandable directory hierarchy.
- Advanced topics are structured roadmap entries, not finished lessons.
  Completion suggestions are keywords, with no semantic language server.
- Packages are not code-signed or published. The GitHub connection refused
  `createRepository` with `Resource not accessible by integration`; no second
  remote repository was created. The complete local Git repository and source
  archive are available for publication with suitable permissions.
