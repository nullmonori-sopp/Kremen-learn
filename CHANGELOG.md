# Changelog

[Русский](CHANGELOG.ru.md)

## 0.1.0 — 2026-10-29

First Linux version with a complete, locally verified learning flow.

- Course library, dark/light themes, Russian/English interface and lesson dock.
- Twelve bilingual lessons with examples, tasks, tests, hints and explanations.
- Monaco editor, multiple `.kr`/`.krh` files and independent local projects.
- Pinned Kremen 0.4.6 integration: check, build/run, emit-c, fmt and explain;
  real JSON diagnostics with editor navigation.
- SQLite progress/session storage, project conflict detection and progress backup.
- Linux namespace execution with deadlines, output/resource limits and Stop.
- Custom C++ `.run` installer and a Debian package.

Verified on Debian 13 x86-64. Native Windows support is unfinished; WSLg helpers
are unverified. See [verification and limits](docs/VERIFICATION.md).
