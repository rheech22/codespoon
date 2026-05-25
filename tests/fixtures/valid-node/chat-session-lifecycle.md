---
id: chat-session-lifecycle
kind: domain
status: auto-updated
confidence: medium
scope:
  include:
    - src/services
sources:
  - path: chat-service.ts
    symbols:
      - ChatService
      - createSession
  - path: ws-service.ts
    symbols:
      - handleStreamingMessage
last_updated_commit: abc1234
last_updated_at: 2026-05-25
---

# Chat Session Lifecycle

## Summary

Chat session lifecycle manages session creation, message streaming, and state synchronization.

## When To Use This Node

When working on chat session creation, message sending, or WebSocket streaming.

## Entry Points

- `ChatPage` component

## Key Code Paths

- `ChatService.createSession()` — creates a new session
- `handleStreamingMessage()` — processes streaming WebSocket messages

## Data And Event Flow

1. User opens chat page
2. Session is created via REST API
3. WebSocket connection is established
4. Messages are streamed in real-time

## Invariants

- Session ID must be unique
- WebSocket connection must be established before sending messages

## Source Trace

- Session creation: `chat-service.ts`
- WebSocket handling: `ws-service.ts`

## Open Questions

- Should session timeout be configurable?
