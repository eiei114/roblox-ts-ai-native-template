# AI-native multi-place development contract

- This is a standalone private multi-place roblox-ts template, not the ReVIEW book toolchain.
- Work on TypeScript in `src/server`, `src/client`, and `src/shared`. Never edit generated `out/` or `include/`.
- Runtime code targets Roblox/Luau, not Node or browsers. Do not use DOM, Node APIs, arbitrary npm runtime packages, `null`, or `any`.
- Keep server authority on the server. Never trust client input for rewards, purchases, or persistence.
- TypeScript is pinned to the version supported by roblox-ts. Do not replace it with latest TypeScript or tsgo without a separate compatibility test.
- Read `compiler.project.json` and `places/*.project.json` before moving source folders. Never serve the compiler-only project.
- Lobby and Game have separate server/client entries. Common server code stays in ServerScriptService, not ReplicatedStorage. Shared code must not contain secrets.
- Keep placement paths consistent across compiler and per-place Rojo mappings. Never import another place's entry point.
- No Place IDs or Teleport flow are configured. Do not invent IDs or publish Experiences without approval.
- Fast loop: `npm run check`. Format: `npm run format`. Machine-readable diagnostics: `npm run --silent lint:json`.
- Fast Oxlint is native-only. `lint:roblox` adds syntax rules through the Roblox JS plugin; `lint:typed` adds type-aware checks. Both run in `check:full`.
- External declaration-file validation is excluded because of pinned Roblox typing compatibility. User-source type checks stay enabled in build/typecheck/full checks. Do not claim dependency declarations were fully validated.
- Before handing off: `npm run check:full` and `npm run place`. These are local checks, not GitHub Actions.
- Build success is not a Studio playtest. Report separately whether Studio Play and multiplayer behavior were tested.
- Do not publish experiences, enable paid services, change secrets, run CI, or push without explicit approval.
- In a one-shot experiment, emit only the requested response. Do not repair the result after measurement; mark failed validation separately.
