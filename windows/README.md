# Experimental WSLg scripts

[Русский](README.ru.md)

These PowerShell 7.3+ scripts install and start the **Linux** package in an
already configured **x86-64 Debian 13+ WSL2 distribution with WSLg**. They are
not a native Windows application or `.exe` installer. They have not been run
on a Windows host in this environment. WSL process invocation, display,
permissions, filesystem conversion, namespace support and dialogs remain
unverified Windows integration points.

Prepare WSL2/WSLg and Debian yourself; no script enables Windows features,
installs or converts a distribution, downloads packages or changes system
policies. Inside Debian, supply the runtime dependencies described in
[development](../docs/DEVELOPMENT.md): WebKitGTK4.1, GTK3, GCC/libc development
files and Bubblewrap. WSL must allow Bubblewrap namespaces; failing checks
abort installation/startup. Merely having WSL or a `bwrap` executable is
insufficient.

Keep all three `.ps1` files together. Place the Linux `.run` installer beside
them or pass its path explicitly. In PowerShell 7.3+:

```powershell
./Install-KremenLearn.ps1 -Distribution Debian -Installer 'C:\Downloads\Kremen-Learn-0.1.0-linux-x86_64.run'
./Start-KremenLearn.ps1 -Distribution Debian
```

Every Linux command is invoked with `wsl.exe --distribution NAME --exec` and
separate `ProcessStartInfo.ArgumentList` entries. No generated `bash -c` or
PowerShell expression contains a user path. The installer path is converted
with `wslpath`, then copied into a fresh Linux temporary directory, verified
by the C++ installer and installed under the Linux user's `~/.local`.
The temporary directory is removed afterward. Progress and projects live in
the Linux distribution; these scripts do not silently map a Windows project
folder into an exercise sandbox.

Uninstall using the same Linux `.run` installer inside the distribution with
`--uninstall --prefix /home/YOUR_LINUX_USER/.local`. See the
[installer guide](../installer/README.md); application data is preserved.

Static source review does not establish Windows runtime support. A release
must be tested on Windows, including installation, launch, actual compile/run,
Stop, diagnostics, persistence, WSL shutdown/restart, paths with spaces and
non-ASCII text, and file dialogs, before advertising this route as supported.
