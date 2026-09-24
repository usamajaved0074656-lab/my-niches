# Setup Guide for Claude
My Niches — by Avantex (Usama javed)

You are setting up My Niches for the user. Follow these steps.

---

## 1. Ask the User Which Option They Want

Start by asking the user which option they prefer:

| Option | Best For | Requirements | Storage |
|---|---|---|---|
| **Option A** | Single PC, personal use | Node.js LTS, run `start.cmd` | Local file (`data/niches.json`) |
| **Option B** | Multiple PCs syncing the same library | Node.js LTS + Free Supabase project | Supabase Postgres database |
| **Option C** | Online team access from any device | Free Supabase + GitHub + Vercel | Supabase Postgres database |

---

## 2. Rules for Claude During Setup

### Do Every Step Yourself That You Can
- Check the Node.js version by running `node -v` (requires Node.js 18+).
- Create `.env` from `.env.example`.
- Launch the server with `start.cmd` (or `node server.js`).
- Verify the server is responding by querying `http://localhost:5173/api/config` using curl.
- Run `install-autostart.cmd` for local setups (Options A and B).
- Verify the app works by adding one test niche and one test channel, verifying fetched data, and deleting them.

### Ask the User ONLY for Things You Cannot Do
- Creating accounts on Supabase, Vercel, or GitHub.
- Logging into external dashboards.
- Copying private keys or project URLs from their dashboards.

### Security Rules (Strict)
- **NEVER** ask the user to paste their secret key (`sb_secret_...`) or `APP_PASSWORD` into chat.
- Instruct the user to paste credentials directly into their `.env` file or into the Vercel project settings dashboard.
- **NEVER** commit or push `.env` to git (`.gitignore` already excludes it).

---

## 3. Files in This Folder

- `server.js` — Core application server.
- `start.cmd` — Quick launcher script for Windows.
- `store.js` — Data storage layer (supports local file or Supabase).
- `auth.js` — Password authentication and session management.
- `lib/` — Server helper functions and request handlers.
- `public/` — Frontend web interface files.
- `api/` — Serverless entry point for Vercel.
- `extension/` — Chrome browser extension.
- `branding/` — Logo SVGs and `build-icons.mjs` (regenerates every icon with the Edge that ships with Windows).
- `schema.sql` — PostgreSQL schema for Supabase.
- `.env.example` — Configuration template.
- `migrate.js` — Migration script to copy local JSON data to Supabase.
- `install-autostart.cmd` — Windows background watchdog installer.
- `uninstall-autostart.cmd` — Windows background watchdog uninstaller.
- `autostart.vbs` — Background watchdog script.
- `vercel.json` — Deployment configuration for Vercel.
- `render.yaml` — Deployment configuration for Render.
- `package.json` — Application metadata.

---

## 4. Setup Procedures

### If the User Chooses Option A (One PC, No Account Needed)

1. **Check Node.js:**
   Run `node -v`. If Node.js is missing or below version 18, ask the user to download and install Node.js LTS from https://nodejs.org.
2. **Configure Storage:**
   Do not create a `.env` file. Data will automatically be stored in `data/niches.json`.
3. **Start the Server:**
   Execute `start.cmd` (or `node server.js`).
4. **Configure Autostart:**
   Run `install-autostart.cmd`. This registers a Windows logon task and Startup entry running `autostart.vbs`, which pings `http://localhost:5173` every 20 seconds and restarts the server if down. Output is logged to `data/server.log`. (Can be removed anytime with `uninstall-autostart.cmd`).
5. **Verify Server:**
   Confirm response using `curl http://localhost:5173/api/config`.
6. Proceed to Step 5 (Test & Verification).

---

### If the User Chooses Option B (Several PCs on Same Library)

1. **Check Node.js:**
   Run `node -v` to ensure Node.js 18+ is available.
2. **Guide User on Supabase Project Setup:**
   Instruct the user to:
   - Go to https://supabase.com and create a free account.
   - Click **New project** and wait for it to initialize.
   - Open **SQL Editor**, paste the entire contents of `schema.sql` from this folder, and click **Run**.
   - Go to **Project Settings** -> **API Keys**, locate **Secret keys**, generate a new secret key (starts with `sb_secret_`), and copy it.
   - Go to **Project Settings** -> **Data API** and copy the **Project URL** (`https://xxxx.supabase.co`).
3. **Set Up `.env` File:**
   - Copy `.env.example` to `.env`.
   - Ask the user to open `.env` directly on their computer and set:
     ```env
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_KEY=sb_secret_...
     PORT=5173
     ```
   - *Do not let them paste these secrets in chat.*
4. **Migrate Existing Local Data (if applicable):**
   If `data/niches.json` exists from previous Option A use, run:
   ```bash
   node migrate.js
   ```
   This copies local data to Supabase. It is safe to run multiple times without creating duplicates.
5. **Start the Server & Autostart:**
   - Run `start.cmd`.
   - Run `install-autostart.cmd`.
6. **Verify Server:**
   Confirm response using `curl http://localhost:5173/api/config`.
