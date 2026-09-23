# Install My Niches (easy guide)
My Niches — by Avantex (Usama javed)

Takes about 10 minutes. Windows + Google Chrome.

## Section 1: Did someone give you a link and a password?

If yes, you do not need to install the app at all:

1. Open the link in your browser, type the password, press Unlock. You stay logged in on this device for a year.
2. Install the Chrome extension (steps in section 3, below) and connect it: on any YouTube channel page click the green + next to Subscribe. The panel says "Cannot find the server" and shows two boxes. Put the link in "Server address", the password in "Password", press "Save and connect".

That's it. Skip section 2.

## Section 2: Run it on your own computer

### Step 1 - Install Node.js (one time only)

- Go to https://nodejs.org and download the version marked LTS.
- Open the downloaded file. Click Next on every screen, keep the defaults, then Install and Finish.
- (If you skip this, start.cmd will tell you and open the download page.)

### Step 2 - Unzip My Niches to a permanent place

- Right-click my-niches.zip -> Extract All... -> choose a folder you will keep, for example Documents -> Extract.
- Do not run it from inside the zip. Do not delete or move this folder later (the extension and autostart point to it).

### Step 3 - Start it

- Open the my-niches folder and double-click start.cmd.
- If Windows shows a blue "Windows protected your PC" box: click "More info" then "Run anyway". If it shows "Open File - Security Warning": click Run.
- A small window called "My Niches server" appears minimised in the taskbar. Keep it open. Your browser opens http://localhost:5173 and you see MY NICHES with an empty library.

### Step 4 - Make it start with Windows (recommended)

- Double-click install-autostart.cmd once. When it says Done, press any key.
- From now on it starts by itself every time you log in, and restarts itself if it ever stops. To bookmark: http://localhost:5173

### Step 5 - Install the extension

Follow Section 3 below.

## Section 3: Install the Chrome extension

1. Open Chrome, type chrome://extensions in the address bar, press Enter.
2. Turn on "Developer mode" (switch at the top right).
3. Click "Load unpacked" (top left).
4. Choose the "extension" folder that is INSIDE your my-niches folder -> Select Folder.
5. "My Niches" appears in the list. Click the puzzle-piece icon in Chrome's toolbar and pin My Niches so it is always visible.
6. Open any YouTube channel: a green + now sits next to the Subscribe button.

If Chrome later shows a warning about developer-mode extensions, click the option to keep it; it is only this extension.

## Section 4: Your first niche and channel

1. In the app click the green "+ New niche" button, type a name, save.
2. Click the niche in the left sidebar, then "+ Add channel".
3. Paste a YouTube channel link (like https://www.youtube.com/@SomeChannel) and click Add channel. Name, picture, subscribers and top videos appear by themselves in a few seconds.
4. Or, on YouTube, click the green + next to Subscribe and pick the niche.
5. Every card has a notes button for your own notes.

## Section 5: Something not working?

| You see | Do this |
|---|---|
| Browser says "This site can't be reached" | Double-click start.cmd again. If it says Node.js is not installed, do Step 1. |
| Extension says "Cannot find the server" | Double-click start.cmd. (If you use a link from someone: put the link and password in its panel.) |
| A channel shows no name or subscribers | YouTube is busy; press the refresh icon on the card a bit later. |
| You moved the my-niches folder | Run install-autostart.cmd again, and in chrome://extensions remove My Niches and Load unpacked again. |
| Want to stop it starting with Windows | Double-click uninstall-autostart.cmd. |

More options (several PCs, online for a team): see START-HERE.md.
