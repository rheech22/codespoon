# Phase 2: 데몬과 hook

> **소요 예상:** 2-3일
> **PLAN.md 참조:** 5장 (워커 아키텍처), 6장 (자동 유지 루프), 12.5절 (커밋 정책)

## 목표

commit → hook → 데몬 → 에이전트 호출 → validate → 자동 커밋의 한 사이클을 실제로 굴린다.

## 작업 목록

### 1. 데몬 서버 (`src/daemon/`)

- `server.ts` — Unix domain socket 서버 (한 줄 JSON 메시지)
- `queue.ts` — 저장소별 작업 큐, in-flight 상태, 직렬화
- `lifecycle.ts` — PID 파일, lazy auto-spawn, start/stop/status

### 2. CLI 명령

- `codespoon daemon start|stop|status` — 데몬 lifecycle 제어
- `codespoon install-hook` — post-commit hook 설치 + AGENTS.md/CLAUDE.md 안내 주입
- `codespoon process <sha>` — 특정 commit 수동 재처리

### 3. 자동 커밋 (`src/core/commit.ts`)

- 자동 커밋 생성 (명시적 경로만 staging)
- `Codespoon-Auto: true` 트레일러
- 재귀 방지 (트레일러 검사 + 변경 범위 확인)
- `git index.lock` 충돌 시 백오프 재시도

### 4. 에이전트 어댑터 (`src/adapters/agent/`)

- `index.ts` — 어댑터 인터페이스
- `opencode.ts` — `opencode run` 어댑터 (1차)
- 프롬프트 템플릿: 현재 노드 본문 + diff 요약 + 형식 규칙 + validate 오류

### 5. validate 연동

- 데몬이 에이전트 출력 수신 → `validateNode()` 호출
- error 시 피드백 재시도 (최대 3회)
- 3회 실패 → `status: needs-review` + `.codespoon/runs/<sha>/<node-id>.failed.md`

### 6. VCS 어댑터 (`src/adapters/vcs/`)

- `index.ts` — 인터페이스
- `git.ts` — `git diff-tree`, `git add`, `git commit` 등 wrapper

## 의존 관계

- Phase 1의 `validation.ts`, `graph.ts`, `paths.ts`, `config.ts` 사용
- `simple-git` 라이브러리 필요

## 검증 기준

1. 데몬 기동/종료/상태 확인
2. post-commit hook 설치 확인
3. 수동 commit 생성 → hook → 데몬 → validate까지의 체인 동작
4. 재귀 방지 (자동 커밋이 hook을 다시 깨우지 않음)
5. validate 실패 시 재시도 → 최종 needs-review
