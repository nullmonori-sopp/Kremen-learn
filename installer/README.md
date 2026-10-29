# Native offline installer

The Linux installer is a C++17 executable with a POSIX ustar payload appended to
its ELF image. It needs no server, administrator privileges, Python, Node.js,
archive utility, or crypto library at installation time. The builder needs GCC
or another C++17 compiler, GNU tar and sha256sum.

The installer verifies the entire embedded archive against its compiled-in
SHA-256 digest before extracting it. Its internal archive reader checks header
checksums, refuses absolute paths, `..`, links, special files and control
characters, and extracts only into a new private staging directory. Executable
bits are retained; setuid, setgid and write access for other users are discarded.
The digest detects corruption; the release itself must still be obtained from a
trusted source. This first release is not code-signed.

Build after `npm run package`:

```sh
./scripts/build-installer.sh
```

An optional first argument supplies a prepared payload directory; a second
argument selects the output file. The archive must contain:

```text
kremen-learn
toolchain/bin/kremen
toolchain/runtime/kremen_rt.h
content/catalog.json
```

The installer checks for GCC, Bubblewrap and WebKitGTK 4.1. These operating-system
components are not bundled and are never downloaded or installed automatically.
The dependency report is advisory: installation remains possible before the
administrator adds missing packages. The application's toolchain panel reports
whether compiling and sandboxing are actually available.

Run:

```sh
chmod +x Kremen-Learn-0.1.0-linux-x86_64.run
./Kremen-Learn-0.1.0-linux-x86_64.run
```

Use `--yes` for unattended installation, `--check` for the dependency report,
`--verify` to verify the archive without installing, and `--prefix /absolute/path`
to choose a different per-user prefix. No system-wide install mode is provided.

The default installation creates:

```text
~/.local/share/kremen-learn/releases/<version>-<digest>-<process-id>/
~/.local/bin/kremen-learn
~/.local/share/applications/org.kremen.learn.desktop
```

The launcher is a symlink to the installed executable. Each installation has a
separate release directory. Earlier releases remain on disk until uninstall;
they are not automatic backups of your projects or progress. Re-running the
installer updates the launcher to the newly verified release.

Remove installed binaries with the same installer:

```sh
./Kremen-Learn-0.1.0-linux-x86_64.run --uninstall
```

Removal only touches this installer's marked application directory and managed
launchers. It preserves the application's separate data directory and projects
saved elsewhere. Supply the same `--prefix` if one was used for installation.

There is no Windows installer in this release. An executable compiled for Linux
is not a Windows package; Windows and WSL require separate implementation and
validation.

Run `python3 installer/test_installer.py` to verify the installer independently.
The test builds real installer executables and checks installation to a prefix
containing spaces and shell metacharacters, launching, reinstallation,
uninstallation with user-data preservation, corrupt payload rejection, and
rejection of traversal paths, absolute paths and symlink archive entries. It
uses a small fixture executable, not the actual desktop application; launching
the installed desktop release is a separate release check.
