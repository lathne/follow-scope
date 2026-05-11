const STORAGE_KEYS = {
  current: "follow-scope.currentSnapshot",
  previous: "follow-scope.previousSnapshot",
  aliases: "follow-scope.aliases",
  counts: "follow-scope.counts"
};

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const currentZipInput = document.getElementById("currentZip");
const previousZipInput = document.getElementById("previousZip");
const aliasInput = document.getElementById("aliasInput");
const countInput = document.getElementById("countInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");

boot();

function boot() {
  aliasInput.value = localStorage.getItem(STORAGE_KEYS.aliases) || "";
  countInput.value = localStorage.getItem(STORAGE_KEYS.counts) || "";
  analyzeBtn.addEventListener("click", runAnalysis);
  clearBtn.addEventListener("click", clearSaved);
}

async function runAnalysis() {
  try {
    setStatus("Loading exports...");

    const aliases = parseAliasMap(aliasInput.value);
    const counts = parseCountMap(countInput.value);
    localStorage.setItem(STORAGE_KEYS.aliases, aliasInput.value);
    localStorage.setItem(STORAGE_KEYS.counts, countInput.value);

    const currentSnapshot = currentZipInput.files[0]
      ? await parseZipSnapshot(currentZipInput.files[0], aliases)
      : readSnapshot(STORAGE_KEYS.current);

    const previousSnapshot = previousZipInput.files[0]
      ? await parseZipSnapshot(previousZipInput.files[0], aliases)
      : readSnapshot(STORAGE_KEYS.previous);

    if (!currentSnapshot) {
      setStatus("Please select a current export ZIP (or use one previously saved in this browser).");
      return;
    }

    localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(currentSnapshot));
    if (previousSnapshot) {
      localStorage.setItem(STORAGE_KEYS.previous, JSON.stringify(previousSnapshot));
    }

    const analysis = buildAnalysis(currentSnapshot, previousSnapshot, counts);
    renderResults(analysis);

    setStatus(`Done. Current: ${currentSnapshot.name}. ${previousSnapshot ? `Compared with previous: ${previousSnapshot.name}.` : "No previous snapshot loaded."}`);
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message || "Could not analyze ZIP files."}`);
  }
}

function clearSaved() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  resultsEl.innerHTML = "";
  setStatus("Saved local data cleared.");
}

function readSnapshot(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

function isLikelyInstagramUsername(value) {
  return /^[a-z0-9._]{1,30}$/.test(normalizeUsername(value));
}

function parseAliasMap(text) {
  const map = new Map();
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/(?:=|->|→)/).map((p) => normalizeUsername(p));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        map.set(parts[0], parts[1]);
      }
    });
  return map;
}

function applyAlias(username, aliasMap) {
  let current = normalizeUsername(username);
  const visited = new Set();
  while (aliasMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = aliasMap.get(current);
  }
  return current;
}

function parseCountMap(text) {
  const map = new Map();
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/(?:,|=|;|\|)/).map((p) => p.trim());
      if (parts.length >= 2) {
        const username = normalizeCountKey(parts[0]);
        const count = Number(String(parts[1]).replace(/[^\d]/g, ""));
        if (username && Number.isFinite(count)) {
          map.set(username, count);
        }
      }
    });
  return map;
}

function normalizeCountKey(rawKey) {
  const normalized = normalizeUsername(rawKey);
  if (isLikelyInstagramUsername(normalized)) return normalized;
  return usernameFromUrl(rawKey);
}

async function parseZipSnapshot(file, aliasMap) {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip failed to load. Check your internet connection and reload.");
  }

  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);

  const followingPath = pickPath(files, [
    "connections/followers_and_following/following.json",
    "connections/followers_and_following/following.html"
  ]);

  const followerPaths = files.filter((path) =>
    /connections\/followers_and_following\/followers_\d+\.(json|html)$/i.test(path)
  );

  if (!followingPath || followerPaths.length === 0) {
    throw new Error("Could not find following/followers files in this ZIP.");
  }

  const followingRaw = await readUsernamesFromZipPath(zip, followingPath);
  const followersRawNested = await Promise.all(followerPaths.map((path) => readUsernamesFromZipPath(zip, path)));

  const following = new Set(followingRaw.map((u) => applyAlias(u, aliasMap)).filter(Boolean));
  const followers = new Set(followersRawNested.flat().map((u) => applyAlias(u, aliasMap)).filter(Boolean));

  return {
    name: file.name,
    loadedAt: new Date().toISOString(),
    following: [...following].sort(),
    followers: [...followers].sort()
  };
}

function pickPath(files, candidates) {
  for (const candidate of candidates) {
    const found = files.find((f) => f.endsWith(candidate));
    if (found) return found;
  }
  return null;
}

async function readUsernamesFromZipPath(zip, path) {
  const file = zip.file(path);
  if (!file) return [];
  const content = await file.async("string");

  if (path.endsWith(".json")) {
    return parseUsernamesFromJson(content);
  }

  if (path.endsWith(".html")) {
    return parseUsernamesFromHtml(content);
  }

  return [];
}

function parseUsernamesFromJson(text) {
  const usernames = [];
  const json = JSON.parse(text);

  const collectFromEntry = (entry) => {
    if (!entry || typeof entry !== "object") return;
    let extractedAny = false;

    const list = Array.isArray(entry.string_list_data) ? entry.string_list_data : [];
    for (const item of list) {
      const normalizedValue = normalizeUsername(item?.value);
      if (normalizedValue && isLikelyInstagramUsername(normalizedValue)) {
        usernames.push(normalizedValue);
        extractedAny = true;
      }
      const extracted = usernameFromUrl(item?.href || "");
      if (extracted) {
        usernames.push(extracted);
        extractedAny = true;
      }
    }

    const normalizedTitle = normalizeUsername(entry?.title);
    if (!extractedAny && normalizedTitle && isLikelyInstagramUsername(normalizedTitle)) {
      usernames.push(normalizedTitle);
    }
  };

  if (Array.isArray(json)) {
    json.forEach(collectFromEntry);
  } else {
    [
      "relationships_following",
      "relationships_followers",
      "relationships_follow_requests_sent",
      "relationships_follow_requests_received"
    ].forEach((key) => {
      if (Array.isArray(json[key])) json[key].forEach(collectFromEntry);
    });
  }

  return dedupe(usernames);
}

function parseUsernamesFromHtml(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const anchors = [...doc.querySelectorAll("a[href*='instagram.com']")];
  const usernames = anchors
    .map((a) => usernameFromUrl(a.getAttribute("href") || ""))
    .filter(Boolean);

  return dedupe(usernames);
}

function usernameFromUrl(url) {
  const raw = String(url || "").trim();
  const match = raw.match(/instagram\.com\/(?:_u\/)?([^/?#]+)/i);
  if (!match) return "";
  const candidate = normalizeUsername(match[1]);
  if (!isLikelyInstagramUsername(candidate)) return "";

  const blockedPaths = new Set([
    "p",
    "reel",
    "reels",
    "stories",
    "explore",
    "accounts",
    "about",
    "legal",
    "developer",
    "tv",
    "api",
    "graphql"
  ]);
  return blockedPaths.has(candidate) ? "" : candidate;
}

function dedupe(list) {
  return [...new Set(list.map(normalizeUsername).filter(Boolean))];
}

function buildAnalysis(current, previous, countMap) {
  const currentFollowing = new Set(current.following);
  const currentFollowers = new Set(current.followers);

  const notFollowingBack = [...currentFollowing].filter((u) => !currentFollowers.has(u)).sort();

  const withCountBetween = (minExclusive, maxExclusive) =>
    notFollowingBack
      .filter((u) => countMap.has(u))
      .map((u) => ({ username: u, followersCount: countMap.get(u) }))
      .filter((x) => x.followersCount > minExclusive && x.followersCount < maxExclusive);

  const withCountUnder = (threshold) =>
    notFollowingBack
      .filter((u) => countMap.has(u) && countMap.get(u) < threshold)
      .map((u) => ({ username: u, followersCount: countMap.get(u) }));

  const unknownCounts = notFollowingBack.filter((u) => !countMap.has(u));

  let unfollowedSinceUpdate = [];
  if (previous) {
    const prevFollowers = new Set(previous.followers);
    unfollowedSinceUpdate = [...prevFollowers].filter((u) => !currentFollowers.has(u)).sort();
  }

  return {
    summary: {
      currentFollowing: current.following.length,
      currentFollowers: current.followers.length,
      notFollowingBack: notFollowingBack.length,
      previousLoaded: Boolean(previous)
    },
    notFollowingBack,
    between5kAnd20k: withCountBetween(5000, 20000),
    between1kAnd5k: withCountBetween(1000, 5000),
    under1k: withCountUnder(1000),
    unknownCounts,
    unfollowedSinceUpdate
  };
}

function renderResults(analysis) {
  const block = (title, items, renderItem = (x) => x) => `
    <div class="result-block">
      <h3>${escapeHtml(title)} (${items.length})</h3>
      ${items.length === 0 ? "<p class='muted'>No items.</p>" : `<ul>${items.map((item) => `<li>${renderItem(item)}</li>`).join("")}</ul>`}
    </div>
  `;

  const summary = analysis.summary;

  resultsEl.innerHTML = `
    <div class="result-block">
      <h3>Summary</h3>
      <p>
        Following: <strong>${summary.currentFollowing}</strong> ·
        Followers: <strong>${summary.currentFollowers}</strong> ·
        Follow but not followed back: <strong>${summary.notFollowingBack}</strong> ·
        Previous snapshot loaded: <strong>${summary.previousLoaded ? "Yes" : "No"}</strong>
      </p>
    </div>
    ${block("Accounts I follow but do not follow me", analysis.notFollowingBack, (u) => `<a target='_blank' href='https://www.instagram.com/${encodeURIComponent(u)}'>@${escapeHtml(u)}</a>`) }
    ${block("Accounts I follow but do not follow me (> 5k and < 20k followers)", analysis.between5kAnd20k, (x) => `<a target='_blank' href='https://www.instagram.com/${encodeURIComponent(x.username)}'>@${escapeHtml(x.username)}</a> (${x.followersCount})`) }
    ${block("Accounts I follow but do not follow me (> 1k and < 5k followers)", analysis.between1kAnd5k, (x) => `<a target='_blank' href='https://www.instagram.com/${encodeURIComponent(x.username)}'>@${escapeHtml(x.username)}</a> (${x.followersCount})`) }
    ${block("Accounts I follow but do not follow me (< 1k followers)", analysis.under1k, (x) => `<a target='_blank' href='https://www.instagram.com/${encodeURIComponent(x.username)}'>@${escapeHtml(x.username)}</a> (${x.followersCount})`) }
    ${block("Accounts that unfollowed me since last update", analysis.unfollowedSinceUpdate, (u) => `<a target='_blank' href='https://www.instagram.com/${encodeURIComponent(u)}'>@${escapeHtml(u)}</a>`) }
    ${block("Missing follower count data for filtered lists", analysis.unknownCounts, (u) => `@${escapeHtml(u)}`) }
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
