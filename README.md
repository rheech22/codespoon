# codespoon

> A spoonful of source-traced code context.
> Living domain docs your coding agent keeps in sync with every commit.

[![npm](https://img.shields.io/npm/v/codespoon.svg)](https://www.npmjs.com/package/codespoon)
[![license](https://img.shields.io/npm/l/codespoon.svg)](LICENSE)

`codespoon` keeps small, curated, **source-traced** domain documents next to
your code and lets your coding agent maintain them. When you commit, a local
daemon hands the change to your agent (OpenCode, Claude Code, …) which edits
the affected node files directly. Validation gates the result before it lands.

The idea: don't feed the whole repo to the model. Don't trust a stale wiki.
Keep a small set of human-readable knowledge nodes that always cite the code
they describe — and let the agent maintain them, file by file, as you work.

---

## Why another code-knowledge tool?

| Tool | What it gives the agent |
|---|---|
| `grep` / `ripgrep` | Exact string matches across a tree |
| [Repomix](https://github.com/yamadashy/repomix) | The whole repo packaged for one big LLM input |
| [aider repomap](https://aider.chat/docs/repomap.html) | Compressed signatures of the whole repo |
| [graphify](https://github.com/safishamsi/graphify) / [codegraph](https://github.com/colbymchenry/codegraph) | A queryable knowledge graph of symbols & calls |
| **codespoon** | **A few hand-picked domain docs that stay in sync with the code, written in markdown for humans to read** |

codespoon sits in a different niche from "index everything" tools. It targets
the gap between:

- **Wiki / hand-written docs** — useful but go stale in weeks
- **Full-repo graphs / packers** — comprehensive but undifferentiated

The pitch is curation + auto-maintenance: a small number of high-value
domain narratives with verifiable provenance, kept fresh automatically.

---

## How it works

```
your commit
   ↓ git post-commit hook
   ↓
codespoon daemon
   ↓ maps changed files → affected knowledge nodes
   ↓ invokes your agent CLI (opencode run …)
   ↓
agent edits the node file directly using its own write tool
   ↓ codespoon validates the file
   ↓ if valid: auto-commit "docs(codespoon): auto-update for <sha>"
   ↓ if not:   restore original, save broken content to .codespoon/runs/
```

Each knowledge node is a markdown file with YAML frontmatter:

```yaml
---
id: chat-session-flow
kind: domain
status: auto-updated
confidence: medium
scope:
  include:
    - apps/web/app/chat
sources:
  - path: apps/web/src/services/chat/core/chat-service.ts
    symbols: [ChatService, createSession]
relations:
  - target: app-bridge
    kind: related
    confidence: extracted
last_updated_commit: abc1234
last_updated_at: 2026-05-26
---

# Chat Session Flow

## Summary
…

## Entry Points
…

## Source Trace
- `apps/web/src/services/chat/core/chat-service.ts` :: ChatService, createSession
```

A `graph.json` is regenerated alongside it, so AI agents and tools can query
node relations and source paths machine-readably.

**Key design choice**: the agent writes the file via its own edit tool. We
don't parse stdout, so preambles, reasoning, and tool traces in the agent's
output are all ignored. The file on disk is the contract.

---

## Install

```bash
npm install -g codespoon
```

Requirements:
- Node.js ≥ 20
- A coding agent CLI on `PATH` (default: [`opencode`](https://opencode.ai))
- `git` in the target repository

---

## Quickstart

```bash
# 1. Scaffold in your repo
cd your-project
codespoon init

# 2. Detect candidate flows (no AI calls — pure static analysis)
codespoon bootstrap

# 3. Pick which candidates to create
$EDITOR .codespoon/runs/bootstrap-candidates.md
# Mark candidates with [x]

# 4. Let the agent fill them in
codespoon bootstrap --apply

# 5. Wire up auto-maintenance
codespoon install-hook
codespoon daemon start
```

From now on, when you commit code, the daemon updates affected nodes
behind the scenes.

To query nodes during a task:
```bash
codespoon spoon "chat session websocket"
```

---

## Commands

| Command | Purpose |
|---|---|
| `codespoon init` | Scaffold `codespoon.config.yaml`, `docs/knowledge/`, `.codespoon/` |
| `codespoon bootstrap` | Generate domain candidates from framework heuristics |
| `codespoon bootstrap --apply` | Have the agent write knowledge nodes for selected candidates |
| `codespoon validate` | Check node format, source paths, sections |
| `codespoon build` | Regenerate `graph.json` from the node files |
| `codespoon install-hook` | Install the git post-commit hook and inject `AGENTS.md` guidance |
| `codespoon daemon start \| stop \| status` | Manage the local daemon |
| `codespoon spoon <query>` | Search nodes by keyword (title / id / sources / symbols / body) |
| `codespoon process <sha>` | Manually re-trigger processing for a commit (debugging) |

---

## Configuration

`codespoon.config.yaml` at the repo root:

```yaml
knowledge_dir: docs/knowledge
state_dir: .codespoon

max_node_chars: 12000
retry_count: 3

ignore:
  - node_modules/**
  - .git/**

generated_paths:
  - src/api/**

agent:
  cli: opencode
  model: synthetic/hf:zai-org/GLM-5.1
  invoke_timeout_seconds: 300

framework_adapters:
  - next-app-router
```

Defaults are sensible; the file is optional but recommended.

---

## What gets committed where

```
your-project/
├─ codespoon.config.yaml        ← committed (team-shared)
├─ AGENTS.md                    ← committed (guidance for agents)
├─ docs/knowledge/              ← committed (the living docs)
│  ├─ nodes/<id>.md
│  └─ graph.json
└─ .codespoon/                  ← NOT committed (local state)
   ├─ cache/
   └─ runs/<sha>/
```

The auto-commit message format:

```
docs(codespoon): auto-update for abc1234

Affected nodes: chat-session-flow
Source commit: abc1234

Codespoon-Auto: true
```

The trailer prevents recursive hook firing.

---

## Status

MVP. The architecture has been validated end-to-end against a real Next.js
codebase. The next step is longitudinal evaluation — does the loop hold
accuracy and usefulness over weeks of real commits?

Things known to work:
- Bootstrap candidate detection for Next.js App Router (with tsconfig paths)
- File-write agent invocation via OpenCode
- Validation gate with retry feedback
- Auto-commit with recursion guard
- Multi-repo daemon

Things explicitly out of scope (for now):
- Vector / semantic search (`spoon` uses keyword matching by design)
- MCP server (the CLI surface is enough for current agent integrations)
- Multiple framework adapters beyond Next.js (Vite/Remix/etc. coming)
- Full impact tracking through `import` graphs (only `sources`-declared files trigger updates)

---

## Working with codespoon's own code

See [AGENTS.md](AGENTS.md) for working principles. Short version:

- Core layer is pure; side effects live in adapters
- Commands are thin (return result objects)
- Agent writes files; we validate
- Validation rules are immune-system gates — every new rule needs a fixture + test

```bash
pnpm install
pnpm run build
pnpm run test
pnpm link --global       # for local development
```

---

## License

MIT
