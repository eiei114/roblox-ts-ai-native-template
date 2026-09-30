# Luau / roblox-ts one-shot comparison

Status: protocol only; no model runs, token results, or generation speed claims yet.

## What is measured

Compare one response producing the same feature in Luau and roblox-ts. Do not force equal source length. Do not measure a repair conversation as if it were a one-shot response.

- Wall time: request sent to final response received, with start/end timestamps.
- Input tokens, cached input tokens, output tokens, and reasoning tokens when exposed by the provider. Keep categories separate and do not double-count cached tokens.
- Source bytes/lines are supplemental; they are not provider token usage.
- Validation success/failure: build and Studio behavior checked after generation, outside generation time.

## Controls

Use the same model version, provider, reasoning settings, output cap, functional specification, response format, and equivalent initial project state. State whether streaming, tools, and caching are enabled. In the simplest comparison, disable tools and request code only.

Specify equivalent Roblox APIs and acceptance criteria, with language-specific instructions limited to the required syntax/runtime constraints. Save both complete prompts; do not claim equal input context if they differ.

Run at least three paired trials if budget permits, alternate which language runs first, and report individual observations plus median/range. A single run is only an example, not proof of a language advantage.

## Workflow

1. Agree on model, budget, feature, and approval to invoke the provider.
2. Prepare matching clean project snapshots for both languages.
3. Send one request and retain the original response plus provider usage metadata.
4. Extract source without changing it. Run the predeclared validation once.
5. Record failure/truncation as failure; do not silently repair or exclude it.
6. Report generation time, token counts, and validity together. No Studio runtime verification means no claim that the feature works.

Oxc runs and roblox-ts compilation speed are a separate development-tool benchmark. This template currently supplies only the TypeScript baseline; a paired Luau baseline and experiment runner remain to be prepared.
