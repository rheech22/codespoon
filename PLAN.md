# CodeSpoon MVP 계획

## 1. 목적

이 문서는 여러 코드베이스에서 사용할 수 있는 CodeSpoon의 1차 MVP 계획을 정의한다.

CodeSpoon은 코드베이스 전체를 한 번에 AI에게 먹이는 도구가 아니다. 작업에 필요한 코드 맥락을 출처와 함께 한 숟갈씩 떠주는 도구다.

```text
A spoonful of source-traced code context.
```

여기서 한 숟갈(spoonful)은 특정 작업을 이해하는 데 필요한 작은 도메인 맥락 묶음을 뜻한다. 너무 많은 파일을 그대로 넣는 대신, 중요한 흐름과 출처만 압축해서 제공한다.

CodeSpoon의 기반 개념은 코드 우선 살아있는 지식 계층(Code-first Living Knowledge Layer)이다.

여기서 코드 우선이란 코드가 기준 진실(source of truth)이라는 뜻이다. 문서는 코드를 대체하지 않는다. 문서는 사람이 코드를 더 빨리 이해하고, AI 에이전트가 올바른 파일과 개념을 더 정확히 찾도록 돕는 해석 계층이다.

이 지식 계층은 사람이 손으로 유지하지 않는다.

```text
코드가 기준 진실이다.
문서는 코드 탐색을 돕는 검증 가능한 지식 계층이다.
지식 계층은 코딩 에이전트 CLI에 의해 자동으로 갱신된다.
도구는 그 갱신의 형식, 출처, 품질을 보장한다.
```

위키와의 결정적 차이는 자동 유지다. 사람이 손으로 유지하는 문서는 시간이 지나면 반드시 코드와 어긋난다. CodeSpoon은 commit을 트리거로 코딩 에이전트 CLI를 호출해 영향받는 노드를 다시 쓰게 하고, 도구는 그 결과가 형식과 출처 규칙을 만족하는지 검증한다. 즉 살아있는 문서를 만드는 책임은 에이전트에게 있고, 살아있게 유지하는 책임은 도구의 자동 유지 루프에 있다.

이 MVP는 많은 문서를 만드는 것이 아니라, 하나의 실제 코드베이스에서 자동 유지 루프가 일정 기간 정확성과 유용성을 유지하는지 검증하는 데 집중한다.

---

## 핵심 용어

이 문서는 가능한 한 한글 용어를 사용한다. 다만 널리 쓰이는 프로그래밍과 AI 용어는 첫 등장 시 뜻을 함께 적는다.

* 기준 진실(source of truth): 여러 설명이 충돌할 때 최종적으로 믿어야 하는 원본이다. 이 문서에서는 코드가 기준 진실이다.
* 지식 계층(knowledge layer): 코드 위에 놓이는 설명, 색인, 관계 정보의 묶음이다. 코드를 대체하지 않고 탐색을 돕는다.
* 지식 노드(knowledge node): 하나의 도메인이나 기능 흐름을 설명하는 문서 단위다.
* 한 숟갈(spoonful): 특정 작업에 필요한 작은 코드 맥락 묶음이다. CodeSpoon의 제품 메타포다.
* 도메인 조각(domain slice): 하나의 기능 흐름을 이해하는 데 필요한 파일, 기호, 경로, 이벤트의 작은 묶음이다.
* 기호(symbol): 함수, 클래스, 타입, 변수처럼 코드 안에서 이름으로 참조할 수 있는 단위다.
* 출처 추적(source trace): 설명이 어떤 파일과 기호에서 나왔는지 따라갈 수 있게 만드는 것이다.
* 데몬(daemon): 사용자당 하나 떠 있는 백그라운드 프로세스다. hook, 플러그인, CLI 명령에서 들어오는 작업을 큐로 받아 처리한다.
* 자동 유지 루프(auto-maintenance loop): commit → hook → 데몬 → 에이전트 CLI → 검증 → 자동 커밋으로 이어지는 흐름이다. CodeSpoon의 본체다.
* 영향 매핑(impact mapping): 변경된 파일에서 영향받는 지식 노드를 찾는 작업이다. `sources` 색인이 근거가 된다.
* 부트스트랩(bootstrap): 지식 노드가 없는 초기 상태에서 첫 노드들을 만드는 절차다.
* 어댑터(adapter): 외부 시스템(에이전트 CLI, VCS, 프레임워크 휴리스틱)을 표준 인터페이스로 격리하는 계층이다.
* 커밋 트레일러(commit trailer): git 커밋 메시지 본문 끝의 `Key: value` 줄이다. 도구가 자동 생성한 커밋을 식별하는 데 쓴다.
* 검색 증강 생성(Retrieval-Augmented Generation, RAG): 모델이 답변하기 전에 외부 문서나 색인을 검색해 근거를 보강하는 방식이다.
* 토큰 예산(token budget): AI 모델에 한 번에 넣을 수 있는 입력 크기의 한도다.
* 포함/제외 규칙(include/exclude rule): 분석할 파일과 무시할 파일을 정하는 규칙이다.

---

## 2. 문제 정의

큰 코드베이스에서 개발자는 보통 `grep`, `ripgrep`, 파일 트리, 기존 문서를 조합해 필요한 위치를 찾는다. 이 방식은 강력하지만 다음 한계가 있다.

* 기능이 여러 계층에 흩어져 있으면 검색어만으로 흐름을 찾기 어렵다.
* 파일 이름은 알아도 그 파일이 전체 동작에서 어떤 역할을 하는지 알기 어렵다.
* 오래된 문서와 실제 코드 중 무엇을 믿어야 하는지 불명확하다.
* AI 에이전트는 관련 없는 파일을 많이 읽거나, 그럴듯하지만 틀린 경로를 추측하기 쉽다.
* 코드 리뷰나 유지보수 과정에서 같은 탐색 비용이 반복된다.

기존 문서 체계도 한계가 있다.

* 사람이 손으로 유지하면 시간이 지나며 코드와 어긋난다.
* 어긋난 문서는 없는 것보다 나쁘다. 사람과 AI를 적극적으로 잘못된 방향으로 이끈다.
* 문서를 쓰는 일과 코드를 쓰는 일이 분리되어 있어, 코드 변경의 어느 단계에서 문서를 갱신할지의 의사 결정 비용이 누적된다.

CodeSpoon은 이 문제를 두 축으로 줄인다.

* **공급 축**: 작업에 필요한 작은 도메인 맥락을 출처와 함께 떠주어, "더 많이 읽기"가 아니라 "필요한 만큼만 정확히 떠주기"로 해결한다.
* **유지 축**: 그 도메인 맥락을 사람이 아니라 자동 유지 루프가 코드 변경에 맞춰 갱신해, 문서가 코드와 어긋날 가능성을 구조적으로 줄인다.

이 두 축이 동시에 성립할 때 CodeSpoon은 위키, Repomix, graphify, grep과 다른 자리를 차지한다.

---

## 3. 설계 원칙

### 3.1 코드를 기준 진실로 둔다

문서는 코드보다 우선하지 않는다. 코드와 문서가 충돌하면 코드를 믿고 문서를 수정한다.

이 원칙은 환각(hallucination), 즉 AI가 코드에 없는 설명을 사실처럼 만들어내는 문제를 줄이기 위해 필요하다.

### 3.2 적은 수의 높은 품질 문서를 자동으로 유지한다

초기에는 많은 지식 노드를 만들지 않는다. 낮은 품질의 문서가 많아지면 검색 품질은 오히려 나빠진다.

MVP는 3~5개의 도메인 노드만 만든다. 노드 수가 적어야 자동 유지 루프의 정확성을 사람이 검증할 수 있다.

### 3.3 사람과 AI 에이전트를 모두 대상으로 한다

