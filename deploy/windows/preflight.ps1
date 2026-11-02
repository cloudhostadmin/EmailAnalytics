<#
  EmailAnalytics pre-flight check for the shared Gita Press Windows server.

  READ ONLY: it only looks. It installs, changes, starts, stops and restarts nothing,
  and does not touch IIS, the other projects, their services or their files.

  Run in PowerShell as Administrator, in the folder where this file is:
      powershell -ExecutionPolicy Bypass -File .\preflight.ps1

  The report is also saved on the Desktop as emailanalytics-preflight.txt
#>
$ErrorActionPreference = 'SilentlyContinue'
$report = Join-Path ([Environment]::GetFolderPath('Desktop')) 'emailanalytics-preflight.txt'
Start-Transcript -Path $report -Force | Out-Null
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
function H($t) { Write-Output ''; Write-Output "===== $t =====" }
function Expand($p) { [Environment]::ExpandEnvironmentVariables([string]$p) }

H 'Server'
$os = Get-CimInstance Win32_OperatingSystem
"{0} | PowerShell {1} | RAM free {2:N1} GB of {3:N1} GB" -f $os.Caption, $PSVersionTable.PSVersion, ($os.FreePhysicalMemory / 1MB), ($os.TotalVisibleMemorySize / 1MB)
Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used } | ForEach-Object { "Drive {0}: {1:N1} GB free" -f $_.Name, ($_.Free / 1GB) }
"Server IPv4: " + ((Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' }).IPAddress -join ', ')
"gitapress.in resolves to: " + ((Resolve-DnsName gitapress.in -Type A | Where-Object { $_.IPAddress }).IPAddress -join ', ')

H 'IIS modules (URL Rewrite, ARR)'
Import-Module WebAdministration
$mods = Get-WebGlobalModule | Where-Object { $_.Name -match 'Rewrite|ApplicationRequestRouting' }
if ($mods) { $mods | ForEach-Object { "installed: $($_.Name)" } } else { 'URL Rewrite / ARR: NOT installed' }

H 'ARR proxy settings (server-wide)'
& $appcmd list config -section:system.webServer/proxy

H 'Server-level (global) rewrite rules'
& $appcmd list config -section:system.webServer/rewrite/globalRules

H 'IIS sites and bindings'
Get-Website | ForEach-Object {
	"{0} [{1}] pool={2} path={3}" -f $_.Name, $_.State, $_.applicationPool, $_.physicalPath
	$_.bindings.Collection | ForEach-Object { "    binding: $($_.protocol) $($_.bindingInformation)" }
}

H 'Applications inside sites'
Get-WebApplication | ForEach-Object {
	$site = ([regex]"@name='([^']+)'").Match($_.ItemXPath).Groups[1].Value
	"{0}{1} -> {2}  pool={3}" -f $site, $_.path, $_.PhysicalPath, $_.applicationPool
}

H 'App pools (and which sites share them)'
$sites = @(Get-Website)
$apps = @(Get-WebApplication)
Get-ChildItem IIS:\AppPools | ForEach-Object {
	$n = $_.Name
	$users = @($sites | Where-Object { $_.applicationPool -eq $n } | ForEach-Object { $_.Name }) + @($apps | Where-Object { $_.applicationPool -eq $n } | ForEach-Object { $_.path })
	"{0} [{1}] clr='{2}' used by: {3}" -f $n, $_.State, $_.managedRuntimeVersion, ($users -join ', ')
}

H 'The gitapress.in site'
$gp = @($sites | Where-Object { ($_.bindings.Collection | ForEach-Object { $_.bindingInformation }) -match ':(www\.)?gitapress\.in$' })
if ($gp.Count -eq 0) { 'No IIS site on this server has a gitapress.in binding.' }
foreach ($s in $gp) {
	$root = Expand $s.physicalPath
	"site: $($s.Name)   root folder: $root"
	"existing /emailanalytics application: " + [bool](Get-WebApplication -Site $s.Name -Name 'emailanalytics')
	"existing emailanalytics folder in root: " + (Test-Path (Join-Path $root 'emailanalytics'))
	$wc = Join-Path $root 'web.config'
	if (Test-Path $wc) {
		"root web.config: $wc"
		Select-String -Path $wc -Pattern '<rule |<action |<clear|outboundRules|iisnode|httpPlatform|aspNetCore|customHeaders|<location|<handlers|<modules' | ForEach-Object { "    line $($_.LineNumber): " + $_.Line.Trim() }
	} else { 'root web.config: none' }
}

H 'Node.js, npm, Git, NSSM, PM2, psql'
foreach ($c in 'node', 'npm', 'git', 'nssm', 'pm2', 'psql') {
	$cmd = Get-Command $c | Select-Object -First 1
	if ($cmd) { "{0}: {1}" -f $c, $cmd.Source } else { "{0}: not found" -f $c }
}
if (Get-Command node) { 'node version: ' + (node -v) }
if (Get-Command git) { git --version }

H 'Running Node processes (other projects)'
$np = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'")
if ($np.Count -eq 0) { 'none' }
$np | ForEach-Object {
	$cl = [string]$_.CommandLine
	if ($cl.Length -gt 160) { $cl = $cl.Substring(0, 160) + '...' }
	"PID {0}: {1}" -f $_.ProcessId, $cl
}

H 'Windows services for apps and databases'
Get-CimInstance Win32_Service | Where-Object { $_.PathName -match 'nssm|node|postgres|pm2|winsw|java|python' -or $_.Name -match 'EmailAnalytics|postgres|MSSQL|MySQL' } | ForEach-Object {
	$p = [string]$_.PathName
	if ($p.Length -gt 140) { $p = $p.Substring(0, 140) + '...' }
	"{0} [{1}] {2}" -f $_.Name, $_.State, $p
}
"Service name 'EmailAnalytics' already taken: " + [bool](Get-Service -Name 'EmailAnalytics')

H 'PostgreSQL'
$pg = @(Get-Service -Name '*postgres*')
if ($pg.Count -eq 0) { 'No PostgreSQL service installed' } else { $pg | ForEach-Object { "service: $($_.Name) [$($_.Status)]" } }
$listen = @(Get-NetTCPConnection -State Listen)
$listen | Where-Object { $_.LocalPort -in 5432, 5433, 5434 } | ForEach-Object { "listening on $($_.LocalAddress):$($_.LocalPort) (pid $($_.OwningProcess))" }

H 'Ports 8888-8899 (for the Node app)'
foreach ($port in 8888..8899) {
	$l = $listen | Where-Object { $_.LocalPort -eq $port } | Select-Object -First 1
	if ($l) { "port {0}: IN USE by {1} (pid {2})" -f $port, (Get-Process -Id $l.OwningProcess).ProcessName, $l.OwningProcess } else { "port {0}: free" -f $port }
}
'Ports 8888-8899 named in any IIS site/application web.config (even if that app is stopped):'
$paths = @($sites | ForEach-Object { Expand $_.physicalPath }) + @($apps | ForEach-Object { Expand $_.PhysicalPath })
$hits = @($paths | Sort-Object -Unique | ForEach-Object { Join-Path $_ 'web.config' } | Where-Object { Test-Path $_ } | ForEach-Object { Select-String -Path $_ -Pattern '(localhost|127\.0\.0\.1):88(8[89]|9\d)\b' })
if ($hits.Count -eq 0) { '    none' } else { $hits | ForEach-Object { "    $($_.Path) line $($_.LineNumber): $($_.Line.Trim())" } }

H 'Folders this setup would use'
"C:\apps exists: " + (Test-Path 'C:\apps')
if (Test-Path 'C:\apps') { Get-ChildItem 'C:\apps' -Directory | ForEach-Object { "    C:\apps\$($_.Name)" } }
"C:\apps\EmailAnalytics exists: " + (Test-Path 'C:\apps\EmailAnalytics')
"C:\inetpub\emailanalytics-proxy exists: " + (Test-Path 'C:\inetpub\emailanalytics-proxy')

H 'IIS configuration backups'
& $appcmd list backup

Stop-Transcript | Out-Null
Write-Host ''
Write-Host "Done. Nothing was changed. Report saved to: $report" -ForegroundColor Green
