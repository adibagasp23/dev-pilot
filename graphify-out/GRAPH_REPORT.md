# Graph Report - .  (2026-07-21)

## Corpus Check
- 91 files · ~50,094 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 520 nodes · 688 edges · 48 communities (44 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend API & Database Layer
- Frontend React Core
- UI Icon Library
- Express Server Setup
- NPM Dependencies
- TypeScript App Config
- Dev Dependencies
- Backend Dependencies
- Root Package Config
- UI Component Config
- TypeScript Node Config
- Documentation & Architecture
- Flutter & Debug Widgets
- Linter Config
- Media Library Page
- Card UI Component (Internal)
- Badge UI Component
- Button UI Component
- TypeScript Root Config
- HTML Entry & Icons

## God Nodes (most connected - your core abstractions)
1. `react` - 24 edges
2. `compilerOptions` - 21 edges
3. `toast` - 17 edges
4. `compilerOptions` - 15 edges
5. `getDB()` - 15 edges
6. `stopProcess()` - 9 edges
7. `startProcess()` - 8 edges
8. `scanFolder()` - 8 edges
9. `scripts` - 7 edges
10. `backup()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Favicon SVG (Purple Diamond/Lightning Shape)` --references--> `Dev Pilot Application`  [INFERRED]
  client/public/favicon.svg → README.md
- `Hero Banner Image` --references--> `Dev Pilot Application`  [INFERRED]
  client/src/assets/hero.png → README.md
- `Vite Logo SVG` --references--> `React-based Architecture (Current Implementation)`  [INFERRED]
  client/src/assets/vite.svg → AGENTS.md
- `React Vite Template Client README` --references--> `React-based Architecture (Current Implementation)`  [INFERRED]
  client/README.md → AGENTS.md
- `Remote Configuration v2 Feature` --conceptually_related_to--> `Dev Pilot Application`  [INFERRED]
  docs/CHANGELOG-feat-remote-config-v2.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Original Process Manager Architecture** — docs_superpowers_specs_2026_07_15_process_manager_design_md_pm_design, docs_superpowers_specs_2026_07_15_process_manager_design_md_htmx_architecture, docs_superpowers_plans_2026_07_15_process_manager_implementation_md_pm_plan [INFERRED 0.85]
- **Kanban Task Board Feature Architecture** — docs_superpowers_specs_2026_07_15_kanban_task_board_design_md_kanban_design, docs_superpowers_plans_2026_07_15_kanban_task_board_implementation_md_kanban_plan, docs_superpowers_plans_2026_07_15_kanban_task_board_implementation_md_drag_and_drop [INFERRED 0.95]

## Communities (48 total, 4 thin omitted)

### Community 0 - "Backend API & Database Layer"
Cohesion: 0.05
Nodes (59): config, getDB(), knex, migrate(), path, ADB, APP_TYPES_PATH, express (+51 more)

### Community 1 - "Frontend React Core"
Cohesion: 0.06
Nodes (45): api, Task, tasksApi, taskStatusesApi, App(), AdbDevice, AdbDevicePanel(), AdbDevicePanelProps (+37 more)

### Community 2 - "UI Icon Library"
Cohesion: 0.11
Nodes (27): IconApp(), IconChevronRight(), IconCircle(), IconFolder(), IconFolderOpen(), IconLock(), IconMedia(), IconMonitor() (+19 more)

### Community 3 - "Express Server Setup"
Cohesion: 0.10
Nodes (23): path, apiRoutes, app, clientBuild, config, express, fs, logDir (+15 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.07
Nodes (27): @base-ui/react, class-variance-authority, dependencies, @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, lucide-react (+19 more)

### Community 5 - "TypeScript App Config"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 6 - "Dev Dependencies"
Cohesion: 0.08
Nodes (24): devDependencies, oxlint, @types/node, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+16 more)

### Community 7 - "Backend Dependencies"
Cohesion: 0.09
Nodes (23): better-sqlite3, ejs, express, express-ejs-layouts, http-proxy-middleware, knex, multer, dependencies (+15 more)

### Community 8 - "Root Package Config"
Cohesion: 0.09
Nodes (22): concurrently, allowScripts, better-sqlite3@12.11.1, author, description, devDependencies, concurrently, directories (+14 more)

### Community 9 - "UI Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "TypeScript Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 11 - "Documentation & Architecture"
Cohesion: 0.15
Nodes (18): Dev Pilot Process Manager Guide (AGENTS.md), React-based Architecture (Current Implementation), Favicon SVG (Purple Diamond/Lightning Shape), React Vite Template Client README, Hero Banner Image, Vite Logo SVG, Remote Configuration v2 Changelog, Remote Configuration v2 Feature (+10 more)

### Community 12 - "Flutter & Debug Widgets"
Cohesion: 0.15
Nodes (10): DebugOverlayBadges(), OverlayEntry, Props, ACTIONS, FlutterQuickActions(), FlutterQuickActionsProps, ProcessLogPanelProps, TerminalInputProps (+2 more)

### Community 14 - "Linter Config"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 16 - "Media Library Page"
Cohesion: 0.32
Nodes (7): Folder, formatSize(), isViewable(), MediaItem, MediaLibrary(), Project, viewableTypes

### Community 17 - "Card UI Component (Internal)"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

## Knowledge Gaps
- **213 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+208 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Frontend React Core` to `UI Icon Library`, `Flutter & Debug Widgets`, `Select UI Component`, `Linter Config`, `Card UI Component (Shadcn)`, `Media Library Page`, `Card UI Component (Internal)`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies` to `Dev Dependencies`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `Sidebar()` connect `Frontend React Core` to `UI Icon Library`, `NPM Dependencies`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _213 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend API & Database Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05115089514066496 - nodes in this community are weakly interconnected._
- **Should `Frontend React Core` be split into smaller, more focused modules?**
  _Cohesion score 0.0574400723654455 - nodes in this community are weakly interconnected._
- **Should `UI Icon Library` be split into smaller, more focused modules?**
  _Cohesion score 0.10887096774193548 - nodes in this community are weakly interconnected._