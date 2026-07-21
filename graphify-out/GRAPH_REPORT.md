# Graph Report - .  (2026-07-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 492 nodes · 677 edges · 41 communities (37 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b88ae14`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- react
- api.js
- getDB
- Icons.tsx
- dependencies
- compilerOptions
- devDependencies
- package.json
- components.json
- compilerOptions
- dependencies
- ProcessLogPanel.tsx
- backup.js
- plugins
- MediaLibrary.tsx
- src/components/ui/card.tsx
- @/components/ui/badge.tsx
- button.tsx
- src/components/ui/badge.tsx
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `getDB()` - 29 edges
2. `react` - 24 edges
3. `compilerOptions` - 21 edges
4. `Toast` - 17 edges
5. `compilerOptions` - 15 edges
6. `stopProcess()` - 9 edges
7. `startProcess()` - 8 edges
8. `scanFolder()` - 8 edges
9. `scripts` - 7 edges
10. `backup()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `getAppTypes()` --calls--> `getDB()`  [EXTRACTED]
  routes/api.js → database/db.js
- `getLogs()` --calls--> `getDB()`  [EXTRACTED]
  services/process-manager.js → database/db.js
- `getProcessStatus()` --calls--> `getDB()`  [EXTRACTED]
  services/process-manager.js → database/db.js
- `startProcess()` --calls--> `getDB()`  [EXTRACTED]
  services/process-manager.js → database/db.js
- `stopProcess()` --calls--> `getDB()`  [EXTRACTED]
  services/process-manager.js → database/db.js

## Import Cycles
- None detected.

## Communities (41 total, 4 thin omitted)

### Community 0 - "react"
Cohesion: 0.07
Nodes (40): api, Task, tasksApi, taskStatusesApi, App(), AdbDevice, AdbDevicePanel(), AdbDevicePanelProps (+32 more)

### Community 1 - "api.js"
Cohesion: 0.06
Nodes (51): APP_TYPES_PATH, express, fs, { getDB }, logFile, mime, multer, os (+43 more)

### Community 2 - "getDB"
Cohesion: 0.07
Nodes (32): path, config, getDB(), knex, migrate(), path, down(), { getDB } (+24 more)

### Community 3 - "Icons.tsx"
Cohesion: 0.09
Nodes (33): IconApp(), IconArrowDown(), IconArrowUp(), IconChevronRight(), IconCircle(), IconClipboard(), IconEdit(), IconFolder() (+25 more)

### Community 4 - "dependencies"
Cohesion: 0.07
Nodes (27): @base-ui/react, class-variance-authority, dependencies, @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, lucide-react (+19 more)

### Community 5 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 6 - "devDependencies"
Cohesion: 0.08
Nodes (24): devDependencies, oxlint, @types/node, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+16 more)

### Community 7 - "package.json"
Cohesion: 0.09
Nodes (22): concurrently, allowScripts, better-sqlite3@12.11.1, author, description, devDependencies, concurrently, directories (+14 more)

### Community 8 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 10 - "dependencies"
Cohesion: 0.11
Nodes (19): better-sqlite3, ejs, express, express-ejs-layouts, knex, multer, dependencies, better-sqlite3 (+11 more)

### Community 11 - "ProcessLogPanel.tsx"
Cohesion: 0.16
Nodes (8): DebugOverlayBadges(), OverlayEntry, Props, ACTIONS, FlutterQuickActions(), FlutterQuickActionsProps, ProcessLogPanelProps, TerminalInputProps

### Community 12 - "backup.js"
Cohesion: 0.24
Nodes (12): backup(), BACKUP_DIR, cleanup(), config, fs, getBackupFilename(), getBackupPath(), getDateStr() (+4 more)

### Community 14 - "plugins"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 16 - "MediaLibrary.tsx"
Cohesion: 0.32
Nodes (7): Folder, formatSize(), isViewable(), MediaItem, MediaLibrary(), Project, viewableTypes

### Community 17 - "src/components/ui/card.tsx"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

## Knowledge Gaps
- **208 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `Icons.tsx`, `ProcessLogPanel.tsx`, `select.tsx`, `plugins`, `@/components/ui/card.tsx`, `MediaLibrary.tsx`, `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `Sidebar()` connect `react` to `Icons.tsx`, `dependencies`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.06830601092896176 - nodes in this community are weakly interconnected._
- **Should `api.js` be split into smaller, more focused modules?**
  _Cohesion score 0.056261343012704176 - nodes in this community are weakly interconnected._
- **Should `getDB` be split into smaller, more focused modules?**
  _Cohesion score 0.06968641114982578 - nodes in this community are weakly interconnected._