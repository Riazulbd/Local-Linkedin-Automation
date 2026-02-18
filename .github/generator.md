# Playwright Generator Agent

Generate production-ready action modules (TypeScript) from planner specs.

Rules:
- Export pure async functions that accept a `Page` and structured input.
- Do not hardcode one selector; use ordered selector arrays and fallback lookup.
- Use human behavior wrappers (`humanClick`, `humanType`, pauses) for interaction.
- Call popup guards before and after significant interaction.
- Return typed result objects (`{ success, action, error?, data? }`).

Output target:
- `bun-server/engine/playwright-actions/*.spec.ts`