문서는 사람이 읽을 수 있어야 하고, 동시에 AI 에이전트가 안정적으로 검색하고 인용할 수 있어야 한다.

사람에게 필요한 성질은 다음과 같다.

* 짧고 명확한 요약
* 중요한 코드 경로 중심의 설명
* 추측과 사실의 구분

AI 에이전트에게 필요한 성질은 다음과 같다.

* 안정적인 문서 구조
* 파일과 기호 단위의 출처 추적
* 관계를 표현하는 구조화된 데이터
* 검색하기 쉬운 이름과 구역 제목
* 신뢰도 표시

### 3.4 전체 코드베이스가 아니라 도메인 조각을 다룬다

처음부터 전체 저장소를 그래프로 만들지 않는다. 전체 그래프는 매력적이지만 검증 범위를 빠르게 키운다.

대신 하나의 도메인 조각을 단위로 둔다. 도메인 조각은 하나의 기능 흐름을 이해하는 데 필요한 경로, UI 구성 요소, 서비스, 상태 저장소, API 호출, 백그라운드 이벤트 등을 포함한다.

### 3.5 문서와 기계 색인을 분리한다

사람이 읽는 Markdown 문서와 기계가 읽는 `graph.json` 같은 색인은 역할이 다르다.

Markdown은 설명과 판단을 담는다. JSON 색인은 노드, 파일, 기호, 관계, 신뢰도를 담는다. 사람이 직접 수정하는 영역(Markdown)과 도구가 생성하는 영역(JSON)을 분리하면 충돌과 손상을 줄일 수 있다.

### 3.6 자동 유지가 본체다

CodeSpoon은 작성 도구가 아니라 유지 도구다. 노드 형식, 검증 규칙, 그래프 색인은 모두 자동 유지 루프를 안전하게 굴리기 위한 도구다. 형식이 정교해도 자동으로 유지되지 않으면 위키와 같은 운명을 맞는다.

### 3.7 일반 도구로 설계하고, 어댑터로 종속을 격리한다

CodeSpoon은 특정 회사나 프로젝트에 종속되지 않는 일반 도구다. 단, 외부 시스템에 닿는 세 지점(에이전트 CLI, VCS, 프레임워크 휴리스틱)은 어댑터로 격리한다.

* 에이전트 CLI 어댑터: `claude`, `opencode`, `aider` 등을 같은 인터페이스로 호출한다.
* VCS 어댑터: git을 기본으로 두되, 인터페이스로 격리한다.
* 프레임워크 휴리스틱 어댑터: Next.js, Vite, React Native 등의 entrypoint 패턴을 어댑터로 둔다.

MVP는 각 어댑터의 첫 구현체만 만든다. 일반성은 회귀 검증용 fixture로 보호한다.

---

## 4. MVP 범위

MVP는 다음 질문에 답해야 한다.

```text
하나의 실제 코드베이스에서, 자동 유지 루프가
일정 기간 지식 노드의 정확성과 유용성을 유지하는가?
그리고 그 노드들이 사람과 AI 에이전트의 작업을 더 빠르게 만드는가?
```

### 포함하는 것

* 저장소에 독립적인 지식 계층 형식 정의
* **로컬 사용자당 1개의 데몬과 통신 인터페이스**
* **post-commit hook 설치와 재귀 방지 메커니즘**
* **변경 파일에서 영향받는 노드를 찾는 영향 매핑**
* **에이전트 CLI를 데몬이 호출하는 자동 갱신 흐름**
* **자동 커밋 정책과 트레일러 식별자**
* **부트스트랩 모드(휴리스틱 후보 추천 + 에이전트 채움)**
* **AI 에이전트가 작업 중 호출할 수 있는 소비 인터페이스(`codespoon spoon`)**
* 사람이 읽는 Markdown 문서와 기계가 읽는 최소 `graph.json`
* 검증 규칙(루프의 면역 시스템)
* 종단(longitudinal) 평가 기록

### 포함하지 않는 것

* 전체 저장소 자동 문서화
* 여러 도메인을 가로지르는 완전한 지식 그래프
* 시스템 부팅 시 데몬 자동 시작(launchd/systemd 통합)
* 모델 컨텍스트 프로토콜 서버(Model Context Protocol server, MCP server)
* 벡터 데이터베이스나 임베딩 기반 검색
* 완전한 오래됨 감지(임팩트 매핑이 닿지 않는 간접 영향까지 추적)
* 대화 기록, 이슈, PR의 대량 수집
* Claude Code 어댑터(Phase 2)
* 에이전트 CLI 내부 플러그인 통합 (CLI 호출만으로 충분)

### MVP 명령 표면

MVP CLI는 다음 명령만 제공한다. 사용 시나리오는 데몬 운영, 저장소 연결, 부트스트랩, 소비, 검증, 색인 재생성으로 나뉜다.

```bash
# 데몬 lifecycle
codespoon daemon start
codespoon daemon stop
codespoon daemon status

# 저장소 연결
codespoon init                       # config 파일과 디렉터리 생성
codespoon install-hook               # post-commit hook 설치, CLAUDE.md 안내 주입

# 부트스트랩
codespoon bootstrap                  # 후보 추천 → 사람 선택 → 에이전트로 노드 채움

# 소비
codespoon spoon <query>              # 작업 키워드로 관련 노드 조회

# 보조
codespoon process <sha>              # 특정 commit을 수동으로 재처리 (디버깅)
codespoon validate                   # 노드 형식, 출처, 길이 검사
codespoon build                      # Markdown에서 graph.json 재생성
```

`create`와 `eval`은 명시적으로 제거한다. `create`는 `bootstrap`이 흡수하고, `eval`은 18장의 종단 평가가 별도 명령을 필요로 하지 않는다.

---

## 5. 워커 아키텍처

CodeSpoon의 모든 자동 동작은 로컬 사용자당 1개의 데몬을 거친다. hook, 플러그인, CLI 명령은 데몬의 입구이고, 작업 큐 관리·에이전트 호출·상태 보존은 데몬이 단일 지점에서 담당한다.

### 5.1 구조

```text
┌─────────────────────────────────────────────────────────┐
│  codespoon-daemon (사용자당 1개)                          │
│  - 저장소별 작업 큐와 in-flight 상태                       │
│  - 에이전트 CLI subprocess 호출                            │
│  - validate → 통과 시 docs 갱신과 자동 커밋                │
│  - 실패 시 재시도, N회 초과 시 needs-review 표시            │
│  - 질의 인터페이스 (codespoon spoon)                       │
└─────────────────────────────────────────────────────────┘
       ▲                ▲                  ▲
       │                │                  │
  ┌──────────┐    ┌──────────┐      ┌──────────────┐
  │ git      │    │ codespoon│      │ codespoon    │
  │ post-    │    │ process  │      │ spoon <q>    │
  │ commit   │    │ (수동)    │      │  (질의)       │
  └──────────┘    └──────────┘      └──────────────┘
```

### 5.2 사용자당 1개 데몬

데몬은 사용자 단위로 하나만 띄운다. 저장소 단위로 두지 않는다.

이 선택의 이유는 다음과 같다.

* 한 사용자가 여러 저장소를 다룰 때 데몬 lifecycle을 단순하게 유지한다.
* 저장소를 가로지르는 작업(예: 회사 fixture와 OSS fixture를 동시에 다루기)이 자연스럽다.
* 상태(큐, 캐시, 실행 기록)가 한 곳에 모인다.
* 동시 동작은 저장소 key 기준으로 직렬화하면 충분하다.

### 5.3 통신

데몬과 클라이언트(hook, CLI, 향후 플러그인)는 Unix domain socket으로 통신한다. TCP는 사용하지 않는다.

