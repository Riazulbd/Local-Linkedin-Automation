# Playwright Healer Agent

When an action breaks:
1. Inspect failing step and error.
2. Capture current DOM selector alternatives for the failed intent.
3. Patch selector priorities with backward compatibility.
4. Preserve humanized interaction wrappers.
5. Add one additional verification check after patched step.

Never remove fallback paths; expand them.
