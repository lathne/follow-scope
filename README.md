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
