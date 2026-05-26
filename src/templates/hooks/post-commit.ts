export function buildPostCommitHook(knowledgeDir: string, daemonSocketPath: string): string {
  return `#!/bin/sh
# CodeSpoon post-commit hook

REPO="$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse HEAD)"

# Step 1: skip if the commit was created by codespoon itself
if git log -1 --format=%B HEAD | grep -q "Codespoon-Auto: true"; then
  exit 0
fi

# Step 2: skip if every changed file is under knowledge_dir
CHANGED="$(git diff-tree --no-commit-id --name-only -r HEAD || true)"
NON_KNOWLEDGE="$(echo "$CHANGED" | grep -vF "${knowledgeDir}/" || true)"
if [ -z "$NON_KNOWLEDGE" ] && [ -n "$CHANGED" ]; then
  exit 0
fi

# Notify the daemon over its Unix socket via codespoon notify-hook
if [ -S "${daemonSocketPath}" ]; then
  codespoon notify-hook --dir "$REPO" "$SHA" 2>/dev/null || true
fi
`;
}
