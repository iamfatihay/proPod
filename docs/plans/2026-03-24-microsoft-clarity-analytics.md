# Microsoft Clarity Analytics Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Microsoft Clarity session replay and heatmaps into the Volo React Native app so we can see how test users and real users interact with the app.

**Architecture:** A thin `clarityService.js` wrapper centralizes all Clarity SDK calls. The root layout (`_layout.js`) initializes Clarity on app start. The auth store (`useAuthStore.js`) sets/clears the Clarity custom user ID on login/logout so session recordings are tied to specific users.

**Tech Stack:** `@microsoft/react-native-clarity` SDK, Expo SDK 53, EAS Build (required — Expo Go not supported), NativeWind, Zustand.

---

## Pre-requisites

- Project ID `w0q4nzuzaa` already created in Microsoft Clarity dashboard
- EAS Build already configured (`frontend/eas.json` exists)
- Dev build required (not Expo Go) — project already uses dev-client

---

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

```bash
cd //wsl.localhost/Ubuntu/home/fatih/proPod
git checkout main
git pull origin main
git checkout -b feature/microsoft-clarity-analytics
```

Expected: You are now on branch `feature/microsoft-clarity-analytics`

---

### Task 2: Install the Clarity package

**Files:**
- Modify: `frontend/package.json` (via npm install)

**Step 1: Install the package**

```bash
cd frontend
npm install @microsoft/react-native-clarity
```

Expected: Package added to `node_modules/` and `package.json` dependencies.

**Step 2: Verify installation**

```bash
cat frontend/package.json | grep clarity
```

