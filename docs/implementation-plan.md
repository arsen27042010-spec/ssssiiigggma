# Country game MVP Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track steps below.

**Goal:** Playable Russian browser strategy with authoritative multiplayer and the core economic/military loop.
**Architecture:** Pure deterministic game modules, a Node HTTP service with durable sessions, and an SVG client. One second simulation, five second economy, filtered player snapshots.
**Tech Stack:** Node.js 22+, vanilla JavaScript ES modules, HTML, CSS, SVG, node:test.
**Spec:** `docs/mvp-design.md`; original concept copied to `docs/country-game-design.md`.

## Global Constraints
- 48 land regions, 1–6 countries, 3 starting regions, 3 generals, 1800 seconds, trailing GDP window 300 seconds.
- Server validates ownership, resources and visibility; no hidden enemy units in snapshots or route hints.
- Money transfers and resale do not generate GDP. Commands are idempotent for the lifetime of the match.
- Reconnect restores the same country; final result immutable. No bots or paid progression.

## Review Focus
- Invalid numeric payloads, oversized requests and invalid session tokens: reject without mutation (tasks 1/3).
- Lost/repeated responses and server restart: no duplicate purchases or lost sessions (tasks 1/3).
- Partial shipment plus interception: paid amount plus refund equals escrow (task 2).
- Own units exploring outside borders: current observation must follow troops, stale enemy units disappear (task 2).
- General attack scope and manual takeover: no competing controller or unauthorized moves (task 2).

## Task 1: Match and economic rules
Files: `public/catalog.js`, `game/{world,economy,engine,commands,vision}.js`, `test/game.test.js`.
Interfaces: createMatch({id,speed,duration}), joinMatch(match,name), command(match,countryId,{id,type,...}), tick(match,seconds=1), snapshot(match,countryId).
- [x] Write tests for 48 regions, connected starts, lobby capacity, GDP, construction, visibility, invalid commands and idempotency. Run `node --test test/game.test.js`: fail on unimplemented exports.
- [x] Implement deterministic map, catalog, lifecycle, economy and commands. Run the same tests: pass.

## Task 2: Logistics and war
Files: `game/{logistics,military}.js`, extend commands/engine/vision; `test/systems.test.js`.
Interfaces: logisticsTick(match), militaryTick(match), visibility(match,countryId), route(match,from,to,allowed).
- [x] Write tests for escrow delivery/destruction, blocked paths, manual takeover, general authority, recovery, supply and victory. Run `node --test test/systems.test.js`: fail on missing behavior.
- [x] Implement shipments, orders, recruitment, battle, generals and final standings. Run `npm test`: pass.

## Task 3: Durable HTTP sessions
Files: `server/{index,app,store}.js`, `test/server.test.js`.
Interfaces: createServer({dataDir,autoTick=true}) returns {server,close}; REST /api/matches, /api/join, /api/state, /api/command.
- [x] Write HTTP tests for auth, join, command retries, immutable result, persistence and malformed payloads. Run `node --test test/server.test.js`: fail before server implementation.
- [x] Implement HTTP, bounded payloads, auth, polling, atomic JSON store. Run `npm test`: pass.

## Task 4: Playable interface and delivery
Files: `public/{index.html,styles.css,app.js,map.js}`, `README.md`, `start.cmd`.
- [x] Implement lobby, interactive map, economic inspector, troop orders, trade, relationships, generals, notifications, results and reconnect. UI consumes only filtered server state.
- [x] Run `npm run check` and test the app in a browser with two sessions; verify construction and reconnect.
- [x] Review final changes, fix substantive findings with regression tests, record test evidence and limitations in README.
