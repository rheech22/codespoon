# AGENTS.md — CodeSpoon 작업 지침

이 문서는 CodeSpoon 저장소에서 코드를 작성·수정하는 에이전트(AI 또는 사람)를 위한 작업 지침이다.

## 빠른 오리엔테이션

- **무엇을 만드는가**: 코딩 에이전트 CLI를 워커로 굴려 도메인 지식 노드를 자동 유지하는 도구. 자세한 사양은 [PLAN.md](PLAN.md), 사용자 시나리오는 [EXPERIENCE.md](EXPERIENCE.md), 단계별 실행 계획은 [PLANS/](PLANS/) 참조.
- **현재 단계**: Phase 1 (노드 형식 + `validate` + `build` + `init`)
- **다음 단계**: Phase 2 (데몬 + post-commit hook + opencode 어댑터)
- **언어**: TypeScript (ESM, Node 20+)
- **테스트**: Vitest

---

## 1. PLAN.md는 사양이다

- PLAN.md의 동작과 충돌하는 변경을 만들 때는 **반드시 PLAN.md를 먼저 수정**한 뒤 코드를 바꾼다.
- "필수"라고 적힌 frontmatter 필드는 zod 스키마에서도 필수여야 한다. `optional()`로 슬쩍 완화하지 않는다.
- 스키마 / 검증 규칙 / 명령 동작이 PLAN과 다르면 그 자체가 버그다.
- PLAN을 수정한 경우 어느 절을 어떻게 바꿨는지 commit 메시지나 PR 본문에 명시한다.

---

## 2. 코어는 순수, 효과는 어댑터로

`src/core/`는 가능하면 I/O가 없어야 한다. 이 원칙은 Phase 2 데몬이 같은 코어를 **메모리 입력**에 대해 재사용하기 위함이다. 데몬은 에이전트가 stdout으로 만든 노드 문자열을 검증해야 하는데, 코어가 항상 파일 경로를 받으면 임시 파일에 써야 하는 우회가 생긴다.

**좋은 시그니처:**

```ts
validateNodeContent(raw: string, opts: { rootDir, config }): ValidationResult
generateGraphFromNodes(nodes: NodeDocument[]): Graph
```

**파일 I/O는 얇은 wrapper로:**

```ts
function validateNodeFile(filePath, rootDir, config): ValidationResult {
  return validateNodeContent(readFileSync(filePath, 'utf-8'), { rootDir, config });
}
```

---

## 3. Commands는 thin adapter

`src/commands/`의 함수는 비즈니스 로직을 직접 담지 않는다. **결과 객체를 반환**하고 CLI 진입점이 출력과 exit code를 담당한다.

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

**금지:**

- 비즈니스 로직 함수 안에서 `process.exit()` 호출 — 단위 테스트 불가
- `console.log` 직접 호출 — 출력은 cli adapter 또는 logger 통해서
- `--json` / `--quiet` / `--verbose` 같은 옵션을 비즈니스 함수가 검사

---

## 4. 검증은 면역 시스템

`validate`는 단순한 형식 점검이 아니라 자동 유지 루프에서 **에이전트 출력이 docs를 오염시키지 못하게 막는 게이트**다 (PLAN 15장).

- **검증 항목은 작은 Check 함수로 분해.** Monolithic `validateNode` 안에 새 규칙을 추가하지 않는다.

  ```ts
  type Check = (ctx: CheckContext) => ValidationMessage[];
  const checks: Check[] = [checkSchema, checkSources, checkSections, ...];
  ```

- **error는 차단, warning은 통과.** PLAN 15.1 / 15.2 분류를 그대로 따른다.
- 새 규칙을 추가하면 **반드시 negative fixture + 테스트**도 같이 추가한다. 규칙은 회귀 방지선 없이는 살아남지 못한다.

---

## 5. 외부 입력은 zod로 경계 검증

- YAML config, frontmatter, 에이전트 출력, 명령행 인자 — **모든 외부 입력은 zod 스키마를 통과**시킨다.
- `safeParse`로 받아 사용자 친화적 메시지로 변환한다. `parse`를 그대로 두면 stack trace가 사용자에게 노출된다.
- 신뢰할 수 없는 입력에 대해 `as` 캐스팅 금지.
- Schema는 가능하면 `.strict()`로 두어 의도하지 않은 필드가 통과하지 않게 한다.

---

## 6. 경로 처리

- `node:path`의 `relative()`, `resolve()`, `isAbsolute()`, `join()`를 쓴다.
- 문자열 `replace(root, '')` 같은 임시 변환 금지. symlink, Windows 경로, 동일 prefix 매칭에서 깨진다.
- glob 매칭이 필요하면 `fast-glob`의 패턴 함수 또는 `picomatch`를 쓴다. `startsWith(prefix)`로 흉내내지 않는다 — `src/api/**`는 `src/apidocs/`도 매칭해버린다.

---

## 7. ID와 시각의 비교

- SHA, UUID, opaque ID는 **사전식 비교 대상이 아니다.** `"def5678" > "abc1234"`는 우연히 맞을 뿐.
- 순서가 필요하면 timestamp 또는 외부 권위(git, 데몬 기록)에서 가져온다.
- `last_updated_at` 같은 시각 필드로 정렬할 때는 ISO 8601 문자열을 가정하고 zod regex로 형식을 강제한다.

---

## 8. 마크다운 내용 검사는 마크다운을 이해해야 한다

