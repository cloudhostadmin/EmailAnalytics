# Hosting on the Gita Press Windows Server at gitapress.in/emailanalytics

This replaces Netlify with the Windows server that already hosts the other Gita Press sites.

```
Browser ──https──> IIS site "gitapress.in"
                     └─ /emailanalytics  (IIS application, own app pool, only a web.config: URL Rewrite + ARR)
                           └─ proxy ──> Node.js on 127.0.0.1:8888   (Windows service "EmailAnalytics", npm start)
                                           ├─ app pages  (dist/, built with BASE_PATH=/emailanalytics/)
                                           ├─ REST API   (/api/*)
                                           ├─ worker     (mail sync, AI analysis, alerts, reports: every 5 minutes)
                                           └─ PostgreSQL on 127.0.0.1:5432
```

The app folder (`C:\apps\EmailAnalytics`, with the `.env`) is **outside** every IIS site folder, so IIS can never serve the `.env` file. Only Node reads it.

Paths and names below are suggestions; if you change one, change it everywhere it appears.

---

## Shared server: what this setup touches

The server also runs other projects, so everything here is either separate from them or checked first.

| Part | Effect on other projects |
|---|---|
| App folder `C:\apps\EmailAnalytics`, its `node_modules`, `.env`, logs | Separate. `npm ci` installs only inside this folder; nothing is installed globally. |
| Windows service `EmailAnalytics` (NSSM) | Separate service with its own name. |
| Node app on `127.0.0.1:8888` | Listens on localhost only; no firewall port is opened. The pre-flight check confirms the port is free and not named by another site. |
| PostgreSQL | If PostgreSQL already runs here, a **new user and database** are added inside it; other databases are not touched. If not, it is installed listening on localhost. |
| IIS `/emailanalytics` application | Its own folder and its own app pool. Its `web.config` applies only to `/emailanalytics/*`; the gitapress.in website and all other sites keep their own settings. |
| IIS ARR "Enable proxy" (server-wide) | Only switched on if it is off, and only that one setting. The proxy time-out is **not** changed: "Sync now" runs in the background and the request returns at once. |
| Node.js | If another project already uses Node 20.6 or newer, it is reused. If its version is older, it is **not upgraded**; a separate portable Node is used for this app only. |

Two safety nets: the read-only pre-flight check before anything is installed (step 0), and an IIS configuration backup before IIS is changed (step 5), with the undo steps at the end of this guide.

---

## 0. Pre-flight check (read only)

Copy `deploy\windows\preflight.ps1` to the server and run it in PowerShell as Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File .\preflight.ps1
```

It changes nothing. It lists the IIS sites and app pools, whether URL Rewrite and ARR are installed and how the proxy is set, the gitapress.in site and its `web.config` rules, Node/Git/NSSM/PM2/PostgreSQL already on the server, which ports from 8888 to 8899 are in use or named by another site, and free RAM and disk. The report is saved on the Desktop as `emailanalytics-preflight.txt`.

Use the report to decide the rest:

* **Port:** if 8888 is in use or appears in another site's `web.config`, pick a free one from the list and use it for `PORT` in `.env` (step 3) and in the IIS `web.config` (step 5).
* **gitapress.in:** if no IIS site has a gitapress.in binding, this server does not serve gitapress.in, and the `/emailanalytics` path has to be forwarded from wherever it is hosted. Sort that out before going further.
* **Existing `/emailanalytics`:** if the gitapress.in site already has an `emailanalytics` folder or application, choose another name.

---

## 1. Install only what is missing

| Software | Use the existing one if the pre-flight shows | Otherwise |
|---|---|---|
| Node.js | `node version` 20.6 or newer | If Node is **not found**: install the current LTS from nodejs.org (.msi). If it is **older than 20.6**: do not upgrade it (other projects depend on it). Download the Windows **.zip** (x64) of the current LTS from nodejs.org and extract it to `C:\apps\node` (the folder that contains `node.exe`). |
| Git for Windows | `git: …` | git-scm.com |
| PostgreSQL | a postgres service | enterprisedb.com Windows installer, 16 or newer. Keep the port it offers (5432, or 5433 if 5432 is taken). |
| URL Rewrite 2.1 + ARR 3.0 | `installed: RewriteModule` and `installed: ApplicationRequestRouting` | iis.net. Installing them restarts IIS briefly (all sites for a few seconds), so do it at a quiet time. |
| NSSM | `nssm: …` | nssm.cc → copy `win64\nssm.exe` to `C:\tools\nssm\` |

**Only if you are using the portable Node in `C:\apps\node`:** in every PowerShell window you use for this app, first run

```powershell
$env:Path = "C:\apps\node;" + $env:Path
```

This changes PATH for that window only, not for the server or other projects. In step 4 use `C:\apps\node\node.exe` instead of `C:\Program Files\nodejs\node.exe`.

---

## 2. Database

Open **SQL Shell (psql)** (or pgAdmin) as the `postgres` user and run (choose your own strong password):

```sql
CREATE USER gitamail WITH PASSWORD 'ChooseAStrongPassword';
CREATE DATABASE gitamail OWNER gitamail;
```

This only adds a new user and database; other databases on the same PostgreSQL are untouched (if a `gitamail` user or database already exists, pick another name). The tables are created automatically the first time the app starts. The app needs the `pgcrypto` extension, which ships with PostgreSQL and which the database owner is allowed to enable.

Do **not** open port 5432 in Windows Firewall; the app connects over 127.0.0.1.

**Already running elsewhere with data you want to keep?** Copy it across with `pg_dump` / `pg_restore`, and keep the **same `ENCRYPTION_KEY`** in the new `.env`, otherwise saved Gmail connections and the uploaded service account key cannot be read and have to be reconnected. (Alternatively keep the existing `DATABASE_URL` and skip this step.)

---

## 3. Put the app on the server

```powershell
mkdir C:\apps -ErrorAction SilentlyContinue
cd C:\apps
git clone https://github.com/cloudhostadmin/EmailAnalytics.git
cd EmailAnalytics
mkdir logs
copy .env.example .env      # or copy your existing .env here
notepad .env
```

In `.env`, set or change these lines (everything else stays as it was):

```ini
APP_URL=https://gitapress.in/emailanalytics
BASE_PATH=/emailanalytics/
PORT=8888
HOST=127.0.0.1
DATABASE_URL=postgres://gitamail:ChooseAStrongPassword@127.0.0.1:5432/gitamail
```

* `APP_URL` has no trailing slash. It is used for Google sign-in, password reset links and links in alert and digest emails.
* `BASE_PATH` must be set **before** building, because it is written into the app's pages.
* `PORT`: the free port chosen from the pre-flight report.
* `DATABASE_URL`: use 5433 instead of 5432 if that is the port your PostgreSQL uses. If the password contains `@ : / # ? %`, write those characters URL-encoded (`@` → `%40`, `#` → `%23`, `%` → `%25`).
* Remove `NETLIFY_DB_URL` if your old `.env` has it.
* `JWT_SECRET`, `ENCRYPTION_KEY`, `INTERNAL_API_SECRET`: if you are starting fresh, generate each one in PowerShell:
  `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { '{0:x2}' -f $_ })`

