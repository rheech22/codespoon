# Phase 1: 노드 형식과 검증

> **소요 예상:** 1-2일
> **PLAN.md 참조:** 13장 (노드 형식), 14장 (그래프 색인), 15장 (검증 규칙), 17장 (구현 구조)

## 목표

자동 유지 루프의 안전 게이트를 먼저 만든다. 에이전트 출력이 docs를 오염시키기 전에 검증하는 면역 시스템이 Phase 1의 전부다.

## 작업 목록

### 1. 프로젝트 스캐폴딩

- `package.json` — `"type": "module"`, `"bin"` 등록
- `tsconfig.json` — strict mode, ESM (`nodenext`)
- 디렉터리 구조 생성 (`src/`, `tests/fixtures/`, `src/commands/`, `src/core/` 등)
- `pnpm install`로 의존성 설치

### 2. 코어 타입 및 스키마

`src/core/` 하위 5개 파일:

| 파일 | 역할 |
|------|------|
| `types.ts` | Node, Source, Edge, Graph 타입 정의 + Zod frontmatter 스키마 |
| `config.ts` | Config 타입 + Zod 스키마 + `loadConfig()` |
| `validation.ts` | `validateNode()` — error/warning 수집, exit code 결정 |
| `graph.ts` | `generateGraph()` — nodes/ → graph.json |
| `paths.ts` | knowledgeDir, nodesDir, stateDir 등 경로 헬퍼 |

### 3. `codespoon init`

- `codespoon.config.yaml` 생성 (기본값 + 주석)
- `docs/knowledge/nodes/`, `docs/knowledge/evaluations/` 생성
- `.codespoon/runs/`, `.codespoon/cache/` 생성
- `.gitignore` 추천 출력 (`--write-gitignore`로 자동 추가)

### 4. `codespoon validate`

- 대상: `docs/knowledge/nodes/*.md` 또는 명시적 파일 경로
- 검증 항목:
  - Error: frontmatter 없음, 필수 필드 없음, 필드 값 범위 위반, 필수 섹션 없음, 절대 경로, 실제 파일 아닌 source
  - Warning: `max_node_chars` 초과, sources/symbols 빔, generated_paths 포함, Open Questions 빔
- 출력: 사람용 텍스트 + `--json` 옵션 (Phase 2 대비)
- Exit code: error=1, warning=0, `--strict`=1

### 5. `codespoon build`

- `docs/knowledge/nodes/*.md` 스캔
- 각 파일 frontmatter에서 metadata 추출
- `graph.json` 전체 재생성 (version, generatedAt, nodes, sources, edges)
- 부분 수정/병합 없음 — 항상 전체 재생성

### 6. CLI 디스패치 (`src/cli.ts`)

- `cac`으로 `init`, `validate`, `build` 등록
- `--help`, `--version` 전역 옵션
- 비명령 실행 시 도움말 출력

### 7. 테스트 fixture

| fixture 디렉터리 | 목적 |
|-----------------|------|
| `valid-node/chat-session-lifecycle.md` | 완전한 노드 — validate 통과 |
| `missing-frontmatter/no-fm.md` | frontmatter 없음 — error |
| `missing-section/no-section.md` | 필수 섹션 누락 — error |
| `absolute-path/abs-path.md` | 절대 경로 포함 — error |
| `missing-source/bad-source.md` | 존재하지 않는 파일 참조 — warning |
| `simple-graph/` | 2개 노드 + edge — build 테스트 |

### 8. 단위 테스트

- `tests/validate.test.ts` — 각 fixture에 대한 validate 결과 검증
- `tests/build.test.ts` — fixture 기반 graph.json 생성 검증
- `tests/init.test.ts` — init이 생성하는 파일 구조 검증

## 생성할 파일 목록

```
codespoon/
  package.json
  tsconfig.json
  src/
    cli.ts
    commands/
      init.ts
      validate.ts
      build.ts
    core/
      types.ts
      config.ts
      validation.ts
      graph.ts
      paths.ts
    templates/
      config.ts
      readme.ts
  tests/
    fixtures/
      valid-node/
        chat-session-lifecycle.md
        chat-service.ts
      missing-frontmatter/
        no-fm.md
      missing-section/
        no-section.md
      absolute-path/
        abs-path.md
      missing-source/
        bad-source.md
      simple-graph/
        nodes/
          node-a.md
          node-b.md
    validate.test.ts
    build.test.ts
    init.test.ts
```

## 검증 기준

1. 모든 vitest 단위 테스트 통과
2. `pnpm run build`로 TypeScript 컴파일 성공
3. `node dist/cli.js init --dir /tmp/test-cs` → 파일 구조 정상 생성
4. `node dist/cli.js validate`가 error 케이스에서 exit code 1 반환
5. `node dist/cli.js build` → `graph.json` 정상 생성
6. init → validate → build 전 과정 순환 확인

## 이후 Phase와의 연결

- Phase 1에서 정의한 `validateNode()`는 Phase 2 데몬의 에이전트 출력 검증 게이트로 사용된다.
- `graph.json`의 `sources` 색인은 Phase 3 영향 매핑의 입력이다.
- `init`이 생성한 디렉터리 구조는 이후 모든 Phase의 전제 조건이다.
