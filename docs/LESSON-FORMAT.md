# Lesson format, version 1

The curriculum lives in `content/catalog.json` and `content/lessons/`, independent
of React components. The catalog declares `schemaVersion: 1` and
`compilerVersion: "0.4.6"`. Each lesson also carries its schema version. Changes
that alter field meaning or test semantics require a new format version rather
than silently reinterpreting old lesson packs.

`scripts/sync-content.mjs` copies the directory to `public/content/` for the
static frontend. Tauri separately bundles the same source directory for the
native test engine. Edit `content/`, not the generated copy.

## Catalog and course metadata

The root object contains `courses`, `lessons` and `roadmap` arrays. Course IDs
and lesson IDs must be stable and unique; progress refers to lesson IDs.
`lessonIds` defines a course's lesson order.

Each course contains:

| Field | Meaning |
| --- | --- |
| `id` | Stable course identifier. |
| `title`, `description` | Objects with `en` and `ru` strings. |
| `art` | Bundled cover asset, such as `/art/foundations.svg`. |
| `lessonIds` | Ordered list of existing lesson IDs. |
| `duration` | Approximate total minutes. |
| `level`, `prerequisites`, `outcomes` | Localized explanatory strings. |

Roadmap entries have `id`, localized `title`, `status: "planned"`, prerequisite
IDs and `sourceReference` pointing into `vendor/kremen/docs/`. They describe
future curriculum, not finished lessons. The current pack has 12 introductory
lessons in six courses and seven planned advanced modules.

## Lesson metadata

Every completed lesson provides:

| Field | Meaning |
| --- | --- |
| `id`, `schemaVersion`, `courseId` | Identity, format version and containing course. |
| `title`, `goal`, `description` | Localized names and learning goal. |
| `explanation`, `task` | Localized beginner explanation and exercise instructions. |
| `duration` | Approximate minutes. |
| `markdown` | `en`/`ru` paths relative to `content/`. |
| `solutionMarkdown` | Separate `en`/`ru` paths for the solution and hints. |
| `example`, `starter`, `solution` | Complete Kremen source strings. |
| `files`, `entry` | Initial relative `.kr`/`.krh` file map and entry filename. |
| `mode` | `learn` for authored exercises. Native verification enforces Learn. |
| `hints` | Separate ordered `en` and `ru` string arrays, revealed one at a time. |
| `walkthrough`, `transfer` | Localized solution explanation and connection to other languages. |
| `tests` | One or more independently runnable test definitions. |

Main Markdown files contain the reading version of the goal, explanation,
runnable example, task and starter. Separate solution Markdown files contain
the progressive hints, solution analysis and transfer section, so opening a
lesson does not reveal its solution. Each lesson has four Markdown files:
English/Russian lesson and English/Russian solution. Keep Markdown code blocks
consistent with the metadata source strings. Examples must
use the pinned language, including its actual result, input-error and resource
semantics.

The current exercises begin with a complete compilable program. Passing the
starter's compiler check does not mean it solves the task. For example, the
first starter prints one line while the solution must print two.

## Execution tests

A normal test has this shape:

```json
{
  "id": "greeting",
  "name": {"en": "Two lines", "ru": "Две строки"},
  "stdin": "",
  "stdout": "Hello, Kremen!\nI can program.\n",
  "stderr": "",
  "exitCode": 0,
  "timeLimitMs": 2000,
  "outputLimitBytes": 65536,
  "files": []
}
```

The engine creates a fresh temporary workspace for every test, stages the
submitted source snapshot, compiles with `--mode=learn`, then supplies the test's
stdin to the executable. Expected stdout, stderr and exit status are compared
exactly. Newlines, trailing spaces and capitalization matter. Output is text;
the runner decodes process bytes as UTF-8 with replacement for invalid sequences.
Results show expected and actual values. File assertions examine the workspace
before it is removed.

`timeLimitMs` controls execution time, independently of the compiler timeout.
The native engine clamps it to 100–10,000 ms. `outputLimitBytes` is a combined
stdout/stderr budget, clamped to 1,024–262,144 bytes. Additional process and file
limits are described in [the execution model](EXECUTION.md).

File checks use relative workspace paths and exact UTF-8 text:

```json
"files": [{"path": "note.txt", "content": "saved\n"}]
```

They are assertions about files produced by the program, not input fixtures.
Files must be regular files, no larger than 1 MiB for a check, and must remain
inside the workspace. Do not use absolute paths, `..` or symbolic links. The
canonical format is an array of `{path, content}` objects; a dictionary of
path-to-content is accepted by the current engine for compatibility.

A compiler-error exercise may replace normal execution expectations with:

```json
"expectedCompilationError": "E107"
```

The engine also accepts `{"code":"E107"}`. This requires a nonzero compiler
result and a real matching Kremen diagnostic. A runtime error or arbitrary stderr
text does not satisfy the assertion. The initial 12-lesson pack contains no
compiler-error exercise; support in the engine is separate from authored content.

Passing all tests in one full lesson check makes completion eligible for local
progress storage. Running one test by its `testId` does not complete the whole
lesson. A later failed attempt does not revoke progress already saved.

Tests are bundled in the local open-source application and are inspectable.
There is no secret-test or anti-cheating security claim.

## Authoring and validation

1. Add stable metadata, both lesson/solution Markdown translations and a local course cover.
2. Teach each new construct before requiring it in the task.
3. Add multiple stdin cases where input changes behavior; distinguish
   `readIntResult`'s domain-specific codes from operating-system errno values.
4. Run `./scripts/build-toolchain.sh` and `npm run verify:lessons`.
5. Run the exercise through the installed desktop application to verify native
   isolation, diagnostics, comparison and persisted completion.

The standalone verifier invokes the real pinned compiler and checks examples,
starters, solutions and expected files. It is an authoring tool for trusted
repository content, not a sandbox for arbitrary user submissions. Native
exercise execution uses the application's isolation layer. Its report is written
to `artifacts/lesson-validation.json`.