* socket 경로 기본값: `~/.codespoon/sock`
* 메시지 형식: 한 줄 JSON
* 인증은 없음 (사용자 home 디렉터리 권한에 의존)

### 5.4 lifecycle

데몬은 lazy auto-spawn으로 뜬다.

* hook이나 CLI 명령이 socket에 접속을 시도하고 실패하면 데몬을 자식 프로세스로 띄운 뒤 재시도한다.
* PID 파일은 `~/.codespoon/daemon.pid`에 둔다.
* 사용자는 `codespoon daemon start|stop|status`로 명시적으로 제어할 수 있다.
* 시스템 부팅 시 자동 시작은 MVP 미포함. launchd/systemd 통합은 사용자 선택으로 남긴다.

### 5.5 동시성과 락

여러 코딩 에이전트가 같은 저장소에서 병렬로 일하거나, 같은 commit이 여러 노드에 영향을 주는 상황을 안전하게 처리하기 위한 규칙이다.

* **저장소 단위 직렬, 저장소 간 병렬.** 같은 저장소의 갱신 작업은 직렬 처리한다. 서로 다른 저장소(또는 같은 저장소의 다른 워크트리)는 병렬 처리한다. 데몬은 working directory 경로를 key로 worker를 둔다. 같은 git 저장소의 워크트리 둘은 서로 다른 working directory이므로 데몬이 보기에 별개 저장소다.
* **한 commit 내 노드 갱신도 직렬.** 한 commit이 여러 노드에 영향을 줘도 노드 갱신은 순차적으로 진행한다. 이유: 토큰 비용 예측 가능, 디버깅 단순, 먼저 갱신된 노드의 새 본문을 다음 노드 갱신 시 참고 가능. 종단 평가에서 너무 느리다고 판단되면 Phase 2에서 병렬 옵션을 추가한다.
* **읽기/쓰기 락 분리.** 노드 갱신은 write lock으로 직렬화하고, `codespoon spoon` 같은 읽기 요청은 read lock으로 병렬 처리한다. 갱신 중에 들어온 spoon은 갱신 직전 스냅샷으로 응답하거나 짧게 대기 후 응답한다.
* **git index.lock 충돌 처리.** 데몬이 자동 커밋을 시도할 때 사용자나 다른 도구가 동시에 commit 중이면 `.git/index.lock` 충돌이 발생할 수 있다. 데몬은 100ms 백오프로 최대 5회 재시도하고, 그래도 실패하면 작업을 큐 끝으로 되돌려 다음 사이클에 재시도한다.
* **한 commit의 모든 갱신은 한 번에 묶어 자동 커밋.** 영향 노드들을 모두 처리한 뒤 `graph.json` 재생성까지 포함해 한 번의 commit으로 만든다.

### 5.6 데몬이 보관하는 상태

데몬은 다음 상태를 메모리와 `.codespoon/runs/`에 둔다.

* 저장소별 큐와 in-flight 작업
* 마지막으로 처리한 commit SHA
* 에이전트 호출의 입출력 기록 (디버깅과 사람 검토용)
* `needs-review` 상태인 노드 목록

---

## 6. 자동 유지 루프

이 루프가 CodeSpoon의 본질이다. 노드 형식, 검증, 그래프 색인은 모두 이 루프를 안전하게 굴리기 위한 도구다.

### 6.1 정상 운영

1. 사용자(또는 코딩 에이전트)가 코드를 수정하고 commit한다.
2. post-commit hook이 호출된다. hook은 두 가지 조건 중 하나가 맞으면 즉시 종료한다.
   * 커밋 메시지에 `Codespoon-Auto: true` 트레일러가 있다.
   * 변경된 파일이 전부 `knowledge_dir` 하위다.
3. hook은 데몬 socket에 `{ "type": "process", "repo": "<path>", "sha": "<sha>" }`를 보내고 0.1초 안에 종료한다.
4. 데몬이 작업을 큐에 넣는다.
5. 데몬이 큐를 풀며 변경 파일 목록을 얻고 영향 매핑을 수행한다 (6.3).
6. 영향받는 각 노드에 대해 에이전트 CLI를 자식 프로세스로 호출한다 (6.4).
7. 출력을 validate에 통과시킨다. 통과 못 하면 오류를 피드백으로 주고 최대 N회 재시도한다.
8. 한 commit의 모든 영향 노드 처리가 끝나면 `graph.json`을 재생성한다. 데몬은 docs 변경을 한 번의 자동 커밋으로 묶되, **명시적 경로(`docs/knowledge/**` 하위 변경 파일과 `graph.json`)만 staging**해서 사용자의 다른 미커밋 변경을 침해하지 않는다. `git add <명시적 경로>` → `git commit -- <명시적 경로>` 순으로 처리한다. `git commit -a` 같은 와일드카드는 사용하지 않는다.
9. 자동 커밋 메시지는 `Codespoon-Auto: true` 트레일러를 포함한다.

### 6.2 재귀 방지

자동 커밋이 다시 post-commit hook을 깨우는 무한 루프를 막아야 한다. 두 단계로 방어한다.

**1차: 커밋 트레일러**

자동 커밋 메시지는 다음 형식이다.

```text
docs(codespoon): auto-update for <short-sha>

영향 노드: chat-session-lifecycle, session-share-and-access
원본 commit: <short-sha>

Codespoon-Auto: true
```

hook이 호출되면 `git log -1 --format=%B HEAD`를 읽어 `Codespoon-Auto: true`가 있으면 종료한다.

**2차: 변경 범위 확인**

hook이 `git diff-tree --name-only HEAD`로 변경 파일을 읽어 전부 `knowledge_dir` 하위면 종료한다. 트레일러가 누락된 비정상 경로도 막을 수 있다.

이 둘이 모두 작동하므로 자동 커밋이 데몬을 다시 깨우는 일은 없다.

### 6.3 영향 매핑

영향 매핑은 변경된 파일 목록에서 영향받는 지식 노드를 찾는 작업이다.

기본 알고리즘은 단순하다.

1. `git diff-tree --name-only <sha>`로 변경 파일 목록을 얻는다.
2. `graph.json`의 `sources`를 읽는다. `sources[i].path`가 변경 파일과 일치하면 그 노드를 영향 목록에 추가한다.
3. `sources[i].path`가 디렉터리 패턴인 경우 변경 파일이 그 디렉터리 하위인지 확인한다.

이 단순 알고리즘이 MVP의 기본이다. 한계는 다음과 같다.

* 노드의 `sources`에 명시되지 않은 간접 영향(import 그래프 상의 transitive 의존)은 잡지 못한다.
* `relations`로 연결된 다른 노드의 간접 영향도 잡지 못한다.

이 한계는 MVP에서 의도된 단순화다. 4장 "포함하지 않는 것"의 "완전한 오래됨 감지"가 이 부분이다. 종단 평가에서 이 한계가 실제 문제로 나타나면 Phase 2에서 import 그래프 기반 매핑을 추가한다.

영향 매핑의 결과가 비어 있으면 (즉 어떤 노드도 변경 파일을 sources로 두지 않으면) 데몬은 아무 작업도 하지 않고 종료한다. 사람이 손대지 않은 새 영역은 무시한다.

### 6.4 에이전트 호출 계약

데몬은 영향받는 노드별로 에이전트 CLI를 자식 프로세스로 호출한다.

기본 어댑터는 `opencode run`이다 (OpenCode의 비대화형 모드). 호출 형태는 다음과 같다.

```bash
opencode run --dir <repo-root> --format json --model <provider/model> "<prompt>"
```