7. **Multi-PC Note:**
   Inform the user that placing the exact same `.env` file on another PC connects that PC to the same library.
8. Proceed to Step 5 (Test & Verification).

---

### If the User Chooses Option C (Online for a Team)

1. **Supabase Setup:**
   Guide the user through steps 1-4 of Option B (create Supabase project, execute `schema.sql`, obtain `sb_secret_` key and Project URL).
2. **GitHub Repository:**
   Instruct the user to push this folder into a GitHub repository (private repository is fine).
3. **Vercel Project Setup:**
   Instruct the user to:
   - Go to https://vercel.com, sign in, and click **Add New** -> **Project**.
   - Import the GitHub repository.
   - Select **Framework Preset**: **Other** (no build command needed).
   - Configure Environment Variables (all three required):
     - `SUPABASE_URL` = the Project URL
     - `SUPABASE_KEY` = the `sb_secret_` key
     - `APP_PASSWORD` = an application password (minimum 8 characters, 16+ recommended)
   - *Remind the user that the app refuses to start online without `APP_PASSWORD` and without Supabase.*
4. **Deploy & Access:**
   - Instruct the user to click **Deploy**.
   - Once deployed, open `https://<name>.vercel.app` and enter the `APP_PASSWORD`.
   - Inform the user that devices stay logged in for 365 days.
   - Explain that changing `APP_PASSWORD` in Vercel settings and redeploying logs out all devices, whereas clicking log out on a device only signs out that specific device.
5. Proceed to Step 5 (Test & Verification).

---

## 5. Test & Verification

Once the app is running (locally or on Vercel):

1. **Check Health/Config:**
   - Local (Options A and B): `curl http://localhost:5173/api/config` should return the storage backend.
   - Online (Option C): use `curl https://<name>.vercel.app/api/auth` instead. It answers without the password and should return `{"required":true,"authorized":false}`. Do not use `/api/config` online: it sits behind the password and returns 401 by design, which does not mean the deploy failed.
2. **Test Channel Fetching:**
   - Add one test niche in the app.
   - Add one test YouTube channel link into that niche.
   - Verify that the app successfully fetches: channel name, avatar, banner, subscribers, video count, description, and top 3 videos by views (with thumbnails, duration, views, age).
3. **Clean Up:**
   Delete the test niche and test channel so the library stays clean for the user.

---

## 6. Chrome Extension Instructions for the User

Provide these instructions to the user to complete their setup:

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` folder located inside this folder.
4. **Connection:**
   - For local setups (Options A and B), it automatically connects to `http://localhost:5173`.
   - For online setups (Option C) or if it displays "Cannot find the server", open any YouTube channel, click the green **+** button, enter the **Server address** (e.g. `https://your-app.vercel.app`) and **Password** (`APP_PASSWORD`), and click **Save and connect** (these can also be accessed via extension icon -> **Settings**).
5. **Updates:** If this project folder is updated in the future, return to `chrome://extensions` and click reload.

---

## 7. App Features Reference

- **Create a niche:** Click the green **+ New niche** button in the sidebar.
- **Add a channel:** Open a niche, click **+ Add channel**, and paste a YouTube channel or video link. Or click the green **+** button on YouTube with the Chrome extension.
- **Bulk add:** The same box accepts many links, one per line (or a column pasted from a sheet). They are added one at a time; failed ones stay in the box; **Stop** ends the run.
- **Duplicate handling:** A channel cannot be added twice to the same niche (the app alerts that it is already there).
- **Channel card actions:** Link icon opens YouTube; refresh icon re-fetches channel data; notes button opens notes; "..." menu offers *Open on YouTube*, *Notes*, *Refresh data*, *Move to another niche*, and *Remove from this niche*.
- **Niche menu actions:** The "..." button next to a niche in the sidebar offers *Rename*, *Pin to top*, *Settings & notes*, *Copy all channel links*, and *Delete niche*.
- **Copy links:** The button above the cards copies every channel link visible on screen, one per line (respecting search and niche filters).
- **Removed channels:** Channels YouTube removed move into **Removed by YouTube** (notes kept) when refreshed, and automatically once a day while the local server runs (Options A and B; not on Vercel). `SWEEP_HOURS=0` in `.env` turns the daily check off.
- **Search & Sort:** Top search bar searches channels, niches, tags, and notes. The sort button adjusts display order.
- **Backups:** Bottom sidebar contains **Export backup** (downloads JSON) and **Import backup**.

---

## 8. Troubleshooting Reference

| Problem | Cause / Solution |
|---|---|
| Extension says "Cannot find the server" | Start the server with `start.cmd`, or enter the server URL and password in the extension panel for online deployments. |
| "Password is wrong or not set" | Check `APP_PASSWORD` in the extension settings. |
| Channel name or subscribers missing | YouTube occasionally rate-limits scraping requests. Click the refresh icon on the card later. |
| Port 5173 is already busy | Set `PORT=5174` in `.env`. Update the extension's Server address to `http://localhost:5174`. |
| "Too many wrong attempts" | Temporary protection against password guessing. Wait 10 minutes before retrying. |
