export function buildPostCommitHook(knowledgeDir: string, daemonSocketPath: string): string {
  return `#!/bin/sh
# CodeSpoon post-commit hook

REPO="$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse HEAD)"

# 1차: 자동 커밋 트레일러 검사
if git log -1 --format=%B HEAD | grep -q "Codespoon-Auto: true"; then
  exit 0
fi

# 2차: 변경 파일이 전부 knowledge_dir 하위인지 검사
CHANGED="$(git diff-tree --no-commit-id --name-only -r HEAD || true)"
NON_KNOWLEDGE="$(echo "$CHANGED" | grep -vF "${knowledgeDir}/" || true)"
if [ -z "$NON_KNOWLEDGE" ] && [ -n "$CHANGED" ]; then
  exit 0
fi

# 데몬 socket에 메시지 전송 (codespoon notify-hook 사용)
if [ -S "${daemonSocketPath}" ]; then
  codespoon notify-hook --dir "$REPO" "$SHA" 2>/dev/null || true
fi
`;
}