* `--dir`로 작업 디렉터리를 명시한다. 데몬이 여러 저장소를 다루므로 `cd`에 의존하지 않는다.
* `--format json`으로 구조화된 stdout을 받아 데몬이 안정적으로 파싱한다.
* `--model`은 config의 `agent.model` 값을 사용한다 (예: `anthropic/claude-sonnet-4-6`).

다른 에이전트 CLI(`claude -p` 등)는 동일한 어댑터 인터페이스를 구현해 교체할 수 있다. Claude Code 어댑터는 Phase 2에서 합류한다.

어댑터 인터페이스는 다음 책임을 가진다.

* 프롬프트 템플릿을 받아 실제 CLI 인자로 변환한다.
* 자식 프로세스로 실행하고 stdout을 수집한다 (구조화된 형식 우선).
* 실행 환경(working directory, 환경 변수, 도구 권한)을 격리한다.
* 시간 초과와 종료 코드를 표준화한다.

호출 시 프롬프트는 노드의 현재 본문, 변경된 파일 diff 요약, 노드 형식 규칙, validate 오류(재시도 시)를 포함한다. 프롬프트 템플릿은 도구에 내장하되 config로 교체할 수 있다.

### 6.5 실패와 사람 검토

에이전트 출력이 validate를 통과하지 못하면 오류를 피드백으로 주고 재시도한다. 기본 재시도 횟수는 3회.

3회 모두 실패하면 다음과 같이 처리한다.

* 노드의 frontmatter `status`를 `needs-review`로 변경한다.
* 마지막 시도의 에이전트 출력과 validate 오류를 `.codespoon/runs/<sha>/<node-id>.failed.md`에 남긴다.
* 자동 커밋은 그대로 진행한다(다른 노드는 성공했을 수 있다).
* `codespoon daemon status`에서 `needs-review` 노드 수를 보여준다.

사람이 직접 노드를 수정하고 commit하면 hook이 다시 돌면서 영향 매핑에 따라 재시도된다.

---

## 7. 부트스트랩

자동 유지 루프는 노드가 있는 상태를 전제로 한다. 노드가 없는 초기 상태에서 첫 노드 묶음을 만드는 절차가 필요하다. `codespoon bootstrap`이 이를 담당한다.

### 7.1 두 단계 구조

**1단계: 후보 추천 (휴리스틱)**

휴리스틱은 프레임워크 어댑터에 위임한다. 기본 휴리스틱은 다음과 같다.

* route entrypoint를 추출한다. Next.js App Router라면 `apps/**/app/**/page.tsx` 패턴, Vite + React Router라면 `src/routes/**` 패턴 등.
* 각 entrypoint에서 import 그래프를 2~3 hop 따라가 도달하는 파일 집합을 만든다.
* 그 집합이 다음을 포함하면 "복잡 흐름" 후보로 score를 부여한다.
  * 서비스/스토어 레이어 파일 (이름 기반 휴리스틱)
  * WebSocket 또는 외부 API 호출 (import 이름 기반)
  * 상태 저장소(Zustand, Redux 등)의 사용
* score 상위 후보를 `.codespoon/runs/bootstrap-candidates.md`에 적는다.

후보 파일에는 추정 이름, 추정 entrypoint, 추정 sources 경로 목록이 들어간다.

**2단계: 사람 검토 → 에이전트 채움**

사람이 `bootstrap-candidates.md`를 열어 3~5개를 선택한다. 선택은 후보 옆 체크박스로 표시한다.

`codespoon bootstrap --apply`를 실행하면 데몬이 선택된 후보별로 에이전트 CLI를 호출해 노드를 채운다. 이 호출은 정상 운영의 에이전트 호출 계약(6.4)과 같은 메커니즘을 쓴다. validate 통과 시 docs에 자동 커밋한다.

### 7.2 새 코드 경로를 최소화한다

부트스트랩은 정상 운영과 같은 데몬, 같은 어댑터, 같은 validate, 같은 자동 커밋을 사용한다. 부트스트랩 전용 흐름은 1단계 휴리스틱과 후보 파일 형식뿐이다.

이렇게 하면 다음 이점이 있다.

* 정상 운영에서 작동하지 않는 경로가 부트스트랩에서만 작동하는 일이 없다.
* 부트스트랩의 정확성이 곧 정상 운영의 정확성을 보여준다.
* 코드 분량과 테스트 범위가 작다.

---

## 8. 소비 인터페이스

CodeSpoon이 만든 노드는 사람과 AI 에이전트가 모두 읽는다. MVP는 두 가지 소비 경로를 제공한다.

### 8.1 사람이 직접 읽기

`docs/knowledge/nodes/<id>.md`를 그대로 읽는다. 별도 UI는 없다.

### 8.2 AI 에이전트가 작업 중 읽기

MVP는 MCP server를 만들지 않는다. 대신 두 가지 경량 경로를 제공한다.

**(a) 진입 컨텍스트 주입**

`codespoon install-hook`은 동시에 저장소 루트의 `AGENTS.md`에 다음 안내를 한 번 추가한다. `AGENTS.md`가 없으면 새로 만든다. `CLAUDE.md`가 함께 존재하면 그쪽에도 같은 안내를 추가한다 (Claude Code 사용자 대비).

```text
이 저장소는 docs/knowledge/에 자동 유지되는 도메인 지식 노드를 둔다.
작업을 시작하기 전에 다음 명령으로 작업과 관련된 노드를 먼저 확인하라.

  codespoon spoon "<작업 요약 한 줄>"

명령은 관련 노드의 본문과 sources 경로를 출력한다. 노드는 코드와 동기화되어 있다고 가정해도 좋다.
```

이미 같은 안내가 있으면 추가하지 않는다. 사람이 지운 경우에도 다시 추가하지 않는다.

**(b) `codespoon spoon <query>` CLI**

사용자 또는 에이전트가 작업 키워드를 주면 데몬이 후보 노드를 찾아 본문과 sources를 표준 출력으로 반환한다.

MVP의 검색은 단순한 키워드 매칭이다.

* `query`의 단어를 노드 제목, sources 경로, sources symbols와 매칭한다.
* 매칭 score 상위 3개 노드를 반환한다.
* 임베딩이나 벡터 검색은 사용하지 않는다.

이 단순함이 부족하면 종단 평가에서 드러난다. Phase 2에서 더 나은 검색을 검토한다.

### 8.3 왜 MCP server는 아직 아닌가

MCP server는 더 좋은 소비 경험을 제공하지만 다음 이유로 MVP에서 제외한다.

* server lifecycle, 발견(discovery), 권한이 새로운 복잡도를 더한다.
* CLAUDE.md 안내 + CLI 명령만으로도 에이전트는 도구를 사용할 수 있다.
* MVP의 검증 대상은 자동 유지 루프이지, 소비 경험의 매끄러움이 아니다.

종단 평가에서 소비 경험이 병목으로 드러나면 Phase 2에서 추가한다.

---

## 9. 검증용 코드베이스

이 도구는 특정 프로젝트에 종속되지 않는다. 다만 MVP 검증에는 실제 코드베이스가 필요하다.

### 9.1 첫 검증 대상

첫 검증 대상은 회사의 실제 프로덕션 프론트엔드 모노레포다. Next.js 16 App Router + React 19 + TanStack Query + Zustand + WebSocket 조합이며, 도메인 흐름이 route → component → service → REST + WS → cache → store → UI를 가로지른다.

이 코드베이스는 다음 조건을 모두 만족한다.

* 여러 계층이 있는 실제 애플리케이션이다.
* 하나의 기능 흐름이 여러 디렉터리에 흩어져 있다.
* 실제 수정 과제가 일상적으로 들어온다.
* 테스트와 리뷰로 결과를 판단할 수 있다.
* 기존 문서만으로는 전체 흐름을 알기 어렵다.

문서에는 절대 경로를 남기지 않고 저장소 기준 상대 경로만 사용한다.

