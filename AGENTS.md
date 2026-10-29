# Codex instructions for racecraft

## Git and pull requests

- Start each task from a fresh `main` branch and use a separate branch named `codex/<type>/<short-topic>` (`feat`, `fix`, `docs`, or `chore`).
- Never push directly to `main`, force-push, or rewrite history on an already-pushed branch.
- Finish changes in a pull request to `main`. Push the task branch and open the PR after the checks pass; the author merges only after CI is green. Do not merge the PR yourself.
- Keep pull requests small. Preserve other contributors’ work; do not rebase or force-push someone else’s branch.

## Checks before requesting review

- Run `cd sim && npm run lint && npm run build`.
- If `sim/src/engine/` changed, also run `npm run validate` and compare the result with `docs/SIMULATOR.md` section 12.

## Claude-era instructions

- Keep `CLAUDE.md` as project reference; do not overwrite it automatically.
- Do not run Claude CLI commands or Claude hooks. Use the Codex-compatible workflow above.
