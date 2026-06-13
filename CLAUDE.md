# Project context

- Vite + React 19 frontend (JSX, no TypeScript)
- Firebase IS integrated (src/firebase.js): used for auth/login, centre selection, and per-centre app-state sync (Firestore)
- Persistence model: Firestore (per centre, keyed by centerId) is the source of truth in production; localStorage is the immediate local mirror. App state runs deployed/remote — local dev is for code changes that get pushed
- Saving an allocation writes to Firestore immediately (other changes are debounced ~2s); writes are also flushed on pagehide so a refresh never drops a pending write
- A monotonic `__stamp` is stored alongside the state in both localStorage and Firestore. On mount the remote snapshot is merged (MERGE_REMOTE_STATE) unless the local stamp is STRICTLY newer (a save not yet synced). The comparison uses `>=` so legacy/unstamped remote docs (`__stamp` absent → 0) still load. This prevents a stale remote from clobbering freshly-saved local data without blocking normal loads. Keep this guard if you touch persistence in src/store.jsx
- Priority: keep persistence reliable (no data loss on refresh)

# Stack

- Vite 8 + React 19 (JSX only)
- State management: Context API via src/store.jsx (AppProvider wraps the whole app)
- Drag and drop: @hello-pangea/dnd
- Excel export: xlsx library
- No routing library — navigation handled internally
- No UI component library — custom components only
- No Tailwind — styling via App.css, index.css, saas.css

# File structure

- Per la mappa dettagliata del progetto vedere .claude/PROJECT_MAP.md
- App.jsx — root entry, wraps everything in AppProvider
- AppShell.jsx — app shell and layout
- src/store.jsx — global state, DO NOT modify unless explicitly asked
- src/components/ — reusable UI components
  - activities/ — activity grid, editor, day view, cells
  - steps/ — multi-step flow (Guests, Accommodation, Rules, Allocation, Export)
- src/pages/ — tab-level screens (Gruppi, Ospiti, Allocazioni, Activities, etc.)
- src/lib/ — core logic (activityConfig, activityUtils, dateUtils, mergeUtils)
- src/utils/ — additional utilities (ageBands, allocation, excel)

# Working style

- Prefer minimal, targeted edits — do not touch unrelated files
- Preserve existing UI and logic unless explicitly asked to change it
- Do not refactor working code opportunistically
- For small changes: implement directly, no planning needed
- For multi-file changes: explore first, propose a plan, wait for approval before implementing
- Do not install new dependencies without explicit confirmation

# Data and state

- All global state lives in src/store.jsx — do not restructure it without being asked
- No real data layer yet — work with whatever state/props are already in place
- Excel import/export logic is in src/utils/excel.js — do not modify unless asked

# Code style

- JSX components: PascalCase filenames
- Utilities and lib files: camelCase filenames
- CSS: use existing class patterns from App.css / index.css / saas.css
- No inline styles unless already present in the file being edited
- No console.log left in code after edits

# Verification

- When debugging: always explain root cause before proposing a fix
- After editing a component, confirm that parent/sibling components are not affected
- Date logic must use src/lib/dateUtils.js — do not reimplement date handling inline
