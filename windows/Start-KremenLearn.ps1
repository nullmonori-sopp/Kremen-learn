#requires -Version 7.3
[CmdletBinding()]
param([ValidateNotNullOrEmpty()][string] $Distribution = 'Debian')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'WslCommon.ps1')

Write-Host 'Starting Linux Kremen Learn through WSLg. Experimental; not verified on a Windows host.'
Write-Host 'Запуск Linux-версии через WSLg. Экспериментальный вариант, Windows-хост не проверен.'
$homePath = Get-KremenWslHome -Distribution $Distribution
Test-KremenWslDependencies -Distribution $Distribution
Invoke-KremenWsl -Distribution $Distribution -Arguments @('/usr/bin/test', '-x', "$homePath/.local/bin/kremen-learn") | Out-Null
Invoke-KremenWsl -Distribution $Distribution -Arguments @("$homePath/.local/bin/kremen-learn") -Passthrough