Install, build and do a test run:

```powershell
npm ci
npm run build:web
npm start
```

In another window: `curl.exe http://127.0.0.1:8888/api/health` should return JSON with `database_connection` and `database_tables` ok. Stop the test run with Ctrl+C.

---

## 4. Run it as a Windows service (starts with the server, restarts if it crashes)

Run PowerShell **as Administrator** (use `C:\apps\node\node.exe` if you are on the portable Node, and the full path to `nssm.exe` if it is not on PATH):

```powershell
nssm install EmailAnalytics "C:\Program Files\nodejs\node.exe"
nssm set EmailAnalytics AppParameters "--env-file=.env --import tsx scripts/serve.ts"
nssm set EmailAnalytics AppDirectory "C:\apps\EmailAnalytics"
nssm set EmailAnalytics AppStdout "C:\apps\EmailAnalytics\logs\service.log"
nssm set EmailAnalytics AppStderr "C:\apps\EmailAnalytics\logs\service.log"
nssm set EmailAnalytics AppRotateFiles 1
nssm set EmailAnalytics AppRotateOnline 1
nssm set EmailAnalytics AppRotateBytes 10485760
nssm set EmailAnalytics Start SERVICE_AUTO_START
nssm start EmailAnalytics
```

`nssm status EmailAnalytics` shows whether it is running; the log is `C:\apps\EmailAnalytics\logs\service.log`.

Run only **one** copy of the app: the background worker is inside the same process.

---

## 5. IIS: serve it at gitapress.in/emailanalytics

Do this at a quiet time and keep the main website open in a browser to check it afterwards.

**5.1 Back up the IIS configuration** (Administrator PowerShell):

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" add backup "before-emailanalytics"
```

**5.2 ARR proxy.** If the pre-flight report shows `enabled="true"` in the ARR proxy settings, skip this. Otherwise switch on only that setting:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.webServer/proxy /enabled:"True" /commit:apphost
```

Or in IIS Manager: the server name → **Application Request Routing Cache** → **Server Proxy Settings** → tick **Enable proxy** → Apply. Leave every other setting there as it is.

**5.3 Add the application.** Copy `deploy\iis\web.config` from the repository into a new, otherwise empty folder. If you chose a port other than 8888, edit `127.0.0.1:8888` in that copy.

```powershell
mkdir C:\inetpub\emailanalytics-proxy
copy C:\apps\EmailAnalytics\deploy\iis\web.config C:\inetpub\emailanalytics-proxy\
```

