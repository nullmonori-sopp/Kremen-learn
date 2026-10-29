#!/usr/bin/env python3
"""Exercise the compiled installer with temporary, deliberately small payloads."""
import hashlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(*args: object, success: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run([str(x) for x in args], text=True, capture_output=True)
    if (result.returncode == 0) != success:
        raise AssertionError(f"Unexpected exit {result.returncode}: {args}\n{result.stdout}\n{result.stderr}")
    return result


def bundle_archive(archive: Path, output: Path) -> None:
    data = archive.read_bytes()
    executable = output.with_suffix(".elf")
    run("g++", "-std=c++17", "-O2", "-Wall", "-Wextra", "-Wpedantic", "-Werror",
        f"-DKREMEN_PAYLOAD_SIZE={len(data)}",
        f'-DKREMEN_PAYLOAD_SHA256="{hashlib.sha256(data).hexdigest()}"',
        ROOT / "installer/installer.cpp", "-ldl", "-o", executable)
    output.write_bytes(executable.read_bytes() + data)
    output.chmod(0o755)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="kremen-installer-test-") as temp:
        directory = Path(temp)
        payload = directory / "payload"
        (payload / "toolchain/bin").mkdir(parents=True)
        (payload / "toolchain/runtime").mkdir(parents=True)
        (payload / "content").mkdir()
        shutil.copy2("/usr/bin/true", payload / "kremen-learn")
        shutil.copy2("/usr/bin/true", payload / "toolchain/bin/kremen")
        (payload / "toolchain/runtime/kremen_rt.h").write_text("/* test fixture */\n")
        (payload / "content/catalog.json").write_text('{"schemaVersion":1,"courses":[],"lessons":[]}\n')
        installer = directory / "Kremen-Learn.run"
        run(ROOT / "scripts/build-installer.sh", payload, installer)
        run(installer, "--verify")
        prefix = directory / "prefix with spaces 'quotes' $dollar `ticks` %percent"
        run(installer, "--yes", "--prefix", prefix)
        launcher = prefix / "bin/kremen-learn"
        assert launcher.is_symlink()
        run(launcher)
        desktop = prefix / "share/applications/org.kremen.learn.desktop"
        assert '%%percent' in desktop.read_text()
        # Reinstallation uses a distinct release and atomically changes the launcher.
        previous = launcher.resolve()
        run(installer, "--yes", "--prefix", prefix)
        assert launcher.resolve() != previous
        assert previous.is_file()
        progress = prefix / "share/org.kremen.learn/progress.sqlite"
        progress.parent.mkdir(parents=True)
        progress.write_text("preserve this user data")
        run(installer, "--uninstall", "--yes", "--prefix", prefix)
        assert not launcher.exists() and not launcher.is_symlink()
        assert not desktop.exists()
        assert not (prefix / "share/kremen-learn").exists()
        assert progress.read_text() == "preserve this user data"

        corrupt = directory / "corrupt.run"
        content = bytearray(installer.read_bytes())
        content[-1] ^= 1
        corrupt.write_bytes(content)
        corrupt.chmod(0o755)
        assert "SHA-256 mismatch" in run(corrupt, "--verify", success=False).stderr

        # Even a correctly hashed archive must not extract traversal or links.
        for label, name, kind in [("traversal", "../escaped", tarfile.REGTYPE),
                                  ("absolute", "/tmp/kremen-escaped", tarfile.REGTYPE),
                                  ("symlink", "link", tarfile.SYMTYPE)]:
            archive = directory / f"{label}.tar"
            with tarfile.open(archive, "w", format=tarfile.USTAR_FORMAT) as tar:
                info = tarfile.TarInfo(name)
                info.type = kind
                if kind == tarfile.SYMTYPE:
                    info.linkname = "/tmp"
                    tar.addfile(info)
                else:
                    info.size = 4
                    tar.addfile(info, io.BytesIO(b"evil"))
            malicious = directory / f"{label}.run"
            bundle_archive(archive, malicious)
            target = directory / f"{label}-prefix"
            run(malicious, "--yes", "--prefix", target, success=False)
            assert not list((target / "share/kremen-learn/releases").glob(".stage-*"))
            assert not (target / "share/kremen-learn/releases/escaped").exists()
        assert not (directory / "escaped").exists()
        print("PASS: install, executable launcher, reinstall, uninstall/data preservation, corruption, traversal, absolute path and symlink rejection")


if __name__ == "__main__":
    main()
