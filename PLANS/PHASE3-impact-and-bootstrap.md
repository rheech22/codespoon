# Phase 3: 영향 매핑과 부트스트랩

> **소요 예상:** 2-3일
> **PLAN.md 참조:** 6.3절 (영향 매핑), 7장 (부트스트랩), 8장 (소비 인터페이스)

## 목표

여러 노드를 동시에 다루고, 첫 노드 묶음을 자동으로 만드는 능력을 갖춘다.

## 작업 목록

### 1. 영향 매핑 (`src/core/impact.ts`)

- `git diff-tree --name-only <sha>`로 변경 파일 목록 획득
- `graph.json`의 `sources`와 매칭
- 디렉터리 패턴 매칭 지원
- 결과가 비어 있으면 데몬이 아무 작업도 안 함

### 2. `codespoon spoon` (`src/commands/spoon.ts`)

- 키워드 매칭 검색 (제목 + sources 경로 + symbols)
- score 상위 3개 노드 본문 + sources 출력
- 데몬 통신 (읽기 락)

### 3. 부트스트랩 (`src/commands/bootstrap.ts`)

**1단계: 후보 추천 (휴리스틱)**
- 프레임워크 어댑터 (`src/adapters/framework/`)
- Next.js App Router: `apps/**/app/**/page.tsx` 패턴
- import 그래프 2~3 hop 탐색
- 복잡 흐름 score 산정 (서비스/스토어/WebSocket/상태저장소)
- `.codespoon/runs/bootstrap-candidates.md` 생성

**2단계: 사람 검토 → 에이전트 채움**
- `codespoon bootstrap --apply` 실행
- 선택된 후보별로 에이전트 CLI 호출 (Phase 2 어댑터 재사용)
- validate 통과 시 docs에 자동 커밋

### 4. 소비 인터페이스 (`src/templates/agents-md-injection.ts`)

- `AGENTS.md` / `CLAUDE.md` 안내 문구 템플릿
- install-hook 시 주입

### 5. 프레임워크 어댑터 (`src/adapters/framework/`)

- `index.ts` — 인터페이스
- `next-app-router.ts` — 부트스트랩 휴리스틱

## 의존 관계

- Phase 1의 `validation.ts`, `graph.ts`, `paths.ts`, `config.ts` 사용
- Phase 2의 데몬, 에이전트 어댑터, VCS 어댑터 사용
- Phase 2의 `codespoon install-hook`과 `codespoon spoon` 연결

## 검증 기준

1. fixture에서 영향 매핑이 올바른 노드를 식별하는지 테스트
2. `codespoon spoon`이 키워드에 따라 올바른 노드를 반환하는지 테스트
3. 부트스트랩 1단계가 올바른 후보를 추천하는지 테스트
4. 전체 자동 유지 루프 동작 확인
