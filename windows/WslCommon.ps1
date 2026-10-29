#requires -Version 7.3
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-KremenWsl {
    param(
        [Parameter(Mandatory)][string] $Distribution,
        [Parameter(Mandatory)][string[]] $Arguments,
        [switch] $Passthrough
    )
    $wsl = (Get-Command wsl.exe -CommandType Application -ErrorAction Stop).Source
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $wsl
    $info.UseShellExecute = $false
    $info.ArgumentList.Add('--distribution')
    $info.ArgumentList.Add($Distribution)
    $info.ArgumentList.Add('--exec')
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    if (-not $Passthrough) {
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
    }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'Unable to start wsl.exe.' }
        if ($Passthrough) {
            $process.WaitForExit()
            if ($process.ExitCode -ne 0) { throw "WSL process exited with code $($process.ExitCode)." }
            return
        }
        # Drain both pipes asynchronously so neither can block the process.
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $outputText = $stdout.GetAwaiter().GetResult()
        $errorText = $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            throw "WSL command exited with code $($process.ExitCode): $errorText"
        }
        return $outputText.TrimEnd("`r", "`n")
    } finally { $process.Dispose() }
}

function Get-KremenWslHome {
    param([Parameter(Mandatory)][string] $Distribution)
    $kernel = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/uname', '-r')
    if ($kernel -notmatch '(?i)WSL2') {
        throw 'This experimental launcher requires WSL2. It does not install or convert distributions.'
    }
    $architecture = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/uname', '-m')
    if ($architecture -ne 'x86_64') { throw 'The supplied Linux package requires x86-64.' }
    $release = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/cat', '/etc/os-release')
    $fields = @{}
    foreach ($line in ($release -split "`n")) {
        if ($line -match '^([A-Z_]+)=(.*)$') {
            $fields[$Matches[1]] = $Matches[2].Trim().Trim('"')
        }
    }
    if (-not $fields.ContainsKey('ID') -or $fields['ID'] -ne 'debian' -or
        -not $fields.ContainsKey('VERSION_ID') -or $fields['VERSION_ID'] -notmatch '^\d+(?:\.\d+)?$' -or
        [int]($fields['VERSION_ID'].Split('.')[0]) -lt 13) {
        throw 'This package targets Debian 13 or newer. Other distributions need their own verified build.'
    }
    Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/test', '-d', '/mnt/wslg') | Out-Null
    $homePath = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/printenv', 'HOME')
    if (-not $homePath.StartsWith('/') -or $homePath -match '[\x00-\x1f\x7f]') {
        throw 'WSL returned an invalid Linux home directory.'
    }
    return $homePath.TrimEnd('/')
}

function Test-KremenWslDependencies {
    param([Parameter(Mandatory)][string] $Distribution)
    Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/gcc', '--version') | Out-Null
    Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/bwrap', '--version') | Out-Null
    $libraries = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/sbin/ldconfig', '-p')
    if ($libraries -notmatch 'libwebkit2gtk-4\.1\.so') {
        throw 'WebKitGTK 4.1 is missing. Prepare the Linux dependencies first; this script does not download them.'
    }
    # A binary alone does not prove namespaces work. The application repeats its own readiness probe.
    Invoke-KremenWsl -Distribution $Distribution -Arguments @(
        '/usr/bin/bwrap', '--unshare-all', '--die-with-parent', '--cap-drop', 'ALL',
        '--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib', '--ro-bind', '/lib64', '/lib64',
        '--proc', '/proc', '--dev', '/dev', '/usr/bin/true'
    ) | Out-Null
}
