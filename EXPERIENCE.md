# CodeSpoon 사용 시나리오와 가치 전달

이 문서는 [PLAN.md](PLAN.md)에 정의된 CodeSpoon MVP가 실제로 사용자에게 어떻게 닿는지를 시간 순 시나리오로 기록한다. PLAN.md가 무엇을·왜·어떻게 만드는지를 다룬다면, 이 문서는 만든 뒤 어떤 흐름으로 동작하고 어느 지점에서 가치를 전달하는지를 다룬다.

검증용 코드베이스는 `socra-ai-web/main`을 전제로 한다. 다른 코드베이스에서도 구조는 같다.

---

## 1. 하루차: 설치와 첫 인상

월요일 아침, 사용자가 회사 프로젝트 디렉터리에서 작업하고 있다고 가정한다.

```bash
$ pnpm install -g codespoon
$ cd ~/Works/socra-ai-web/main
$ codespoon init
✓ codespoon.config.yaml 생성
✓ docs/knowledge/ 생성
✓ .codespoon/ 생성 (.gitignore 추천: .codespoon/cache, .codespoon/runs)

$ codespoon install-hook
✓ .git/hooks/post-commit 설치
✓ AGENTS.md에 spoon 안내 추가 (3줄)
✓ 데몬 자동 시작
```

여기까지 약 30초. 이 시점에는 아직 `docs/knowledge/`가 비어 있고 hook이 깔려도 영향 매핑할 노드가 없으므로 commit해도 데몬은 아무 일도 하지 않는다. 설치 단계의 부담을 가능한 한 가볍게 둔다.

---

## 2. 하루차: 부트스트랩

```bash
$ codespoon bootstrap
📊 코드베이스 스캔 중...
✓ Next.js App Router 어댑터 적용
✓ 13개 후보 흐름 추출 → .codespoon/runs/bootstrap-candidates.md
```

사용자가 `bootstrap-candidates.md`를 열면 다음 형태의 후보 목록을 본다.

```md
# Bootstrap Candidates

다음 후보 중 첫 노드로 만들 도메인을 선택하세요 (체크박스 표시).

- [ ] chat-session-lifecycle (score: 94)
  entry: apps/web/app/chat/page.tsx
  sources: chat-service.ts, chat-ws-service.ts, react-query-chat-cache.ts, ...
  signals: WebSocket, react-query, zustand

- [ ] session-share-and-access (score: 76)
  entry: apps/web/app/share/[token]/page.tsx
  sources: share-service.ts, share-rest-adapter.ts, ...
  signals: separate adapter, token auth

- [ ] onboarding-phone-verification (score: 68)
  ...

- [ ] message-feedback-collection (score: 41)
  ...
```

사용자는 상위 3개에 체크하고 다음 명령을 실행한다.

```bash
$ codespoon bootstrap --apply
🚀 3개 노드 생성 중 (opencode run)...
  [1/3] chat-session-lifecycle ............ ⏳ 4m 12s
  [2/3] session-share-and-access .......... ⏳ 2m 51s
  [3/3] onboarding-phone-verification ..... ⏳ 3m 30s
✓ validate 통과
✓ graph.json 재생성
✓ 자동 커밋: docs(codespoon): bootstrap 3 domain nodes
```

약 10분 뒤 사용자가 `docs/knowledge/nodes/chat-session-lifecycle.md`를 연다.

여기서 **첫 가치 평가 모먼트**가 발생한다.

> 이 노드가 내가 직접 썼다면 30분 걸렸을 정도로 정확한가?

정확하면 "쓸 만하다", 부정확하면 "validate가 약하다" 또는 "프롬프트를 손봐야 한다"가 된다. 이 첫 인상이 도구 전체의 신뢰를 좌우한다.

---

## 3. 1주차: 정상 작업 흐름

수요일, 사용자가 OpenCode를 띄워 작업을 시작한다.

```
$ opencode
> "채팅 세션에 일시정지 기능을 추가하고 싶어"
```

OpenCode는 시작할 때 `AGENTS.md`를 자동으로 읽는다. install-hook이 심어둔 안내가 거기 있다.

> 이 저장소는 docs/knowledge/에 자동 유지되는 도메인 지식 노드를 둔다.
> 작업을 시작하기 전에 다음 명령으로 작업과 관련된 노드를 먼저 확인하라.
>   codespoon spoon "<작업 요약 한 줄>"

OpenCode가 자연스럽게 호출한다.

```bash
$ codespoon spoon "채팅 세션 일시정지 기능 추가"
```

데몬은 query에서 "채팅", "세션"을 매칭해 `chat-session-lifecycle` 노드를 상위로 반환한다. 본문과 sources 경로가 stdout으로 흐른다.

OpenCode는 그 안의 entry points, key code paths, invariants를 보고 **바로 정확한 파일을 열고 작업을 시작한다**. "어디서부터 봐야 하지" 단계가 사라진다.

작업이 끝나고 commit한다.

```bash
$ git commit -m "feat(chat): add pause to chat session"
```

post-commit hook이 트레일러 검사를 통과한 뒤 데몬에 SHA를 전달하고 0.05초 안에 종료한다. 사용자는 commit이 평소처럼 끝난 것으로 인지한다.

백그라운드에서 데몬이 다음을 수행한다.

