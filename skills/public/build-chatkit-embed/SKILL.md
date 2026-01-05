---
name: build-chatkit-embed
description: Build, edit, and debug OpenAI ChatKit embeddable chat experiences that integrate with the Agents SDK. Use when embedding ChatKit in a web app (React or web component), creating ChatKit sessions, implementing a ChatKit Python server/store, wiring Agents SDK logic into ChatKit responses, or troubleshooting ChatKit auth/logging/domain keys.
---

# Build ChatKit Embed

## Overview

Use this skill to ship an embeddable ChatKit UI backed by either OpenAI-hosted ChatKit (Agent Builder workflows) or a self-hosted ChatKit Python server that calls the Agents SDK.

## Workflow Decision Tree

1. Decide hosting mode:
   - **OpenAI-hosted ChatKit**: You only implement session creation and embed the client. Use when Agent Builder workflows are acceptable.
   - **Self-hosted ChatKit (Python)**: You implement ChatKitServer, storage, and response logic. Use when you need custom orchestration or direct Agents SDK control.
2. Decide client type:
   - **React**: Use `@openai/chatkit-react` and `useChatKit`.
   - **Web component**: Use the `openai-chatkit` custom element and set options manually.
3. Decide data model:
   - Use threads + items to persist conversations. Choose a store implementation (in-memory for dev, DB for prod).
4. Decide debug/ops requirements:
   - Enable logging hooks, add authentication, and configure domain keys for production.

## Hosted ChatKit (OpenAI platform)

1. Implement a server endpoint that creates a ChatKit session and returns `client_secret`.
2. Embed ChatKit in React or via the web component.
3. Implement session refresh behavior (client side) if needed.

Open `references/chatkit-platform.md` for the exact session and embed code snippets from the OpenAI platform docs.

## Self-hosted ChatKit (Python + Agents SDK)

1. Build a `ChatKitServer` and implement `respond` to call the Agents SDK.
2. Define `RequestContext` if you need per-request auth or metadata.
3. Implement a `ChatKitStore` (in-memory for dev, DB for prod) to persist threads and items.
4. Expose a streaming HTTP endpoint (FastAPI example in refs).

Open these references as needed:
- `references/chatkit-python-quickstart.md` for server and client setup.
- `references/chatkit-python-respond.md` for request context, OpenAI response logic, and FastAPI streaming.
- `references/chatkit-python-api.md` to locate `chatkit.agents` helpers for Agents SDK integration.
- `references/chatkit-threads.md` for thread and item semantics.

## Client Integration

- **React**: Use `useChatKit` and `ChatKit` with a `clientSecret` or API config.
- **Web component**: Create `openai-chatkit`, call `setOptions`, and inject into the DOM.

Open `references/chatkit-js.md`, `references/chatkit-python-quickstart.md`, or `references/chatkit-platform.md` depending on hosting mode.

## Debugging Checklist

- Verify `client_secret` creation and refresh logic (hosted) or backend `/chatkit` endpoint (self-hosted).
- Confirm domain keys and allowed domains when using ChatKit in the browser.
- Enable log hooks and error listeners to capture runtime issues.
- Validate thread persistence by listing threads and items after requests.

Open `references/chatkit-python-production.md` for log hooks, error listeners, auth, and domain key examples.

## Production Readiness

- Keep API keys server-side only.
- Add authentication and authorization to ChatKit endpoints.
- Use domain keys for browser clients.
- Instrument logging and error reporting.

Open `references/chatkit-python-production.md` for production-safe patterns.

## Resources

- `references/chatkit-platform.md` - OpenAI platform ChatKit sessions and embed snippets.
- `references/chatkit-js.md` - ChatKit JS quickstart examples.
- `references/chatkit-python-quickstart.md` - install, embed, server, and in-memory store examples.
- `references/chatkit-python-respond.md` - request context, streaming endpoint, and response logic.
- `references/chatkit-python-production.md` - logging, auth, and domain keys.
- `references/chatkit-threads.md` - thread and item semantics.
- `references/chatkit-python-api.md` - module map including `chatkit.agents`.
