# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@iobroker/json-config` — React component library that renders JSON-based configuration UIs for ioBroker adapters. Adapters define their settings UI via a JSON/JSON5 schema, and this library renders it as a Material-UI form.

## Commands

```bash
npm run build          # tsc && tsc-alias && node after_build (copies types.d.ts to build/)
npm run lint           # eslint -c eslint.config.mjs
npm test               # compiles test/testSchema.ts to CJS, then runs AJV schema validation
npm run clean          # rimraf build
```

There is no watch mode or dev server — this is a library consumed by ioBroker admin.

## Architecture

### Core flow

1. **JsonConfig** (`src/JsonConfig.tsx`) — Top-level component. Loads `jsonConfig.json5` (with `#include` support and circular-reference detection), handles password encryption/decryption (AES-192-CBC via crypto-js, with legacy XOR fallback), manages file subscriptions for hot-reload, and coordinates save/validation.

2. **JsonConfigComponent** (`src/JsonConfigComponent/index.tsx`) — Orchestrator that receives a schema tree and recursively renders the correct component for each config item. Loads i18n translations, tracks errors, and processes backend commands.

3. **ConfigPanel** (`src/JsonConfigComponent/ConfigPanel.tsx`) — Renders panel/accordion layouts with collapsible sections.

4. **ConfigGeneric** (`src/JsonConfigComponent/ConfigGeneric.tsx`) — Abstract base class all ~60 config item components extend. Provides `getValue()`/`setValue()` for nested data paths, conditional enable/disable/hidden evaluation, confirmation dialogs, and instance-alive checks.

### Component pattern

Each `Config*.tsx` file in `src/JsonConfigComponent/` handles one `type` value from the schema (e.g., `ConfigText` handles `type: "text"`, `ConfigSelect` handles `type: "select"`). Components extend `ConfigGeneric` and override `renderItem()`.

### Type system

`src/types.d.ts` defines 80+ discriminated-union config item types (`ConfigItemText`, `ConfigItemSelect`, etc.) plus `JsonConfigContext`, backend command types, and icon enums.

### Schema validation

`schemas/jsonConfig.json` (411KB) is the authoritative JSON Schema. Tests in `test/testSchema.ts` validate positive (`testJsonConfig.json`) and negative (`testFailJsonConfig.json`) cases using AJV. When adding new config item types, update both `src/types.d.ts` and `schemas/jsonConfig.json`.

### Exports

`src/index.tsx` re-exports `JsonConfig`, `JsonConfigComponent`, `ConfigPanel`, `ConfigGeneric`, and all TypeScript types.

## Key conventions

- ESLint config comes from `@iobroker/eslint-config` with React rules; jsdoc rules are disabled
- TypeScript targets ES2022 with ESNext modules, `jsx: react`, and `@iobroker/types`
- Build output goes to `build/` as ESM with declarations and source maps
- `after_build.js` copies `src/types.d.ts` → `build/types.d.ts` so types are available at package root
- Dependency system: components use `alsoDependsOn`, `hidden`/`disabled` formulas, and `onChange` callbacks for cross-field reactivity
