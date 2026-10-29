#requires -Version 7.3
[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()][string] $Distribution = 'Debian',
    [string] $Installer
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'WslCommon.ps1')

Write-Host 'Kremen Learn: experimental Linux installation inside existing WSL2 / WSLg.'
Write-Host 'This is not a native Windows package. Windows-host execution has not been validated.'
Write-Host 'Экспериментальная установка Linux-версии в существующий WSL2 / WSLg; Windows не проверена.'

if ([string]::IsNullOrWhiteSpace($Installer)) {
    $Installer = Join-Path $PSScriptRoot 'Kremen-Learn-0.1.0-linux-x86_64.run'
    if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) {
        $Installer = Join-Path $PSScriptRoot '../artifacts/Kremen-Learn-0.1.0-linux-x86_64.run'
    }
}
$resolvedInstaller = (Resolve-Path -LiteralPath $Installer -ErrorAction Stop).Path
$homePath = Get-KremenWslHome -Distribution $Distribution
Test-KremenWslDependencies -Distribution $Distribution
$linuxInstaller = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/wslpath', '-a', '-u', $resolvedInstaller)
if (-not $linuxInstaller.StartsWith('/') -or $linuxInstaller -match '[\x00-\x1f\x7f]') {
    throw 'wslpath returned an invalid installer path.'
}
$stage = Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/mktemp', '-d', '/tmp/kremen-learn-wsl.XXXXXXXX')
if ($stage -notmatch '^/tmp/kremen-learn-wsl\.[A-Za-z0-9]+$') { throw 'Invalid temporary directory returned by WSL.' }
try {
    $stagedInstaller = "$stage/installer.run"
    Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/cp', '--', $linuxInstaller, $stagedInstaller) | Out-Null
    Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/chmod', '700', $stagedInstaller) | Out-Null
    Invoke-KremenWsl -Distribution $Distribution -Arguments @($stagedInstaller, '--verify') -Passthrough
    Invoke-KremenWsl -Distribution $Distribution -Arguments @($stagedInstaller, '--yes', '--prefix', "$homePath/.local") -Passthrough
} finally {
    Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/rm', '-rf', '--', $stage) | Out-Null
}
Write-Host "Installed in distribution '$Distribution'. Start with Start-KremenLearn.ps1 -Distribution `"$Distribution`"."
