# Where Kremen Learn goes next

[Русский](ROADMAP.ru.md) · [Back to the project](README.md)

These are development priorities, not promises of delivery dates. Version 0.1.0
has a working Linux learning flow; the [verification report](docs/VERIFICATION.md)
describes exactly what has been checked.

## Windows, with an actual end-to-end test

Port the compiler's POSIX process, filesystem and threading dependencies, choose
a compatible C backend, and implement access isolation and process-tree stopping
on Windows. Package the application and offline WebView2 prerequisites, then
test installation, a lesson, diagnostics, saving and cancellation on Windows.
The existing WSLg helpers remain an explicitly unverified intermediate option.

## Better project continuity

Keep separate drafts for each workspace, make context changes safe for unsaved
edits, add an expandable file tree, and restore all backup fields. Define how
project data files should participate in staging and export.

## Stronger and clearer execution limits

Investigate aggregate memory/CPU and workspace disk budgets. Keep reporting the
actual isolation capability instead of silently falling back when it is absent.
Add reproducible coverage for more desktop distributions and portals.

## More lessons

Turn the existing advanced-topic outline into complete lessons on references,
pointers, unsafe, slices, arenas, files and threads. Every example and solution
must work with the pinned compiler, with matching English and Russian text.

## A smoother editor and wider accessibility coverage

Improve diagnostic navigation and large-project interaction. Add semantic
completion only when there is a working language implementation behind it.
Check keyboard and screen-reader use in real desktop webviews, alongside
reduced motion, scaling and both themes.

## Reproducible releases

Run the supplied workflow remotely, verify packages on clean systems, document
distribution compatibility and signing, and publish installers with checksums.
See [publishing](docs/PUBLISHING.md) for the current release procedure.