### 9.2 일반성 회귀 검증

회사 프로젝트에 종속되지 않음을 보장하기 위해, CI에서 작은 fixture 프로젝트 1~2개를 함께 돌린다.

* fixture 1: 최소 Next.js 프로젝트 (App Router)
* fixture 2: 최소 Vite + React 프로젝트 (참고: 어댑터 추가 시점에 합류)

fixture는 진짜 도메인을 가지지 않아도 된다. 어댑터, 영향 매핑, 자동 커밋, validate가 다른 프레임워크에서도 동작하는지 확인하는 목적이다.

---

## 10. 구현 기준

CodeSpoon MVP는 TypeScript 기반 CLI와 데몬으로 구현한다.

* 언어: TypeScript
* 실행 환경: Node.js 20 이상
* 패키지 관리자: pnpm
* CLI 이름: `codespoon`
* 데몬 통신: Unix domain socket
* 테스트: Vitest
* CLI 라이브러리: `cac` 또는 `commander`
* 설정 파일 형식: YAML
* 공유 설정 파일: `codespoon.config.yaml`
* 로컬 상태 디렉터리: `.codespoon/`
* 사용자 상태 디렉터리: `~/.codespoon/` (데몬 socket, PID, 사용자 단위 캐시)

TypeScript를 선택하는 이유는 다음과 같다.

* npm 기반 CLI 배포가 자연스럽다.
* 프론트엔드와 모노레포 실험 환경에 적용하기 쉽다.
* Markdown, YAML, glob, JSON 처리 생태계가 충분하다.
* 이후 VS Code 확장, GitHub Action, MCP server로 확장하기 쉽다.

MVP의 CLI는 AI API를 직접 호출하지 않는다. 데몬이 코딩 에이전트 CLI(기본 OpenCode `opencode run`)를 자식 프로세스로 호출한다.

이 결정의 이유는 다음과 같다.

* API key, provider, 비용, 개인 정보 처리 문제를 MVP에서 제외할 수 있다.
* 사용자는 이미 쓰는 코딩 에이전트의 권한 모델과 설정을 그대로 활용할 수 있다.
* 에이전트 CLI는 이미 코드 탐색, 파일 읽기, 출처 추적의 도구를 가지고 있어 노드 채움에 적합하다.

---

## 11. 첫 도메인 선정

첫 검증용 코드베이스에서 다음 3개 도메인을 첫 노드로 선택한다.

| 도메인 ID | 설명 | 선택 이유 |
|------------|------|-----------|
| `chat-session-lifecycle` | 채팅 세션 생성, REST 메시지 전송, WebSocket 스트리밍, React Query 캐시, Zustand 스토어 갱신을 가로지르는 흐름 | 가장 복잡하고 자주 수정됨. 자동 유지 루프가 빛나야 할 대표 흐름 |
| `session-share-and-access` | 세션 공유 링크 생성, 토큰 기반 접근, 별도 adapter 레이어를 통한 읽기 전용 렌더링 | chat과 형제 관계라 `related` edge가 자연 발생. 두 흐름의 대비 학습이 가능 |
| `onboarding-phone-verification` | 전화 인증, 쿨다운 타이머, 가입 여부에 따른 조건부 라우팅 | state machine + 비동기 API 흐름. 형식 다른 도메인으로 다양성 확보 |

다음 도메인은 의도적으로 제외한다.

* `message-feedback-collection`: 너무 작아 노드의 차이가 변별력 있게 드러나지 않을 위험.
* `app-tour-and-tutorial-progression`: 다른 도메인과의 관계가 약해 graph edge 검증에 기여가 적음.

### 11.1 일반 선정 기준

다른 코드베이스에 적용할 때 기준은 다음과 같다.

* 여러 파일과 계층에 걸쳐 있다.
* grep만으로 전체 흐름을 찾기 어렵다.
* 개발자가 자주 수정하거나 AI 에이전트가 자주 헤맬 가능성이 있다.
* 관련된 실제 작업 질문을 만들 수 있다.
* 출처를 파일과 기호 단위로 추적할 수 있다.
* 너무 넓지 않아 한 문서 안에서 설명할 수 있다.

`codespoon bootstrap`의 1단계 휴리스틱이 이 기준을 자동화한다.

---

## 12. 문서 위치 전략

지식 계층은 저장소 구조에 따라 위치를 조정할 수 있어야 한다. 그러나 기본값은 단순해야 한다.

### 12.1 권장 기본 위치

```text
<repo-root>/docs/knowledge/
```

이 위치를 기본값으로 두는 이유는 다음과 같다.

* 팀원이 쉽게 찾고 리뷰할 수 있다.
* 단일 애플리케이션 저장소와 모노레포 모두에서 자연스럽다.
* 여러 app을 가로지르는 흐름을 설명하기 좋다.
* 기존 문서 체계와 연결하기 쉽다.

### 12.2 도구 내부 상태 위치

```text
<repo-root>/.codespoon/      # 저장소 단위 상태 (커밋하지 않음)
~/.codespoon/                # 사용자 단위 상태 (데몬 socket, PID)
```

`<repo-root>/.codespoon/`에는 다음을 둔다.

* 캐시
* 실행 기록 (`.codespoon/runs/<sha>/`)
* 부트스트랩 후보 파일

`~/.codespoon/`에는 다음을 둔다.

* 데몬 socket (`sock`)
* 데몬 PID (`daemon.pid`)
* 사용자 단위 캐시(여러 저장소가 공유)

### 12.3 권장 구조

```text
<repo-root>/
  codespoon.config.yaml
  .codespoon/
    cache/
    runs/
  docs/
    knowledge/
      README.md
      graph.json
      nodes/
        <domain-id>.md
      evaluations/
        <domain-id>-longitudinal.md
```

### 12.4 설정 예시

```yaml
knowledge_dir: docs/knowledge
state_dir: .codespoon

max_node_chars: 12000
retry_count: 3

ignore:
  - node_modules/**
  - .git/**
  - dist/**
  - build/**
  - coverage/**

generated_paths:
  - src/api/**

agent:
  cli: opencode
  model: anthropic/claude-sonnet-4-6
  invoke_timeout_seconds: 300

vcs:
  driver: git

framework_adapters:
  - next-app-router
```

설정은 YAML을 기본으로 한다. `codespoon.config.yml`도 읽지만, 새로 생성하는 파일은 `codespoon.config.yaml` 하나로 고정한다.

### 12.5 커밋 정책

* `codespoon.config.yaml`은 팀 공유 설정이므로 커밋한다.
* `docs/knowledge/**`는 자동 유지되는 산출물이지만 사람이 읽는 문서이므로 커밋한다.
* `.codespoon/cache/**`와 `.codespoon/runs/**`는 로컬 상태이므로 커밋하지 않는다.

`codespoon init`은 기본적으로 `.gitignore`를 수정하지 않는다. 대신 다음 추천 항목을 출력한다.

```text
.codespoon/cache/
.codespoon/runs/
```

`--write-gitignore` 옵션으로 자동 추가할 수 있다.

---

## 13. 지식 노드 형식

지식 노드는 하나의 도메인 흐름을 설명하는 문서다. 형식은 YAML frontmatter가 있는 Markdown이다.

frontmatter 필드는 YAML 관습에 맞춰 snake_case를 사용한다. `graph.json`은 TypeScript와 JSON 생태계에 맞춰 camelCase를 사용한다.

### 13.1 예시

