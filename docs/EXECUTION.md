# Local execution and isolation model

[Русский](EXECUTION.ru.md) · [Platforms](PLATFORMS.md)

## Boundary

Rust receives a complete source snapshot through Tauri IPC and runs blocking
work on a worker thread, outside the UI thread. Process arguments are passed
as individual strings to `std::process::Command`; source code, project names,
stdin and user paths are never concatenated into a shell command.

Every compiler invocation and program execution on Linux runs through
Bubblewrap. The runner requires `/usr/bin/bwrap`; failure to create isolation
returns an error instead of falling back to unrestricted execution. Work and
Learn both use this isolation boundary. This implementation deliberately does
not grant free projects unrestricted access to the user's home or network.

Bubblewrap uses `--unshare-all`, `--die-with-parent`, dropped capabilities and
a cleared environment. It provides private user, mount, PID, IPC, UTS and
network namespaces. The child sees:

| Path | Access |
| --- | --- |
| `/usr`, existing `/lib`, `/lib64`, `/bin` | Read-only system executables, headers, libraries and other system files |
| `/etc/ld.so.cache` if present | Read-only dynamic-loader cache |
| `/toolchain` | Read-only bundled compiler/runtime |
| `/work` | Writable staged project/test directory, also the working directory |
| `/tmp` | Private temporary filesystem |
| `/proc`, `/dev` | Namespace proc filesystem and synthetic minimal devices |

The user's home, host working folders, desktop sockets and network are not
bound into the namespace. The loopback/network namespace is separate from the
host; there is no host network route. Only the staged source snapshot is given
to the compiler. Files created by an exercise stay inside its temporary work
directory; project persistence is handled by trusted native code separately.

This is OS-level process isolation using the host kernel, not a virtual
machine. Read-only system files under `/usr` remain readable. Kernel exploits
and hostile system toolchains are outside the guarantee. No claim of a
complete security proof or container-image isolation is made.

## Resource controls

The implementation uses different compile and runtime limits:

| Control | Compile phase | Program phase |
| --- | ---: | ---: |
| Wall-clock deadline | 30 seconds | 2 seconds by default; tests select bounded values |
| Virtual address space (`RLIMIT_AS`) | 768 MiB per process | 256 MiB per process |
| CPU time (`RLIMIT_CPU`) | 25 seconds per process | 5 seconds per process |
| Real-UID tasks (`RLIMIT_NPROC`) | Observed baseline + 128 | Observed baseline + 128 |
| Open files (`RLIMIT_NOFILE`) | 128 per process | 128 per process |
| File size (`RLIMIT_FSIZE`) | 8 MiB per file | 8 MiB per file |
| Captured stdout + stderr | 64 KiB default per phase | 64 KiB default; test cap can be lower |

These are resource ceilings, separate from filesystem/network access controls.
Address-space and CPU limits are per process, not a cgroup-wide aggregate.
`RLIMIT_NPROC` is enforced by Linux for the real user identity. Before starting,
the runner counts current tasks for that UID and sets the ceiling to that
baseline plus 128, capped by the inherited hard limit. Other applications share
this accounting; this is not an independent process quota for each exercise. The file-size limit is
per file, not a total disk quota. A memory limit is virtual address space,
not an exact measured RSS allocation. These distinctions matter when assessing
the boundary.

Output is read concurrently from both pipes into bounded buffers. A wall
clock, output overflow or Stop request kills the PID-namespace init process
identified by Bubblewrap’s `--info-fd` channel. The kernel tears down every
namespace descendant, including processes that created their own sessions.
The application uses a Linux child subreaper and waits for the exact namespace
helper after the supervisor exits, preventing orphaned zombie accumulation. The UI reports an unsuccessful
operation when compilation or execution fails; a crashed program does not
terminate the application.

## Staging and tests

Project paths must be relative normal components. Absolute paths, `..`, Windows
separators/drive forms and unsupported extensions are rejected. A source
snapshot contains 1–128 `.kr`/`.krh` files and at most 4 MiB of source text.
A fresh `TempDir` is used rather than compiling in the user's original folder.
Kremen additionally receives an explicit project root so imports cannot leave
that snapshot.

Each test starts independently from a new staged directory and input. Expected
stdout, stderr, exit status, optional created files and expected compile-error
codes are compared as the lesson format defines. Failure does not remove an
already completed lesson. Tests are reproducible for the specified input and
source snapshot; the application does not claim to make arbitrary time-,
randomness- or scheduling-dependent programs deterministic. Local tests are
inspectable source data and are not used as a secrecy or anti-cheating system.

The native adapter retains original stderr. It only converts genuine frontend
JSON diagnostics into editor markers; backend and runtime output can be text.
Build and execution are separate phases so their exit statuses and limits are
not confused. See [the compiler audit](COMPILER-AUDIT.md).

## Windows

The non-Linux execution function refuses the operation. No native Windows
access sandbox or in-app WSL process bridge is implemented or verified. The
optional PowerShell scripts launch the complete Linux app through WSLg and are
explicitly experimental and untested on a Windows host.
See [platform status](PLATFORMS.md); a Windows Job Object or a timeout alone
would not satisfy the access restrictions documented for Linux.
