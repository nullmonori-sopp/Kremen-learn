# Contributing to Kremen Learn

[Русский](CONTRIBUTING.ru.md)

Thanks for helping make programming easier to learn. Bug reports, clearer
explanations, translations, lessons and code changes are all welcome. You can
write issues and pull requests in **English or Russian**.

## Before you start

For a small fix, open a pull request directly. For a new feature or a large
change, open an issue first so the proposed behavior can be discussed. Include
the problem you want to solve and a concrete example.

Check [platform status](docs/PLATFORMS.md) and
[known limits](docs/VERIFICATION.md) before reporting a platform problem. Windows
support is unfinished; describe whether a report concerns native Windows or
the experimental WSLg path.

## Set up and check a change

Follow [development instructions](docs/DEVELOPMENT.md) for system dependencies,
the pinned Rust toolchain and Node.js. From the repository root:

```sh
npm ci
sh scripts/build-toolchain.sh
npm run build
npm run desktop
```

Run checks relevant to your change:

| Change | Check |
| --- | --- |
| Lesson text, examples or tests | `python3 scripts/verify-lessons.py` |
| Rust, compiler adapter, storage or process handling | `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --include-ignored --test-threads=1` |
| Interface | `npm run build`; then `node scripts/verify-ui.mjs` with Chromium available |
| Installer | `python3 installer/test_installer.py` |

The full native suite needs working Bubblewrap/user namespaces. If a check
cannot run, say which check and why; do not report skipped tests as passing.
The browser preview cannot compile programs or save native files. Check those
flows in the desktop application.

## Keep changes easy to review

- Keep each pull request focused on one problem. Explain what changes for the
  learner and how you checked it; attach screenshots for visible changes.
- Keep Russian and English interface strings, lesson content and corresponding
  documentation in sync. See the [lesson format](docs/LESSON-FORMAT.md).
- Preserve raw compiler messages and real command results. Do not replace a
  failed run or unavailable sandbox with a simulated success.
- Keep the compiler source pinned. Explain any compiler changes separately;
  do not update the vendored language as an incidental part of a UI change.
- Follow the surrounding style. Use `cargo fmt --manifest-path
  src-tauri/Cargo.toml` for Rust and Prettier for changed frontend files.
- Leave build caches, personal projects, databases and generated installers out
  of commits. Do not paste credentials or private code into reports.

Contributions are distributed under the project's [MIT license](LICENSE).
Preserve the licenses and attribution of any third-party material you add.