```md
---
id: chat-session-lifecycle
kind: domain
status: auto-updated
confidence: medium
scope:
  include:
    - apps/web/app/chat
    - apps/web/app/session
    - apps/web/src/services/chat
    - apps/web/src/ws
  exclude:
    - apps/web/src/api
sources:
  - path: apps/web/app/chat/page.tsx
    symbols:
      - ChatPage
  - path: apps/web/src/services/chat/core/chat-service.ts
    symbols:
      - ChatService
      - createSession
  - path: apps/web/src/services/chat/transport/chat-ws-service.ts
    symbols:
      - handleStreamingMessage
  - path: apps/web/src/services/chat/state/react-query-chat-cache.ts
    symbols:
      - invalidateSession
relations:
  - target: session-share-and-access
    kind: related
    confidence: extracted
last_updated_commit: <short-sha>
last_updated_at: 2026-05-25
---

# Chat Session Lifecycle

## Summary

## When To Use This Node

## Entry Points

## Key Code Paths

## Data And Event Flow

## Invariants

## Source Trace

## Open Questions
```

### 13.2 필수 frontmatter

* `id`: 저장소 안에서 안정적으로 유지되는 식별자
* `kind`: 노드 종류. MVP에서는 `domain`만 사용한다.
* `status`: `auto-updated`, `needs-review`, `stale` 중 하나
  * `auto-updated`: 가장 최근 commit까지 데몬이 갱신했고 validate를 통과한 상태
  * `needs-review`: 갱신 재시도가 N회 실패해 사람 검토가 필요한 상태
  * `stale`: 의도적으로 갱신을 멈춘 상태 (사람이 표시)
* `confidence`: `high`, `medium`, `low` 중 하나
* `scope.include`: 이 노드가 다루는 주요 경로
* `sources`: 설명의 근거가 되는 파일과 기호
* `last_updated_commit`: 데몬이 마지막으로 갱신한 commit의 짧은 SHA
* `last_updated_at`: 마지막 갱신 시각

`sources[].symbols`와 `relations`는 비어 있을 수 있다. MVP에서는 완전한 symbol 추출보다 출처 경로가 안정적으로 남는 것이 더 중요하다.

### 13.3 본문 구조

본문은 사람이 직접 작성하지 않고 에이전트가 채운다. 다만 형식 규칙은 도구가 검증한다.

H2 제목은 영어로 고정한다. AI 에이전트가 안정적으로 검색하고 인용하기 위해서다. 본문 한국어와 H2 영어가 섞이는 게 어색해 보일 수 있지만, 검색 안정성을 우선한다.

* `Summary`: 도메인이 무엇을 다루는지 짧게
* `When To Use This Node`: 이 노드를 먼저 읽어야 하는 상황
* `Entry Points`: 사용자 또는 시스템이 이 흐름에 진입하는 지점
* `Key Code Paths`: 핵심 파일과 기호가 어떤 역할을 하는지
* `Data And Event Flow`: 데이터와 이벤트의 이동 순서
* `Invariants`: 코드를 수정할 때 유지해야 하는 규칙
* `Source Trace`: 중요 설명과 코드의 연결
* `Open Questions`: 코드만으로 확정할 수 없는 내용

### 13.4 출처 추적 규칙

출처는 저장소 기준 상대 경로만 사용한다.

```text
좋은 예: apps/web/src/services/chat/core/chat-service.ts
나쁜 예: /Users/.../apps/web/src/services/chat/core/chat-service.ts
```

가능하면 디렉터리보다 파일을 사용한다. 중요한 설명은 파일뿐 아니라 함수, 클래스, 타입 같은 기호까지 연결한다.

---

## 14. 그래프 색인

Markdown 문서는 사람이 읽는 설명이다. 데몬과 AI 에이전트가 빠르게 처리하려면 더 작은 구조화 데이터가 필요하다.

MVP에서는 `graph.json`을 최소 형식으로 둔다. 이 색인의 가장 중요한 역할은 영향 매핑의 입력이다.

```json
{
  "version": 1,
  "generatedAt": "2026-05-25",
  "lastProcessedCommit": "abc1234",
  "nodes": [
    {
      "id": "chat-session-lifecycle",
      "kind": "domain",
      "title": "Chat Session Lifecycle",
      "path": "docs/knowledge/nodes/chat-session-lifecycle.md",
      "status": "auto-updated",
      "confidence": "medium",
      "lastUpdatedCommit": "abc1234"
    }
  ],
  "sources": [
    {
      "nodeId": "chat-session-lifecycle",
      "path": "apps/web/src/services/chat/core/chat-service.ts",
      "symbols": ["ChatService", "createSession"]
    }
  ],
  "edges": [
    {
      "from": "chat-session-lifecycle",
      "to": "session-share-and-access",
      "kind": "related",
      "confidence": "extracted"
    }
  ]
}
```

`codespoon build`는 `docs/knowledge/nodes/*.md`를 다시 읽어 `graph.json` 전체를 재생성한다. 부분 수정이나 병합은 하지 않는다.

이 정책의 이유는 다음과 같다.

* 오래된 edge나 source가 남을 가능성을 줄인다.
* 사람이 고치는 파일(Markdown)과 도구가 생성하는 파일(JSON)의 경계를 분명히 한다.
* 데몬의 자동 갱신 흐름에서도 마지막 단계로 build를 부르면 일관성이 보장된다.

관계의 신뢰도는 다음 세 가지로 구분한다.

* `extracted`: 코드나 문서에서 직접 확인한 관계
* `inferred`: 여러 근거를 바탕으로 추론한 관계
* `ambiguous`: 가능성은 있지만 확정하기 어려운 관계

이 구분은 AI 에이전트가 추론을 사실처럼 다루지 않도록 하기 위해 필요하다.

`sources` 색인이 영향 매핑(6.3)의 입력이다. 단일 노드 MVP에서는 edge가 의미가 적지만, 3~5개 노드를 자동 유지하는 MVP에서는 sources 색인이 매 commit마다 사용된다.

---

## 15. 검증 규칙

검증은 사람이 만든 문서를 점검하는 도구가 아니라, **루프의 면역 시스템**이다. 데몬이 에이전트의 출력을 받아 docs에 반영하기 전 마지막 게이트다.

`codespoon validate`는 error와 warning을 구분한다.

### 15.1 error

다음은 문서를 신뢰할 수 없게 만드는 위반이다.

* frontmatter가 없다.
* 필수 frontmatter field가 없다.
* `kind`, `status`, `confidence`가 허용된 값이 아니다.
* 필수 section이 없다.
* `sources[].path`가 절대 경로다.
* `sources[].path`가 실제 파일이 아니다.
* 본문에 절대 경로가 포함되어 있다 (단 코드 펜스 안은 제외).

### 15.2 warning

다음은 문서를 사용할 수는 있지만 품질 개선이 필요한 상태다.

* 문서 길이가 `max_node_chars`를 넘는다.
* `sources`가 비어 있다.
* `sources[].symbols`가 비어 있다.
* `generated_paths`에 해당하는 파일이 주요 source로 들어 있다 (예: 자동 생성된 API 클라이언트).
* `Open Questions`가 비어 있다.

### 15.3 exit code

* error가 있으면 exit code `1`
* warning만 있으면 exit code `0`
* `--strict` 옵션을 사용하면 warning도 exit code `1`

### 15.4 루프 안에서의 사용

데몬이 에이전트 출력을 받으면 다음 순서로 처리한다.

1. 출력을 임시 파일에 쓰고 validate를 호출한다.
2. error가 있으면 오류 메시지를 에이전트에게 피드백으로 주고 재시도한다.
3. error가 없으면 (warning이 있어도) docs에 반영한다.
4. warning은 로그에 남기지만 자동 커밋을 막지 않는다. 누적된 warning은 `codespoon daemon status`에서 보인다.

피드백 프롬프트는 다음과 같은 형태다.

```text
The node was rejected by validation with the following errors:

- Missing required section: "Source Trace"
- Absolute path found at line 42: "/Users/..."

Please regenerate the node fixing these issues. The node content should be:
<previous output>
```