Expected output: `"@microsoft/react-native-clarity": "x.x.x"`

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(analytics): install @microsoft/react-native-clarity"
```

---

### Task 3: Add Clarity project ID to app config

**Files:**
- Modify: `frontend/app.config.js` (add `clarityProjectId` to `extra`)
- Modify: `frontend/.env.example` (document the env var)

**Step 1: Update `app.config.js`**

In the `extra` section (line ~64), add `clarityProjectId`:

```js
extra: {
    // Analytics
    clarityProjectId: process.env.CLARITY_PROJECT_ID || "w0q4nzuzaa",
    // API Configuration
    apiBaseUrl: process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "",
    eas: {
        projectId: "6760a9ac-697b-4e25-9f44-0d0ecc8edbbb",
    },
    // ... rest of existing config
```

**Step 2: Update `.env.example`**

Add after the existing env vars:

```bash
# ── Microsoft Clarity Analytics ──────────────────────────────
#
# Session replay and heatmaps. Get project ID from:
# https://clarity.microsoft.com/
#
# Default is already set in app.config.js — only override here
# if you need to use a different Clarity project.
#
CLARITY_PROJECT_ID=w0q4nzuzaa
```

**Step 3: Commit**

```bash
git add frontend/app.config.js frontend/.env.example
git commit -m "chore(analytics): add Clarity project ID to app config"
```

---

### Task 4: Create clarityService wrapper

**Files:**
- Create: `frontend/src/services/analytics/clarityService.js`

**Step 1: Create the analytics directory and service file**

Create `frontend/src/services/analytics/clarityService.js` with this content:

```js
import * as Clarity from "@microsoft/react-native-clarity";
import Constants from "expo-constants";
import Logger from "../../utils/logger";

/**
 * Clarity Analytics Service
 *
 * Wraps Microsoft Clarity SDK for session replay and heatmaps.
 * Usage:
 *   - clarityService.initialize() — call once on app start (root layout)
 *   - clarityService.setUser(id, username) — call after successful login
 *   - clarityService.clearUser() — call on logout
 */

const PROJECT_ID =
    Constants.expoConfig?.extra?.clarityProjectId || "w0q4nzuzaa";

let isInitialized = false;

/**
 * Initialize Clarity. Call once when the app starts.
 * Safe to call multiple times (idempotent).
 */
export function initializeClarity() {
    if (isInitialized) return;

    try {
        Clarity.initialize(PROJECT_ID, {
            logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
        });
        isInitialized = true;
        Logger.log("[Clarity] Initialized with project:", PROJECT_ID);
    } catch (error) {
        Logger.error("[Clarity] Initialization failed:", error);
    }
}

/**
 * Identify the current user. Call after successful login or auth restore.
 * @param {string|number} userId - Your backend user ID
 * @param {string} [username] - Optional display name / username
 */
export function setClarityUser(userId, username) {
    if (!isInitialized) return;

    try {
        const id = String(userId);
        Clarity.setCustomUserId(id);
        if (username) {
            Clarity.setCustomSessionId(`user_${id}`);
        }
        Logger.log("[Clarity] User set:", id, username);
    } catch (error) {
        Logger.error("[Clarity] setUser failed:", error);
    }
}

/**
 * Clear user identification. Call on logout.
 */
export function clearClarityUser() {
    if (!isInitialized) return;

    try {
        Clarity.setCustomUserId("anonymous");
        Logger.log("[Clarity] User cleared");
    } catch (error) {
        Logger.error("[Clarity] clearUser failed:", error);
    }
}

const clarityService = {
    initialize: initializeClarity,
    setUser: setClarityUser,
    clearUser: clearClarityUser,
};

export default clarityService;
```

**Step 2: Commit**

```bash
git add frontend/src/services/analytics/clarityService.js
git commit -m "feat(analytics): add Clarity service wrapper"
```

---

### Task 5: Initialize Clarity in root layout

**Files:**
- Modify: `frontend/app/_layout.js`

**Step 1: Add import at the top of the file** (after existing imports)

```js
import clarityService from "../src/services/analytics/clarityService";
```

**Step 2: Call `clarityService.initialize()` inside the existing `useEffect([], [])` block**

Find the first useEffect (around line 25) that starts with `initAuth()`. Add the initialize call as the very first line inside it:

```js
useEffect(() => {
    // Initialize analytics
    clarityService.initialize();

    // Load tokens and user data from SecureStore when the app starts
    initAuth();
    // ... rest of existing code
```

**Step 3: Commit**

```bash
git add frontend/app/_layout.js
git commit -m "feat(analytics): initialize Clarity on app start"
```

---

### Task 6: Set user identity in auth store

**Files:**
- Modify: `frontend/src/context/useAuthStore.js`

**Step 1: Add clarityService import** (after existing imports)

```js
import clarityService from "../services/analytics/clarityService";
```

**Step 2: Set user in `initAuth` — after successful user fetch**

Find the block where `userData` is set (around line 37). Add `clarityService.setUser()` right after:

```js
const userData = await apiService.getMe();
// Identify user in analytics
clarityService.setUser(userData.id, userData.username || userData.email);
set(
    {
        user: userData,
        // ... rest
```

**Step 3: Clear user in `logout`** — add before the `set()` call:

```js
logout: async () => {
    await deleteToken("accessToken");
    await deleteToken("refreshToken");
    apiService.clearToken();
    clarityService.clearUser();  // ← add this line
    set(
        { user: null, accessToken: null, refreshToken: null },
```

**Step 4: Commit**

```bash
git add frontend/src/context/useAuthStore.js
git commit -m "feat(analytics): set Clarity user identity on login/logout"
```

---

### Task 7: Verify the integration compiles

**Step 1: Check for JavaScript syntax errors**

```bash
cd frontend
node --input-type=module < src/services/analytics/clarityService.js 2>&1 || true
```

If no parse errors, output is empty or a module error (expected since it's not a runnable script).

**Step 2: Run existing tests to ensure nothing broke**

```bash
cd frontend
npm test -- --passWithNoTests 2>&1 | tail -20
```

Expected: All tests pass (or no tests affected).

**Step 3: Confirm all 4 modified/created files are clean**

```bash
git diff --name-only HEAD~4
```

Expected output (4 files):
```
frontend/app/_layout.js
frontend/src/context/useAuthStore.js
frontend/src/services/analytics/clarityService.js
frontend/app.config.js
```

---

### Task 8: Create the Pull Request

**Step 1: Push the branch**

```bash
git push -u origin feature/microsoft-clarity-analytics
```

**Step 2: Create the PR**

```bash
gh pr create \
  --title "feat(analytics): integrate Microsoft Clarity for session replay" \
  --base main \
  --body "$(cat <<'EOF'
## Summary

- Installs `@microsoft/react-native-clarity` package
- Creates `clarityService.js` wrapper with initialize/setUser/clearUser
- Initializes Clarity on app start in root layout
- Sets custom user ID after login (and clears on logout) for user-tied session recordings
- Adds `clarityProjectId` to `app.config.js` extra config (overridable via env var)

## Why Clarity?

Fully free with unlimited sessions — perfect for tracking how test users and real users interact with the app before and after production launch. Provides session replay + tap heatmaps with minimal performance overhead.

## Notes

- **EAS Build required** — Clarity SDK uses native code, Expo Go is not supported (project already uses dev-client)
- After merging, a new EAS build is needed to activate the SDK on device
- In `__DEV__` mode, Clarity logs verbosely to help debug initialization; in production, logging is silent
- Project ID: `w0q4nzuzaa` (already configured in Clarity dashboard)

## Test plan

- [ ] Build with EAS (`eas build --profile development`)
- [ ] Open the app and verify Clarity dashboard shows a new session
- [ ] Login with a test user → verify session is tagged with user ID in Clarity
- [ ] Logout → verify next session shows "anonymous"
- [ ] Navigate through key screens (home, create, profile) → verify tap heatmaps appear

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Important Notes for EAS Build

After merging this PR, you need a **new EAS build** to get the native Clarity SDK compiled in:

```bash
cd frontend
eas build --profile development --platform android  # or ios
```

The SDK will NOT work in an existing build — native modules require a rebuild.
