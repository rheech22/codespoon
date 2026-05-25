export const DEFAULT_CONFIG_YAML = `# CodeSpoon 설정
# 이 파일은 팀과 공유되며 커밋 대상입니다.

# 지식 노드가 위치할 디렉터리 (저장소 루트 기준)
knowledge_dir: docs/knowledge

# 도구 내부 상태 디렉터리 (커밋하지 않음)
state_dir: .codespoon

# 노드 본문 최대 길이 (문자 수)
max_node_chars: 12000

# 에이전트 재시도 횟수
retry_count: 3

# 분석에서 제외할 경로 (glob 패턴)
ignore:
  - node_modules/**
  - .git/**
  - dist/**
  - build/**
  - coverage/**

# 자동 생성된 경로 — 이 경로의 파일이 source로 포함되면 경고
generated_paths:
  - src/api/**

# AI 에이전트 설정
agent:
  cli: opencode
  model: anthropic/claude-sonnet-4-6
  invoke_timeout_seconds: 300

# VCS 설정
vcs:
  driver: git

# 프레임워크 어댑터 (부트스트랩 휴리스틱)
framework_adapters:
  - next-app-router
`;

export const README_KNOWLEDGE = `# Knowledge Layer

이 디렉터리는 CodeSpoon이 자동 유지하는 도메인 지식 노드를 둡니다.

- \`nodes/\`: 도메인별 지식 노드 (Markdown)
- \`graph.json\`: 노드 관계와 출처 색인
- \`evaluations/\`: 종단 평가 기록
`;

export const GITIGNORE_RECOMMENDATION = `.codespoon/cache/
.codespoon/runs/
`;
