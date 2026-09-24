# Start Here
My Niches — by Avantex (Usama javed)

First time and not technical? Use the easy step-by-step guide instead: [INSTALL-ENGLISH.md](INSTALL-ENGLISH.md) (English) or [INSTALL.md](INSTALL.md) (Roman Urdu).

Welcome to My Niches! This guide will help you get your personal YouTube niche library running in minutes.

---

## What This Is

- **A personal library of YouTube niches.** A niche is a folder of channels.
- **Automatic channel imports.** Paste a YouTube channel or video link. The app automatically fetches the channel's name, avatar, banner, subscriber count, video count, description, and top 3 videos by views (with thumbnails, duration, views, and age).
- **Built-in notes.** Keep dedicated notes on every niche and every channel.
- **Chrome extension.** Adds a green **+** button next to YouTube's Subscribe button. Clicking it lets you save the channel directly into any niche you choose.
- **Zero dependencies.** Runs on Node.js 18+ with no `npm install` required.
- **Flexible storage.** Save data to a local file (`data/niches.json`) or connect to your own free Supabase project to share across multiple PCs or with a team.

### Files in This Folder

- `server.js` — Main application server.
- `start.cmd` — Quick launcher script for Windows.
- `store.js` — Data storage layer (local file or Supabase).
- `auth.js` — Password authentication and session management.
- `lib/` — Server helper modules and route handlers.
- `public/` — Web application frontend files.
- `api/` — Serverless entry point for cloud deployment.
- `extension/` — Chrome extension files.
- `schema.sql` — Database table schema for Supabase.
- `.env.example` — Template for environment configuration.
- `migrate.js` — Script to copy local data into Supabase.
- `install-autostart.cmd` — Sets up background autostart on Windows.
- `uninstall-autostart.cmd` — Removes background autostart.
- `autostart.vbs` — Background watchdog script.
- `vercel.json` — Deployment configuration for Vercel.
- `render.yaml` — Deployment configuration for Render.
- `package.json` — Project metadata.

---

## Which Option Is for You?

Choose the setup that fits your needs:

| Option | Best For | Setup Needed | Storage Location |
|---|---|---|---|
| **Option A** | Single PC, personal use | Install Node.js LTS, run `start.cmd` | Local file (`data/niches.json`) |
| **Option B** | Multiple PCs using the same library | Free Supabase project, copy `.env` | Supabase Postgres database |
| **Option C** | Online team access from any device | Free Supabase + GitHub + Vercel | Supabase Postgres database |

---

## Option A: One PC, No Account Needed

Recommended if you work on one computer and do not want to create any cloud accounts.

1. **Install Node.js:** Download and install Node.js LTS from https://nodejs.org.
2. **Start the server:** Double-click `start.cmd` (or open a terminal and run `node server.js`).
3. **Open the app:** In your browser, go to:
   ```
   http://localhost:5173
   ```
4. **Done:** All data saves automatically to `data/niches.json`. No `.env` file is needed.

---

## Option B: Several PCs on the Same Library (Own Supabase)

Recommended if you use more than one computer and want changes to sync between them.

1. **Create a Supabase project:**
   - Go to https://supabase.com and create a free account.
   - Click **New project** (choose any name and password).
2. **Set up the database table:**
   - In your Supabase dashboard, open the **SQL Editor**.
   - Copy the entire content of `schema.sql` from this folder.
   - Paste it into the editor and click **Run**.
3. **Get your secret key:**
   - Go to **Project Settings** -> **API Keys**.
   - Under **Secret keys**, create a new secret key (starts with `sb_secret_`). Copy it.
4. **Get your project URL:**
   - Go to **Project Settings** -> **Data API**.
   - Copy the **Project URL** (e.g. `https://xxxx.supabase.co`).
5. **Create your `.env` file:**
   - Copy `.env.example` and name the new file `.env`.
   - Fill in your values:
     ```env
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_KEY=sb_secret_...
     PORT=5173
     ```
6. **Start the app:**
   - Run `start.cmd`.
   - Use the exact same `.env` file on any other PC to connect to the same library.

> [!NOTE]
> If you already started with Option A and have existing data in `data/niches.json`, run:
> ```bash
> node migrate.js
> ```
> This copies all local niches into your Supabase database. It is safe to run multiple times because it will not create duplicates.

---

## Option C: Online for a Team (One Link, Works on Any Device)

Recommended if a team needs access from any device (phone, laptop, desktop) without installing Node.js.

1. **Set up Supabase:** Complete steps 1 to 4 from Option B above.
2. **Push to GitHub:** Put this folder into a GitHub repository (a private repository is fine).
3. **Import into Vercel:**
   - Go to https://vercel.com, sign in, and click **Add New** -> **Project**.
   - Import your GitHub repository.
   - Set **Framework Preset** to **Other**. No build command is needed.