Then in Administrator PowerShell (replace `gitapress.in` with the site's name exactly as the pre-flight report shows it):

```powershell
Import-Module WebAdministration
New-WebAppPool -Name EmailAnalyticsProxy
Set-ItemProperty IIS:\AppPools\EmailAnalyticsProxy managedRuntimeVersion ""
New-WebApplication -Site "gitapress.in" -Name emailanalytics -PhysicalPath C:\inetpub\emailanalytics-proxy -ApplicationPool EmailAnalyticsProxy
```

Or in IIS Manager: **Application Pools** → Add → Name `EmailAnalyticsProxy`, **.NET CLR version: No Managed Code**; then **Sites** → the gitapress.in site → right-click → **Add Application…** → Alias `emailanalytics`, that pool, physical path `C:\inetpub\emailanalytics-proxy`.

The new application has its own app pool, so it never shares a worker process with the gitapress.in website or any other site. Its `web.config` drops the gitapress.in site's rewrite rules for `/emailanalytics` only, so the main site's rules do not interfere and the main site itself is unchanged. It also redirects http to https.

**5.4 Check:**
1. `https://gitapress.in/emailanalytics/api/health` and `https://gitapress.in/emailanalytics`
2. The gitapress.in home page and one or two other pages: they should behave exactly as before.
3. Any other site on the server that uses ARR / reverse proxy.

---

## 6. Google Cloud (Sign in with Google and Gmail)

In Google Cloud Console → **APIs & Services** → **Credentials** → the OAuth client used by this app:

* **Authorised redirect URIs**, add both (exactly, no trailing slash):
  * `https://gitapress.in/emailanalytics/api/auth/google/callback`
  * `https://gitapress.in/emailanalytics/api/connect/google/callback`
* **Authorised JavaScript origins**: `https://gitapress.in`

If Google asks for it, add `gitapress.in` under **OAuth consent screen → Branding → Authorised domains**. The old `…netlify.app` URIs can be removed once the new address works. Domain-wide delegation for shared mailboxes does not change.

---

## 7. After the first sign-in

New users are created with the time zone `America/Toronto`, which decides when the morning digest and scheduled reports go out. To use Indian time for everyone, run once in psql (connected to the `gitamail` database):

```sql
ALTER TABLE users ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';
UPDATE users SET timezone = 'Asia/Kolkata';
```

---

## 8. Updating later

```powershell
cd C:\apps\EmailAnalytics
nssm stop EmailAnalytics
git pull
npm ci
npm run build:web
nssm start EmailAnalytics
```

(Stop the service first: Windows locks files that the running app is using, and `npm ci` fails with EPERM otherwise.) Database changes are applied automatically on start. Updates touch only this app's folder and service.

---

## Undo (remove it without affecting anything else)

```powershell
Import-Module WebAdministration
Remove-WebApplication -Site "gitapress.in" -Name emailanalytics
Remove-WebAppPool -Name EmailAnalyticsProxy
nssm stop EmailAnalytics
nssm remove EmailAnalytics confirm
```

Then delete `C:\inetpub\emailanalytics-proxy` and `C:\apps\EmailAnalytics`, and in psql `DROP DATABASE gitamail; DROP USER gitamail;`. If you switched on the ARR proxy in 5.2 and nothing else uses it, you can switch it off again the same way with `/enabled:"False"`.

Last resort only, if IIS behaves unexpectedly after step 5: `appcmd restore backup "before-emailanalytics"` puts the whole IIS configuration back to the moment of the backup. It also undoes any other IIS change made since then, and IIS restarts its sites, so prefer the targeted commands above.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| 502.3 Bad Gateway | The Node service is not running or is on another port. `nssm status EmailAnalytics`, read `logs\service.log`, compare `PORT` in `.env` with the port in the proxy folder's `web.config`. |
| 404 from IIS for `/emailanalytics` | The application was not added under the right site, or URL Rewrite / ARR is not installed, or the ARR proxy is off (step 5.2). |
| The page loads but is blank, browser console shows 404 for `/assets/...` | The app was built without `BASE_PATH`. Set `BASE_PATH=/emailanalytics/` in `.env`, run `npm run build:web`, restart the service. |
| `redirect_uri_mismatch` from Google | Redirect URIs in step 6 must match `APP_URL` exactly. |
| Links in emails point to the wrong address | `APP_URL` in `.env`; restart the service after changing it. |
| `/api/health` says database cannot connect | PostgreSQL service not running, wrong port, or wrong password in `DATABASE_URL` (special characters must be URL-encoded). |
| Signing in to another gitapress.in app signs you out here (or the reverse) | Both store their login under the browser key `token` on the same domain. Use a subdomain for one of them, or give one app a different key. |
| `npm ci` fails with EPERM | The service is still running; `nssm stop EmailAnalytics` first. |
| Mailbox shows `Gmail 403: Quota exceeded … per minute per user` | Gmail allows each mailbox 6,000 quota units a minute (about 100 full emails). The app reads at about 85 a minute and waits when Google says the limit is reached, so a large first sync takes a while. If emails were skipped before this pacing existed, use the mailbox's **Re-sync from scratch** button once in Admin → Mailboxes (duplicates are skipped). |
| `node: --import` or `--env-file` is not a recognised option | The service is using a Node older than 20.6. Point NSSM at the newer `node.exe` (step 1). |
