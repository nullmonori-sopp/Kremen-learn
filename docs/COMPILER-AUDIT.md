# Kremen 0.4.6 integration audit

[Русский](COMPILER-AUDIT.ru.md) · [Platforms](PLATFORMS.md) · [Execution](EXECUTION.md)

## Source identity and build

The upstream repository is <https://github.com/nullmonori-sopp/Kremen>.
The integrated source is commit **671140cd1ef4ea453a07047df07c945efa7184e2**,
whose `VERSION` is `0.4.6`. The repository had no release tags at inspection;
this commit is pinned directly in `toolchain.lock.json`, and its complete source
snapshot is preserved in `vendor/kremen/` with the original MIT license.

The full compiler is C11, not the smaller self-hosted subset. `make` builds
`build/kremen` with strict warnings. The application uses the full compiler,
which reports `Kremen 0.4.6 (native C11)`. On Linux x86-64 the upstream build
selects an assembly copy routine; `make USE_ASM=0` selects the portable C routine.

The compiler translates Kremen to C. Program compilation requires a C11 compiler,
libc development headers, a linker and POSIX threads. Default generated-C flags
are `-std=c11 -Wall -Wextra -Wpedantic -Werror -O3 -pthread`. Kremen Learn does
not pretend that merely bundling `kremen` also supplies a C backend.

## Real command surface

| Operation | Supported upstream invocation | Integration detail |
| --- | --- | --- |
| Check | `kremen check main.kr --root DIR --mode=learn --diagnostic-format=json` | Checks Kremen without invoking C |
| Build | `kremen build main.kr -o app --mode=work --diagnostic-format=json` | Produces a native executable through C backend |
| Run | `kremen run main.kr --mode=learn` | Upstream command works; application may build and execute separately to apply distinct limits |
| Emit C | `kremen emit-c main.kr -o main.c --mode=work` | Generated C includes runtime source |
| Format | `kremen fmt main.kr` | Canonical text on stdout; `-w` writes source; `--check` checks drift |
| Explain | `kremen explain E110` | Offline explanation and example; `--list` lists the catalog |

`--mode=work` and `--mode=learn` are real full-language flags. The last occurrence
wins. `fmt` and `explain` reject the mode flag; they do not run the semantic
checker. `--diagnostic-format=json` is the exact structured-diagnostic option.
The application stores mode as a preference and passes a flag for each semantic
operation; upstream has no persistent project-profile file.

Both modes retain shared type, borrowing and runtime safety checks. Learn adds
`L001` explicit initialization, `L002` handling result-bearing values, `L003`
using failure codes, `L004` explicit match alternatives, and `L005` fallible
integer input. These checks do not prove termination or application correctness.

## Diagnostics and editor coordinates

Frontend failure writes one JSON object to stderr and exits unsuccessfully.
A successful `check` writes its normal `path: OK` message to stdout and no
error object. The full compiler stops at its first frontend error. JSON does
not cover every later OS failure, C-compiler message or runtime failure; those
streams must remain visible as original text.

Useful fields are `kind`, `code`, `message`, `file`, `line`, `column`,
`end_line`, `end_column`, `offset`, `length`, `hint`, `explain`, `mode`,
`related` and `imports`. Ranges are half-open. `offset` and `length` count
UTF-8 bytes from the start of the original source; line and column begin at one
and the column also counts UTF-8 bytes. Tabs count as one byte. `excerpt`,
`caret` and `underline_width` are display data, possibly clipped, not model
coordinates.

Monaco counts UTF-16 code units. The adapter locates the original source file,
clamps byte boundaries, counts newlines before the offset, and UTF-16 units from
the last newline. Tabs remain one model character. The original JSON and message
are retained so the editor marker does not replace evidence from the compiler.

A verified probe was:

```go
func main() {
	println("Привет 🪨"); println(missing)
}
```

Kremen reports `E107`, line 2, byte column 40, `offset: 53`, `length: 7`.
The correct Monaco range is line 2, columns **32–39**, not byte columns 40–47
or the excerpt's display caret 33. Offline `kremen explain E107` supplies the
general explanation while the original message names `missing`.

## Files, imports and resources

Projects consist of `.kr` implementations and optional paired `.krh` API
headers. Imports resolve relative to the importing file, with no downloads.
Import the implementation or module directory, not a header. `--root` must
contain the canonical entry module and every loaded source. Cycles and source
or header symlink escapes are rejected. This compiler source-loading rule does
not restrict filesystem access by compiled programs; the application runner
adds a separate OS sandbox.

`build`, `run` and `emit-c` need `runtime/kremen_rt.h`. Runtime discovery checks
installed locations relative to the executable, including
`../share/kremen/runtime/kremen_rt.h` and `../runtime/kremen_rt.h`. The app
bundles `toolchain/bin/kremen` beside `toolchain/runtime/kremen_rt.h`.
`check`, `fmt` and the built-in `explain` catalog do not need that runtime file.
The catalog contains 45 diagnostic categories including `E015` and `L001–L005`.

`readIntResult()` error codes are a separate domain: 1 EOF, 2 malformed integer,
3 outside the i64 range, 4 stream failure. They are not OS `errno`. Filesystem
and worker operations use OS error numbers; `errorMessage` describes those.

## Evidence and limits

This environment built and ran the real compiler on Linux x86-64 with GCC.
Direct checks covered check/learn, build with `-O0`, generated binary execution,
`emit-c`, formatter stdout, offline explanation, JSON diagnostics and the
Unicode/tab probe. Upstream diagnostic, profile, security, input and tutorial
regression results are recorded in [verification](VERIFICATION.md).

The upstream release validation document is useful background, but its reported
836 checks are not automatically attributed to this application session. Only
commands actually rerun here are listed as new evidence. No Windows build or
execution, sanitizer rerun or exhaustive language validation is implied.