---

## 16. 평가 전략

MVP의 가치는 자동 유지 루프가 일정 기간 정확성과 유용성을 유지하는지로 판단한다. 종단 평가를 사용한다.

### 16.1 A/B가 아니라 종단

기존 계획의 A/B 평가는 같은 사람이 두 조건을 순차로 수행하면 학습 효과로 후행 조건이 유리해진다. 또 n=3 작업으로는 노이즈를 이기지 못한다.

대신 종단 평가를 사용한다. 회사 코드베이스에서 3주간 정상 작업을 진행하면서 다음을 측정한다.

### 16.2 측정 항목

* **정확성**: 매주 1회, 사람이 노드 본문을 코드와 대조한다. 틀린 설명 개수와 누락된 변경 개수를 센다.
* **노화**: `needs-review` 노드 수, `last_updated_commit`이 최신에서 얼마나 떨어져 있는지.
* **자동 유지 비용**: 데몬의 에이전트 호출 횟수, 평균 호출 시간, 재시도율, 실패율.
* **AI 활용**: AI 에이전트가 작업을 시작할 때 `codespoon spoon`을 호출한 비율과, 그 결과를 인용하거나 활용한 비율.
* **사람 시간**: 새 합류자(또는 그 역할을 맡은 사람)가 같은 작업을 노드 있음/없음 조건에서 수행한 시간 비교. 노드 없는 조건은 노드를 임시로 숨기고 수행.

### 16.3 통과 기준 예시

3주 후 다음 중 다수를 만족해야 한다.

* 정확성이 일정 수준 이상 유지된다 (예: 노드당 틀린 설명 평균 1개 이하).
* `needs-review` 노드 비율이 일정 수준 이하 (예: 20% 이하).
* AI 에이전트가 작업 시작 시 spoon 호출 비율이 일정 수준 이상 (예: 30% 이상).
* 사람 시간 비교에서 노드 있는 조건이 같거나 짧다.
* 사람이 읽었을 때 노드가 방해가 아니라 도움이 된다 (정성 평가).

정량 기준은 코드베이스마다 다르다. 평가 전에 기준을 먼저 정해야 한다. 결과를 본 뒤 기준을 바꾸면 평가가 설득력을 잃는다.

### 16.4 평가 기록 형식

평가 기록은 `docs/knowledge/evaluations/<domain-id>-longitudinal.md`에 사람이 직접 적는다. 별도 JSON metrics 파일은 만들지 않는다.

```md
# chat-session-lifecycle Longitudinal Evaluation

## Conditions

기간:
모델:
에이전트 CLI:

## Week 1

정확성:
노화:
자동 유지 비용:
AI 활용:
관찰:

## Week 2

## Week 3

## Pass/Fail

기준:
결과:

## Lessons
```

---

## 17. 구현 구조

MVP 저장소는 TypeScript CLI + 데몬으로 시작한다.

```text
codespoon/
  package.json
  tsconfig.json
  src/
    cli.ts                       # 명령 디스패치
    commands/
      init.ts
      install-hook.ts
      bootstrap.ts
      spoon.ts
      process.ts
      validate.ts
      build.ts
      daemon.ts
    daemon/
      server.ts                  # Unix socket 서버
      queue.ts                   # 저장소별 큐
      lifecycle.ts               # PID, lazy spawn
    core/
      config.ts
      node.ts
      graph.ts
      validation.ts
      paths.ts
      impact.ts                  # 영향 매핑
      hook.ts                    # post-commit hook 본체
      commit.ts                  # 자동 커밋, trailer 처리
    adapters/
      agent/
        index.ts                 # 어댑터 인터페이스
        opencode.ts              # opencode run 어댑터 (1차)
        claude.ts                # claude -p 어댑터 (Phase 2)
      vcs/
        index.ts
        git.ts
      framework/
        index.ts
        next-app-router.ts       # 부트스트랩 휴리스틱
    templates/
      node.ts
      readme.ts
      evaluation.ts
      hook.ts                    # post-commit 스크립트 템플릿
      agents-md-injection.ts     # AGENTS.md / CLAUDE.md 안내 문구
  tests/
    fixtures/
      next-app-router-minimal/
      vite-react-minimal/
      valid-node/
      missing-frontmatter/
      missing-source/
      absolute-path/
      missing-section/
```

권장 라이브러리는 다음과 같다.

* CLI: `cac` 또는 `commander`
* YAML 처리: `yaml`
* frontmatter 처리: `gray-matter`
* schema 검증: `zod`
* 파일 탐색: `fast-glob`
* git 호출: 자체 wrapper (subprocess) 또는 `simple-git`
* 터미널 출력 색상: `picocolors`
* 테스트: `vitest`

테스트 fixture를 먼저 두는 이유는 검증 도구와 영향 매핑의 품질이 자동 유지 루프의 안전성을 결정하기 때문이다. validate가 신뢰할 수 없으면 에이전트 출력이 docs를 오염시킨다.

---

## 18. 단계별 실행 계획

### Phase 1: 노드 형식과 검증

목표는 자동 유지 루프의 안전 게이트를 먼저 만드는 것이다.

작업:

* 노드 형식 정의(13장)
* `codespoon init`, `codespoon validate`, `codespoon build` 구현
* fixture 기반 validate 단위 테스트
* 손으로 한 개 도메인 노드(`chat-session-lifecycle`)를 작성하고 validate 통과시키기

이 단계까지의 산출물만으로도 사람이 작성한 노드를 검증할 수 있다.

### Phase 2: 데몬과 hook

목표는 commit → hook → 데몬 → 에이전트 호출 → validate → 자동 커밋의 한 사이클을 실제로 굴리는 것이다.

작업:

* 데몬 서버와 Unix socket 통신
* `codespoon daemon start|stop|status`
* `codespoon install-hook` (post-commit 스크립트 + CLAUDE.md 안내 주입)
* 자동 커밋과 트레일러 처리, 재귀 방지
* OpenCode 어댑터(`opencode run`) 구현
* validate 실패 시 피드백 재시도

수동으로 commit을 만들어 hook이 데몬을 깨우고 에이전트가 한 노드를 갱신하는 것까지 확인한다.

### Phase 3: 영향 매핑과 부트스트랩

목표는 여러 노드를 동시에 다루고, 첫 노드 묶음을 자동으로 만드는 능력을 갖추는 것이다.

작업:

* `sources` 기반 영향 매핑(`core/impact.ts`)
* `codespoon spoon` 키워드 검색
* `codespoon bootstrap` 1단계 (Next.js 어댑터 휴리스틱) + 2단계 (에이전트 채움)
* 회사 코드베이스에서 3개 도메인 노드를 부트스트랩으로 생성

이 시점에 자동 유지 루프가 회사 코드베이스에서 전체 동작한다.

### Phase 4: 종단 평가

목표는 3주간 정상 작업을 진행하면서 자동 유지 루프의 정확성, 노화, AI 활용도를 측정하는 것이다.

작업:

* 평가 기록 template 작성(16.4)
* 매주 사람 검토 1회
* 데몬이 남기는 호출 기록(`.codespoon/runs/`) 정리
* 통과 기준에 따른 판단

### Phase 5: 형식과 어댑터 조정

목표는 평가 결과에 따른 조정과 다음 어댑터 합류다.

작업:

* 형식 단순화 또는 보강
* Vite + React Router 어댑터 합류 (fixture로 회귀 확인)
* Claude Code 어댑터 합류 (`claude -p`) — 에이전트 다양성 확보

---

## 19. MVP 이후 확장 방향

MVP가 성공하면 다음 방향으로 확장한다.

