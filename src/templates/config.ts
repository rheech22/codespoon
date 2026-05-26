export const DEFAULT_CONFIG_YAML = `# CodeSpoon configuration
# This file is shared by the team and should be committed.

# Directory where knowledge nodes live (relative to repo root)
knowledge_dir: docs/knowledge

# Tool-internal state directory (not committed)
state_dir: .codespoon

# Maximum node body length in characters
max_node_chars: 12000

# Agent retry count on validation failure
retry_count: 3

# Paths to exclude from analysis (glob patterns)
ignore:
  - node_modules/**
  - .git/**
  - dist/**
  - build/**
  - coverage/**

# Auto-generated paths — files under these paths trigger a warning when listed as sources
generated_paths:
  - src/api/**

# AI agent settings
agent:
  cli: opencode
  model: synthetic/hf:zai-org/GLM-5.1
  invoke_timeout_seconds: 300

# VCS settings
vcs:
  driver: git

# Framework adapters (bootstrap heuristics)
framework_adapters:
  - next-app-router
`;

export const README_KNOWLEDGE = `# Knowledge Layer

This directory holds the domain knowledge nodes that codespoon maintains.

- \`nodes/\`: per-domain knowledge nodes (Markdown)
- \`graph.json\`: machine-readable node relations and source index
- \`evaluations/\`: longitudinal evaluation records
`;

export const GITIGNORE_RECOMMENDATION = `.codespoon/cache/
.codespoon/runs/
`;
