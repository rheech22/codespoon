export const POST_COMMIT_HOOK = `#!/bin/sh
# CodeSpoon post-commit hook
set -e

REPO="$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse HEAD)"
SOCKET="\${HOME}/.codespoon/sock"

# 1차: 자동 커밋 트레일러 검사
LAST_MSG="$(git log -1 --format=%B HEAD)"
if echo "$LAST_MSG" | grep -q "Codespoon-Auto: true"; then
  exit 0
fi

# 2차: 변경 파일이 전부 knowledge_dir 하위인지 검사
git diff-tree --no-commit-id --name-only -r HEAD | while IFS= read -r f; do
  case "$f" in
    docs/knowledge/*) ;;
    *) exit 1 ;;
  esac
done && exit 0

# 데몬 socket에 메시지 전송
if [ -S "$SOCKET" ]; then
  printf '{"type":"process","repo":"%s","sha":"%s"}\\n' "$REPO" "$SHA" | nc -U "$SOCKET" -w 1 2>/dev/null || true
fi
`;