* 다중 에이전트 어댑터 합류 (Claude Code, aider 등)
* import 그래프 기반 영향 매핑 (간접 의존까지)
* MCP server로 AI 도구에 graph query와 spoon 제공
* 검색 증강 생성(RAG)과 임베딩 기반 spoon 검색
* 도메인 간 관계 그래프 시각화
* community detection 기반 상위 요약 생성
* 시스템 부팅 시 데몬 자동 시작(launchd/systemd)
* 자동 커밋 대신 PR 제안 모드 (팀 정책에 따라 선택)

이 확장은 MVP가 종단 평가를 통과한 뒤에만 진행한다.

---

## 20. 제품 포지셔닝

CodeSpoon은 기존 도구를 대체하기보다, 코드 탐색과 문서 유지 사이의 비어 있는 자리를 채운다.

* `grep`과 `ripgrep`은 정확한 문자열이나 패턴을 찾는 데 강하다.
* `Repomix`는 저장소 전체를 AI가 읽기 좋은 큰 입력으로 포장하는 데 강하다.
* `graphify`는 폴더 전체를 지식 그래프로 변환하고 질의하는 데 강하다.
* **위키**는 사람이 손으로 유지하는 자유로운 문서다. 자동 유지되지 않으므로 시간이 지나면 어긋난다.
* **CodeSpoon**은 특정 작업에 필요한 작은 도메인 맥락을 출처와 함께 제공하고, 그 맥락을 자동 유지 루프로 살려둔다.

따라서 CodeSpoon의 첫 목표는 거대한 지식 플랫폼이 아니다.

```text
전체 저장소를 먹이지 말고,
작업에 필요한 검증된 코드 맥락 한 숟갈을 제공한다.
그리고 그 한 숟갈을 사람 없이 살려둔다.
```

이 포지셔닝 때문에 MVP는 3~5개 도메인 노드, 자동 유지 루프, 검증, 종단 평가에 집중한다.

---

## 21. 주요 위험과 대응

### 21.1 문서가 코드와 어긋나는 위험

자동 유지 루프가 있어도 영향 매핑이 닿지 않는 간접 의존은 잡지 못한다.

대응:

* 매 commit마다 sources에 포함된 파일만 갱신 대상으로 두고, 그 한계를 13장과 14장에 명시한다.
* 종단 평가에서 노화 지표를 측정해 한계가 실제로 문제가 되는지 추적한다.
* Phase 2에서 import 그래프 기반 매핑 추가를 검토한다.

### 21.2 에이전트 출력의 환각과 품질 편차

에이전트가 코드에 없는 설명을 만들거나, 형식을 지키지 않을 수 있다.

대응:

* validate가 루프의 면역 시스템 역할을 한다(15장).
* 재시도 피드백 프롬프트로 자체 수정 기회를 준다.
* N회 실패는 `needs-review`로 격리해 사람에게 넘긴다.
* 출처 없는 설명을 금지한다.

### 21.3 자동 커밋의 부수효과

자동 커밋이 commit 히스토리를 오염시키거나 CI를 폭주시킬 수 있다.

대응:

* 재귀 방지(6.2)로 무한 루프를 막는다.
* 자동 커밋 메시지에 `[skip ci]`를 옵션으로 포함할 수 있게 한다.
* config로 자동 커밋 대신 working tree 갱신 모드를 선택할 수 있게 한다 (단 권장은 자동 커밋).

### 21.4 데몬 lifecycle 사고

데몬이 죽었는데 hook은 계속 호출되거나, 데몬이 중복 실행될 수 있다.

대응:

* PID 파일 + socket 접속 확인으로 중복 실행을 막는다.
* hook은 socket 접속 실패 시 lazy auto-spawn을 시도한다.
* `codespoon daemon status`로 사용자가 상태를 확인할 수 있게 한다.

### 21.5 회사 종속의 위험

회사 코드베이스에서만 동작하는 가정을 도구 본체에 박을 위험.

대응:

* 어댑터로 격리한다(에이전트 CLI, VCS, 프레임워크 휴리스틱).
* CI에서 fixture 회귀 검증을 항상 돌린다(9.2).
* 회사 코드 종속 결정은 어댑터 구현체에만 들어가고, core에는 들어가지 않는다.

### 21.6 도구 복잡도 증가

지식 그래프, RAG, MCP, 자동 갱신은 모두 유용하지만 MVP를 비대하게 만든다.

대응:

* 4장의 "포함하지 않는 것"을 엄격히 지킨다.
* 자동화는 종단 평가 성공 이후로 미룬다.
* 단순한 영향 매핑과 단순한 키워드 spoon 검색으로 시작한다.

---

## 22. 최종 방향

이 MVP의 핵심은 자동 유지 루프의 가능성을 작게 검증하는 것이다.

```text
3~5개 도메인 노드 부트스트랩
        ↓
commit → hook → 데몬 → 에이전트 → validate → 자동 커밋
        ↓
3주간 정상 작업 진행
        ↓
정확성, 노화, AI 활용, 사람 시간 측정
        ↓
효과가 있을 때만 확장
```

첫 버전에서 중요한 것은 완성도가 아니라 검증 가능성이다. 작은 범위에서 자동으로 유지되는 문서를 만들고, 그것이 실제 작업을 더 빠르고 정확하게 만드는지 확인한다.

---

## 23. 참고

### graphify

`graphify`는 코드, 문서, SQL schema 등 다양한 입력을 지식 그래프로 바꾸고, 사람이 읽는 보고서와 기계가 읽는 `graph.json`을 함께 생성한다.

차용한 아이디어:

* 사람이 읽는 문서와 기계가 읽는 그래프 색인을 분리한다.
* 관계에 신뢰도 태그를 둔다.
* query 가능한 그래프를 장기 확장 방향으로 본다.

참고: https://github.com/safishamsi/graphify

### aider repository map

`aider`의 저장소 지도는 전체 코드를 모두 넣지 않고, 중요한 class, function, signature를 압축해 AI 모델에게 제공한다.

차용한 아이디어:

* 전체 구현보다 핵심 기호와 연결을 우선한다.
* token budget을 고려해 필요한 정보만 제공한다.
* AI가 다음에 읽을 파일을 고를 수 있도록 구조화된 힌트를 제공한다.

참고: https://aider.chat/docs/repomap.html

### Repomix

`Repomix`는 저장소를 AI가 읽기 좋은 형식으로 묶는 도구다. include/exclude 규칙, token count, 보안 검사, 여러 출력 형식을 제공한다.

차용한 아이디어:

* ignore 규칙과 출력 위치를 설정 가능하게 둔다.
* 문서와 색인의 크기를 관리한다.
* secret이나 절대 경로 같은 위험한 내용을 검증한다.
* AI가 읽기 쉬운 출력 형식을 명시적으로 설계한다.

CodeSpoon은 `Repomix`와 반대 방향에서 출발한다. `Repomix`가 저장소 전체를 잘 포장하는 데 강하다면, CodeSpoon은 작업에 필요한 작은 맥락만 출처와 함께 떠주고 자동으로 살려두는 데 집중한다.

참고: https://github.com/yamadashy/repomix

### Microsoft GraphRAG

`GraphRAG`는 그래프 기반 검색 증강 생성 접근을 제안한다. 비정형 텍스트에서 개체와 관계를 추출하고, 그래프를 활용해 검색과 추론을 돕는다.

차용한 아이디어(장기 확장 방향):

* 관계 중심 검색은 단순 키워드 검색보다 복잡한 질문에 강할 수 있다.
* 여러 노드가 쌓이면 community 단위 요약이 유용해질 수 있다.
* 다만 초기 indexing 비용과 복잡도가 크므로 MVP에서는 제외한다.

참고: https://github.com/microsoft/graphrag
