# Hosting on the Gita Press Windows Server at gitapress.in/emailanalytics

This replaces Netlify with the Windows server that already hosts the other Gita Press sites.

```
Browser ──https──> IIS site "gitapress.in"
                     └─ /emailanalytics  (IIS application: only a web.config, URL Rewrite + ARR)
                           └─ proxy ──> Node.js on 127.0.0.1:8888   (Windows service "EmailAnalytics", npm start)
                                           ├─ app pages  (dist/, built with BASE_PATH=/emailanalytics/)
                                           ├─ REST API   (/api/*)
                                           ├─ worker     (mail sync, AI analysis, alerts, reports: every 5 minutes)
                                           └─ PostgreSQL on 127.0.0.1:5432
```

The app folder (`C:\apps\EmailAnalytics`, with the `.env`) is **outside** every IIS site folder, so IIS can never serve the `.env` file. Only Node reads it.

Paths and names below are suggestions; if you change one, change it everywhere it appears.

---

## 0. Install once on the server

| Software | Where | Check |
|---|---|---|
| Node.js LTS (22 or newer) | nodejs.org, Windows Installer (.msi) | `node -v` |
| Git for Windows | git-scm.com | `git --version` |
| PostgreSQL 16 or newer | enterprisedb.com Windows installer (includes pgAdmin) | `psql --version` |
| IIS URL Rewrite 2.1 | iis.net/downloads/microsoft/url-rewrite | "URL Rewrite" icon in IIS Manager |
| IIS Application Request Routing 3.0 | iis.net/downloads/microsoft/application-request-routing | "Application Request Routing Cache" icon on the server node |
| NSSM (runs Node as a Windows service) | nssm.cc → unzip `win64\nssm.exe` to `C:\tools\nssm\` and add to PATH | `nssm version` |

If other projects on this server are already reverse-proxied through IIS, URL Rewrite and ARR are already installed.

---

## 1. Move the code to the Gita Press GitHub

On GitHub, create `cloudhostadmin/EmailAnalytics` as a **private, empty** repository (no README, no .gitignore, no licence). Then, on any PC with Git:

```powershell
git clone https://github.com/vikasrungta75/Gita_email.git EmailAnalytics
cd EmailAnalytics
git remote rename origin upstream
git remote add origin https://github.com/cloudhostadmin/EmailAnalytics.git
git push -u origin main
```

The full history moves across. `upstream` stays pointed at the original repository so later changes from it can be brought in:

```powershell
git pull upstream main
git push origin main
```

Never commit `.env` (it is already in `.gitignore`).

---

## 2. Database (PostgreSQL on the same server)

Open **SQL Shell (psql)** as the `postgres` user and run (choose your own strong password):

```sql
CREATE USER gitamail WITH PASSWORD 'ChooseAStrongPassword';
CREATE DATABASE gitamail OWNER gitamail;
```

The tables are created automatically the first time the app starts. The app needs the `pgcrypto` extension, which ships with PostgreSQL and which the database owner is allowed to enable.

Do **not** open port 5432 in Windows Firewall; the app connects over 127.0.0.1.

**Already running elsewhere with data you want to keep?** Copy it across with `pg_dump` / `pg_restore`, and keep the **same `ENCRYPTION_KEY`** in the new `.env`, otherwise saved Gmail connections and the uploaded service account key cannot be read and have to be reconnected. (Alternatively keep the existing `DATABASE_URL` and skip this step.)

---

## 3. Put the app on the server

```powershell
mkdir C:\apps
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
* `PORT`: check nothing else uses it: `netstat -ano | findstr :8888`. If you change it, change it in the IIS `web.config` too.
* If the database password contains `@ : / # ? %`, write those characters URL-encoded in `DATABASE_URL` (`@` → `%40`, `#` → `%23`, `%` → `%25`).
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

Run PowerShell **as Administrator**:

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

**5.1 Turn on the ARR proxy and allow long requests** (server-wide; "Sync now" can take up to about 8 minutes). Administrator PowerShell:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.webServer/proxy /enabled:"True" /timeout:"00:10:00" /commit:apphost
```

Or in IIS Manager: click the server name → **Application Request Routing Cache** → **Server Proxy Settings** → tick **Enable proxy**, **Time-out** = 600 → Apply. If other projects already use ARR it is probably enabled; only raise the time-out if it is below 600.

**5.2 Add the application.** Copy `deploy\iis\web.config` from the repository into a new, otherwise empty folder:

```powershell
mkdir C:\inetpub\emailanalytics-proxy
copy C:\apps\EmailAnalytics\deploy\iis\web.config C:\inetpub\emailanalytics-proxy\
```

Then in IIS Manager:
1. **Application Pools** → Add Application Pool → Name `EmailAnalyticsProxy`, **.NET CLR version: No Managed Code** → OK.
2. **Sites** → the site that serves `gitapress.in` → right-click → **Add Application…**
   * Alias: `emailanalytics`
   * Application pool: `EmailAnalyticsProxy`
   * Physical path: `C:\inetpub\emailanalytics-proxy`

Or the same in Administrator PowerShell (replace `gitapress.in` with the site's name as shown in IIS Manager):

```powershell
Import-Module WebAdministration
New-WebAppPool -Name EmailAnalyticsProxy
Set-ItemProperty IIS:\AppPools\EmailAnalyticsProxy managedRuntimeVersion ""
New-WebApplication -Site "gitapress.in" -Name emailanalytics -PhysicalPath C:\inetpub\emailanalytics-proxy -ApplicationPool EmailAnalyticsProxy
```

The `web.config` clears the gitapress.in site's own rewrite rules for this folder only, so the main website is not affected and its rules do not interfere. It also redirects http to https.

**5.3 Check:** open `https://gitapress.in/emailanalytics/api/health`, then `https://gitapress.in/emailanalytics`.

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

(Stop the service first: Windows locks files that the running app is using, and `npm ci` fails with EPERM otherwise.) Database changes are applied automatically on start.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| 502.3 Bad Gateway | The Node service is not running or is on another port. `nssm status EmailAnalytics`, read `logs\service.log`, compare `PORT` in `.env` with the port in `web.config`. |
| 502.3 after about 2 minutes on "Sync now" | ARR time-out still 120 seconds; step 5.1. |
| 404 from IIS for `/emailanalytics` | The application was not added under the right site, or URL Rewrite / ARR is not installed. |
| The page loads but is blank, browser console shows 404 for `/assets/...` | The app was built without `BASE_PATH`. Set `BASE_PATH=/emailanalytics/` in `.env`, run `npm run build:web`, restart the service. |
| `redirect_uri_mismatch` from Google | Redirect URIs in step 6 must match `APP_URL` exactly. |
| Links in emails point to the wrong address | `APP_URL` in `.env`; restart the service after changing it. |
| `/api/health` says database cannot connect | PostgreSQL service not running, or wrong password in `DATABASE_URL` (special characters must be URL-encoded). |
| Signing in to another gitapress.in app signs you out here (or the reverse) | Both store their login under the browser key `token` on the same domain. Use a subdomain for one of them, or give one app a different key. |
| `npm ci` fails with EPERM | The service is still running; `nssm stop EmailAnalytics` first. |