- 본문에서 패턴을 찾을 때 단순 `split(/\s+/)`은 마크다운 링크 `[text](/abs/path)`, 인라인 코드 `` `code` ``, 코드 펜스 같은 구조를 놓친다.
- 절대 경로, URL 등의 검사는 link target과 code block을 인식해야 한다.
- 단순 검사라도 최소한 link 구문 `]( ... )` 안쪽을 별도로 추출하거나, `remark`/`unified` 같은 파서 도입을 검토한다.

---

## 9. 멱등성

`init`, `install-hook` 같은 idempotent 명령은 **부분 상태**도 안전하게 처리해야 한다.

- "이미 존재" 체크는 추가될 모든 항목 각각에 대해 수행한다.
- 한 항목만 보고 전체를 스킵하지 않는다 (예: `.gitignore`에서 `cache/`만 검사하고 `runs/` 누락을 놓치는 패턴 금지).
- 동일 명령을 두 번 실행해도 동일한 최종 상태가 되어야 함. 테스트로 보장한다.

---

## 10. 설정 정의는 DRY

- Default 값은 한 곳에서만 정의한다. 권장: 스키마에서 derive.

  ```ts
  export const ConfigSchema = z.object({ ... }).default(...);
  export const DEFAULTS = ConfigSchema.parse({});
  ```

- 별도 `DEFAULTS` 상수가 schema와 분리돼 있으면 둘이 drift한다.
- 마찬가지로 cac `default: '.'`을 지정했으면 호출 측에서 `|| '.'` 방어 코드를 또 두지 않는다.

---

## 11. 테스트 규칙

- **Fixture 이름과 내용이 일치해야 한다.** `missing-X` fixture는 실제로 X가 없어야 하고, 그 fixture에 대한 테스트는 negative 케이스를 검증해야 한다. 이름이 거짓말하면 fixture가 회귀 방지선 역할을 못 한다.
- 각 fixture 디렉터리에 `README.md` 한 줄로 의도를 적어두면 좋다 (예: "frontmatter에 절대 경로가 있을 때 error를 발생시키는지 검증").
- **PLAN의 모든 error/warning 규칙에 대응하는 테스트가 있어야 한다.** PLAN 15장 목록을 체크리스트로 사용.
- 단위 테스트는 가능한 한 순수 코어 함수를 대상으로. command 함수가 직접 테스트하기 어려우면 그건 분리가 부족하다는 신호 (3장 참조).
- 테스트 실행 시 화면을 어지럽히는 로그는 silent 모드 또는 mock으로 막는다.

---

## 12. 스타일과 명명

- **TypeScript strict 모드 유지.** `any` / `!` non-null assertion은 정말 필요한 경우에만.
- ESM 프로젝트이므로 import는 `.js` 확장자를 붙인다 (`from './foo.js'`).
- **YAML 입력은 snake_case, JSON 출력은 camelCase.** 이 컨벤션은 PLAN 13/14장에서 의도된 것이며 일관되게 유지한다.
- 함수와 변수명은 영어, CLI 사용자 출력 메시지는 한국어 (현재 톤 유지). 변경하려면 i18n catalog로 분리한 뒤.
- 주석은 **WHY가 자명하지 않을 때만**. 변수명·함수명으로 표현되는 WHAT은 적지 않는다. 예외: 외부 라이브러리의 비명시적 동작에 대한 workaround, 사양 절 참조 (`// PLAN 15.4 피드백 프롬프트 형식`).

---

## 13. 의존성 추가

- 새 의존성을 추가하기 전에 다음 순서로 확인:
  1. 표준 라이브러리(`node:*`)로 가능한가
  2. 이미 의존성에 있는 패키지로 가능한가 (예: glob 매칭은 `fast-glob`에 이미 있음)
  3. 작고 검증된 라이브러리 우선
- 결정 사유를 commit 메시지에 한 줄 적는다.

---

## 14. 로깅과 출력

- 직접 `console.log` 대신 **logger 추상화**를 거친다. Phase 2 데몬은 stdout에 protocol 메시지를 흘리므로 사용자 출력과 섞이면 안 된다.
- 색상은 `picocolors`. 사용자 친화적 표시는 cli adapter 층에서만 입힌다.
- 데몬과 명령에서 같은 로깅 인터페이스를 공유한다 (`info`, `warn`, `error`, `debug`).

---

## 15. 변경 시 체크리스트

코드 수정을 마치기 전에 확인:

- [ ] PLAN.md와 일치하는가 (필수 필드, 명령 동작, 형식 규칙)
- [ ] 새 규칙/필드면 fixture + 테스트가 같이 들어갔는가
- [ ] `pnpm run build` 통과
- [ ] `pnpm run test` 통과
- [ ] 추가한 외부 입력이 zod로 검증되는가
- [ ] 추가한 비즈니스 로직이 `process.exit` / `console.log`에 의존하지 않는가
- [ ] PLAN.md를 수정해야 했다면 같이 커밋했는가

---

## 작업 흐름 권장

1. 변경 의도를 PLAN.md / PLANS의 어느 절에 해당하는지 확인
2. 변경이 사양과 어긋나면 PLAN.md를 먼저 수정
3. 순수 코어 함수부터 작성 (테스트 가능한 단위로)
4. command / cli 어댑터는 마지막에 얇게
5. fixture + 단위 테스트 동반 추가
6. `pnpm test`, `pnpm build` 통과 확인
7. commit 메시지에 어느 PLAN 절을 다뤘는지 명시

---

이 지침은 [PLAN.md](PLAN.md)의 13~17장(노드 형식, 그래프, 검증, 구현 구조)을 보조한다. 충돌 시 PLAN.md가 우선이다.