1. 변경 파일 목록을 받는다.
2. `graph.json`의 sources를 보고 `chat-session-lifecycle` 노드를 영향 노드로 식별한다.
3. `opencode run --dir <repo> --format json --model <provider/model> "<프롬프트>"`로 노드 갱신을 호출한다.
4. 약 3분 뒤 validate를 통과하면 명시적 경로만 staging해 자동 커밋한다.

```text
docs(codespoon): auto-update for abc1234
영향 노드: chat-session-lifecycle
원본 commit: abc1234

Codespoon-Auto: true
```

사용자가 다음에 `git log`를 보면 자기 작업과 docs 갱신이 짝지어 있다. **자기 작업과 동기화된 살아있는 문서**가 생긴다.

---

## 4. 2~4주차: 가치가 뚜렷해지는 순간

운영이 누적되면 세 종류의 모먼트가 반복된다.

### 4.1 자기 코드로 돌아오기

한 달 뒤 같은 도메인을 다시 만진다. `codespoon spoon "chat session websocket"` 한 줄로 5초 만에 mental model을 회복한다. 코드 archeology를 다시 하지 않는다. **자기 자신이 가장 먼저 수혜자가 된다.**

### 4.2 새 합류자와 페어 리뷰어

"이 흐름 어떻게 돌아가나요" 질문에 "docs/knowledge/nodes/chat-session-lifecycle.md를 보세요"로 답한다. 그 문서는 코드와 동기화되어 있으므로 wiki처럼 "이거 옛날 정보예요"라는 단서가 필요 없다.

### 4.3 AI 에이전트 작업 속도와 정확도

같은 작업을 spoon 없이/있이 시켜 비교하면 차이가 정량적으로 드러난다. spoon이 있을 때 OpenCode가 첫 파일을 정확히 찍고 시작한다. token 비용과 작업 시간 차이가 누적되어 종단 평가에서 통계적으로 보인다.

---

## 5. 가치 전달 도식

```text
사용자가 commit
    ↓
[비가시] hook → 데몬 → opencode run → validate → 자동 커밋
    ↓
docs/knowledge/가 항상 코드와 동기 상태
    ↓
다음에 사용자나 AI가 작업할 때
    ↓
codespoon spoon으로 정확한 출발점 즉시 획득
    ↓
탐색 비용·환각·반복 학습 비용 절감
```

핵심은 **사용자가 거의 의식하지 않는 자동성**이다. 도구가 사용자에게 들이대지 않는다. 단지 코드와 같이 자라는 문서가 있고, AI가 그것을 자연스럽게 활용한다.

---

## 6. 가치가 뚜렷한 곳과 약한 곳

### 6.1 가치가 뚜렷한 곳

* 새 합류자 온보딩 (기존에 가장 큰 통증)
* 한 달 이상 안 본 도메인으로 돌아옴
* AI 에이전트가 cross-layer 흐름을 작업 (정확도와 토큰 비용)
* 코드 리뷰어가 PR의 도메인 맥락을 빠르게 파악
* 여러 사람이 같은 도메인에서 병렬 작업 (서로의 mental model 동기화)

### 6.2 가치가 약한 곳

* 그린필드 코드 (변경이 너무 빨라 노드가 따라가지 못함)
* 단순 버그 수정 (이미 잘 아는 코드)
* 작은 코드베이스 (탐색 비용 자체가 낮음)
* 도메인이 명확히 나뉘지 않는 코드 (영향 매핑이 모호)

---

## 7. 만들면서 마주칠 가능성이 높은 함정

### 7.1 부트스트랩 첫 인상

첫 3개 노드의 품질이 그 후의 모든 평가를 흔든다. 부트스트랩 프롬프트와 validate 강도에 집중해야 한다.

### 7.2 자동 커밋의 리뷰 산만함

자동 커밋이 PR 히스토리에 끼면 리뷰가 산만해진다. 처음에는 거슬릴 가능성이 높다. `[skip ci]` 옵션과 PR 화면에서 자동 커밋을 접는 표시를 일찍 검토하는 게 좋다.

### 7.3 spoon 검색의 단순함

키워드 매칭만으로는 AI가 노드를 못 찾아 spoon을 안 쓰는 패턴이 나올 수 있다. 종단 평가 1주차에 "AI 활용율 5%" 같은 결과가 보이면 검색 알고리즘부터 손봐야 한다.

### 7.4 미묘한 사실 왜곡

에이전트 갱신이 함수 이름 오타로 바뀌거나 인자 순서를 뒤집어도 validate는 모를 수 있다. 매주 사람 검토는 단순한 형식 점검이 아니라 정확성 점검이 되어야 한다.

### 7.5 운영 비용

commit마다 opencode 호출이 3분, 영향 노드 수만큼 곱해진다. 하루 10 commit, 평균 1.5노드 영향이면 하루 약 45분의 데몬 시간과 그만큼의 토큰 비용이다. 비용 측정이 종단 평가의 한 축이 되어야 한다.

---

## 8. 한 줄 요약

```text
사용자가 commit하면 문서가 따라온다.
AI가 작업하면 문서를 먼저 본다.
사람은 거의 아무것도 안 한다.
```

이 그림이 진짜로 굴러가면 wiki 시대를 넘는 시도가 된다. 안 굴러가면 흥미로운 실험으로 끝난다. PLAN.md 16장의 종단 평가가 정직하게 답을 줄 것이다.