4. **Add Environment Variables:**
   In your Vercel project settings, add these three required variables:
   - `SUPABASE_URL` = your Supabase Project URL
   - `SUPABASE_KEY` = your Supabase secret key (`sb_secret_...`)
   - `APP_PASSWORD` = a password for the app (at least 8 characters, 16+ recommended)

   *Note: The app refuses to start online without `APP_PASSWORD` and without Supabase.*
5. **Deploy:** Click **Deploy**. When finished, open your deployment link (e.g. `https://your-app.vercel.app`) and enter your `APP_PASSWORD`.
   - Each device stays logged in for 365 days.
   - Logging out on one device only signs that device out.
   - To sign every device out at once: change `APP_PASSWORD` in Vercel settings and redeploy.

> [!IMPORTANT]
> Keep your secret key and password safe. Put `sb_secret_` and `APP_PASSWORD` only in your `.env` file or Vercel dashboard. Never paste them into public chat, screenshots, or git repositories. `.gitignore` already protects your `.env` file.

---

## Autostart on a PC (For Options A and B)

To keep the server running in the background without manually launching `start.cmd`:

1. **Install Autostart:** Double-click `install-autostart.cmd` once.
   - This sets up a Windows logon task and a Startup folder entry.
   - Both run `autostart.vbs`, a background watchdog that checks `http://localhost:5173` every 20 seconds and restarts the server automatically if it stops.
   - Logs are written to `data/server.log`.
2. **Remove Autostart:** Double-click `uninstall-autostart.cmd` anytime to remove it.

---

## Chrome Extension Setup

Save channels while browsing YouTube:

1. Open Chrome and navigate to `chrome://extensions`.
2. Turn on **Developer mode** using the toggle switch in the top right corner.
3. Click the **Load unpacked** button.
4. Select the `extension` folder located inside this folder.
5. **Connecting to the server:**
   - **For Options A & B:** It automatically connects to `http://localhost:5173` when the local server is running.
   - **For Option C (Online):** If the extension displays "Cannot find the server", open any YouTube channel and click the green **+** button. The panel provides two fields: **Server address** (e.g. `https://your-app.vercel.app`) and **Password** (`APP_PASSWORD`). Enter them and click **Save and connect**. You can also access these settings by clicking the extension icon in the Chrome toolbar -> **Settings**.
6. **Updating:** If this project folder is updated in the future, return to `chrome://extensions` and click the reload icon on the extension card.

---

## Using the App (Daily Guide)

- **Create a niche:** Click the green **+ New niche** button in the sidebar.
- **Add a channel:** Open a niche and click **+ Add channel**. Paste a YouTube channel or video link. Alternatively, click the green **+** button next to YouTube's Subscribe button using the Chrome extension.
- **Duplicate prevention:** The same channel cannot be added twice to the same niche; the app will notify you that it is already there.
- **Channel card actions:**
  - Click the **link icon** to open the channel on YouTube.
  - Click the **refresh icon** to re-fetch channel statistics.
  - Click the **notes button** to view or edit channel notes.
  - Open the **"..." menu** on any card to access: *Open on YouTube*, *Notes*, *Refresh data*, *Move to another niche*, or *Remove from this niche*.
- **Niche menu actions:** Click the **"..."** button next to any niche in the sidebar to: *Rename*, *Pin to top*, *Settings & notes*, *Copy all channel links*, or *Delete niche*.
- **Copy links button:** Located above the channel cards. Copies every channel link visible on screen, one per line (respects the active search filter and selected niche).
- **Removed channels:** When channels are refreshed, if YouTube has removed them, the app automatically moves them into **Removed by YouTube** in the sidebar. Existing notes are preserved.
- **Search & Sort:** Use the top search box to search across channels, niches, tags, and notes. Click the **Sort** button to change the display order.
- **Backup & Restore:** Use the sidebar bottom buttons:
  - **Export backup:** Downloads your full library as a JSON file.
  - **Import backup:** Restores a previously downloaded backup JSON file.

---

## Troubleshooting

| Problem | Cause / Solution |
|---|---|
| Extension says "Cannot find the server" | Start the server by running `start.cmd`, or if using Option C, enter your server address and password into the extension panel. |
| "Password is wrong or not set" | Check that your `APP_PASSWORD` is correctly typed in the extension settings. |
| Channel name or subscribers missing | YouTube occasionally rate-limits automated requests. Click the refresh icon on the channel card later. |
| Port 5173 is already busy | Change the port by setting `PORT=5174` in `.env`. Update the extension's Server address to `http://localhost:5174`. |
| "Too many wrong attempts" | The system temporarily locked access due to invalid password attempts. Wait 10 minutes before trying again. |
