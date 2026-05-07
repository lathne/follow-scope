# Follow Scope

Follow Scope is a free browser app to analyze Instagram export ZIP files.

It supports:
- Accounts that you follow but do not follow you back
- The same list filtered by account follower count (<20k, <5k, <1k)
- Accounts that unfollowed you since your last export update
- Username rename handling across exports (alias mapping)
- Free local storage in your browser (`localStorage`)

## What you need

- A GitHub account (free)
- This repository
- Instagram exported ZIP files (old JSON export and/or newer HTML export)

## Run locally (optional)

1. Open `index.html` in a desktop browser.
2. Load your current Instagram export ZIP.
3. Optionally load an older ZIP to compare unfollow updates.
4. Click **Analyze**.

## Deploy for free on GitHub Pages (beginner step-by-step)

1. Push this project to your GitHub repository.
2. In GitHub, open your repository.
3. Go to **Settings**.
4. In the left menu, click **Pages**.
5. In **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: choose your branch (usually `main`)
   - **Folder**: `/ (root)`
6. Click **Save**.
7. Wait ~1–3 minutes for deployment.
8. Refresh the Pages settings and open the site URL (example: `https://YOUR_USERNAME.github.io/exported-intag-file/`).

## Open from iPhone, Android, and desktop

- Open the GitHub Pages URL in Safari/Chrome/Firefox.
- Works on mobile and desktop because it is a responsive static web app.
- Optional: add to home screen from mobile browser menu.

## How to use

1. **Current export ZIP**: upload latest Instagram export ZIP.
2. **Previous export ZIP** (optional): upload older export to detect unfollow updates.
3. **Alias map** (optional): if username changed, add lines like:
   - `old_username = new_username`
4. **Follower count map** (optional): for `<20k`, `<5k`, `<1k` filters, add lines like:
   - `username,12345`
5. Click **Analyze**.

## Free data storage

- The app stores parsed snapshots and optional maps in browser `localStorage`.
- No backend required.
- Click **Clear saved local data** to remove local data.

## Privacy

- Processing happens locally in your browser.
- Your ZIP content is not uploaded by this app.
