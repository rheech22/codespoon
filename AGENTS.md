# AGENTS.md — Working Guide

This file guides agents (AI or human) modifying the codespoon codebase.

## Orientation

- **What this is**: a CLI that drives a coding-agent CLI (OpenCode, Claude Code, etc.) as a worker to keep domain knowledge nodes in sync with code. See [README.md](README.md) for the user-facing story.
- **Status**: MVP. Bootstrap loop and auto-maintenance loop both validated against a real Next.js codebase.
- **Language / runtime**: TypeScript (strict, ESM), Node 20+
- **Tests**: Vitest
- **Package**: published to npm as `codespoon`

---

## 1. Core layer is pure, side effects live in adapters

`src/core/` should be free of I/O wherever possible. This lets the daemon reuse
the same logic against in-memory inputs without hitting disk.

**Good signature:**
```ts
validateNodeContent(raw: string, opts: { rootDir, config }): ValidationResult
generateGraphFromNodes(nodes: NodeDocument[]): Graph
```

**File I/O lives in a thin wrapper:**
```ts
function validateNodeFile(filePath, rootDir, config): ValidationResult {
  return validateNodeContent(readFileSync(filePath, 'utf-8'), { rootDir, config });
}
```

---

## 2. Commands are thin adapters

Functions in `src/commands/` return result objects. The CLI entry point in
`src/cli.ts` handles output rendering and `process.exit`.

```ts
// commands/validate.ts — pure
export function runValidate(options): { exitCode, summary, results }

// cli.ts — adapter
.action((files, options) => {
  const result = runValidate({...});
  options.json ? renderJson(result) : renderHuman(result);
  process.exit(result.exitCode);
});
```

**Don't:**
- Call `process.exit()` inside business logic
- Call `console.log` outside render functions
- Branch on `--json` / `--quiet` flags in business logic

---

## 3. Agent writes the file; we validate

The agent invocation contract is: the agent uses its native edit/write tool
to write the knowledge-node file. We don't parse stdout — we read the file
and validate it.

This is the central design choice. It removes the brittleness of
stdout parsing (preambles, code fences, tool loops). See the
`refactor(daemon)` commit in git log for context.

Implications:
- prompts say "write the file at `<path>` using your edit tool"
- `runAgentLoop` watches the file's mtime to detect actual writes
- on terminal failure, the original (if any) is restored; broken content is preserved in `.codespoon/runs/<run>/<id>.broken.md` for inspection

---

## 4. Validation is the immune system

`codespoon validate` isn't only for humans — it's the gate that decides
whether agent output is allowed to land. Treat new rules as new checks
added to the `CHECKS` array in `src/core/validation.ts`:

```ts
type Check = (ctx: CheckContext) => ValidationMessage[];
const CHECKS: Check[] = [checkSchema, checkSources, checkSections, ...];
```

**Conventions:**
- Errors block; warnings inform.
- Every new error rule needs a negative fixture and a test (see `tests/fixtures/`).
- Validators must handle markdown structures correctly — naive `split(/\s+/)` misses link targets, code fences, etc.

---

## 5. Validate external input with zod at boundaries

YAML config, frontmatter, agent output, and CLI args all pass through
zod schemas. Use `.safeParse` so we can surface friendly messages instead of
stack traces. `loadConfigStrict` is the canonical helper for config loading.

Schemas use `.strict()` where extra fields would be a bug.

---

## 6. Paths

- Use `node:path` (`relative`, `resolve`, `isAbsolute`, `join`).
- Never simulate path operations with string `replace(root, '')` — symlinks and Windows break it.
- For glob matching, use `picomatch` or `fast-glob`'s match functions; don't substitute `startsWith(prefix)` after stripping `/**`.

---

## 7. IDs and timestamps

- SHAs / UUIDs / opaque IDs are not lexicographically ordered. Don't sort or compare them as strings.
- When you need an ordering, use a timestamp (ISO 8601) or an external authority (git).
- Node `id` is immutable by design — `processNode` rejects agent output that changes it.

---

## 8. Body content checks must understand markdown

The validator strips link constructs `[text](target)` before scanning for
absolute paths in body. New body-level checks should do the same. Use word
boundaries (`(?<![\w/])`) so a path like `/web/foo.ts` inside
`apps/web/foo.ts` is not flagged as absolute.

---

## 9. Idempotent commands

`init` and `install-hook` may be run repeatedly. They must:
- check each item they create individually (no "any-of" shortcuts)
- never silently overwrite user state
- be safe to re-run any number of times

---

## 10. Config defaults live in one place

`DEFAULTS` is derived from the schema: `export const DEFAULTS = ConfigSchema.parse({})`.
Don't maintain a parallel object — it drifts.

If `cac` already sets a default for a CLI option, don't add `|| '.'` at the call site.

---

## 11. Testing

- Fixture names describe what they exercise. A fixture named `missing-section` must actually be missing a section, and the test must check the negative case.
- Each fixture directory may contain a one-line README explaining intent.
- Every error/warning rule in the validator needs at least one test.
- Prefer unit tests against pure core functions. If a `commands/*` function is hard to test, that usually means presentation and logic are still tangled.

---

## 12. Style and naming

- TypeScript strict mode; minimize `any` and `!` non-null assertions.
- ESM project — import paths end in `.js`.
- YAML keys are `snake_case`; JSON keys are `camelCase`. This split is intentional (YAML for humans, JSON for machines).
- Code and comments in English. User-facing CLI messages also in English.
- Comments only when *why* is not self-evident. The exception is referencing a non-obvious workaround or a specific design decision.

---

## 13. Adding dependencies

Before adding a dependency:
1. Can the standard library do it (`node:*`)?
2. Can an already-installed dependency do it? (E.g., `fast-glob` includes glob matching utilities.)
3. Prefer small, well-maintained libraries.

Record the reason in the commit message.

---

## 14. Logging and output

Use the logger in `src/core/logger.ts` instead of `console.*` directly. The
daemon emits structured output and runs detached — interleaving with `console.log`
breaks that contract. Color formatting belongs in render functions (CLI adapter
layer), not in business logic.

---

## 15. Checklist before merge

- [ ] Build passes (`pnpm run build`)
- [ ] Tests pass (`pnpm run test`)
- [ ] New external input is validated by zod
- [ ] New business logic does not depend on `process.exit` or `console.*`
- [ ] If you changed CLI output, snapshot or matcher tests reflect the new strings
- [ ] If a new error/warning rule was added, a fixture and test exist
- [ ] Commit message names the *why*, not just the *what*

---

## Working flow recap

1. Locate the change in README's architecture overview.
2. Write pure core functions first.
3. Wire them through commands and CLI adapters.
4. Add fixtures and tests in the same change.
5. Confirm `pnpm test` and `pnpm build` pass.
6. Commit with a message that explains the intent.
