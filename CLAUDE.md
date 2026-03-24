# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
# Build
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode compilation

# Testing
npm test               # Run all tests with vitest
npm run test:coverage  # Run tests with coverage report

# Linting & Formatting
npm run lint           # ESLint
npm run format         # Prettier
npm run typecheck      # Type check without emitting files
```

**Note:** To run example files directly, use `npx tsx examples/<file>.ts`.

## Project Architecture

This is a modular AI agent framework with the following key systems:

### Core (`src/core/`)
- **Agent.ts**: Main `Agent` class with `id` and `name` getters. Orchestrates providers, tools, skills, and persona.
- **providers/**: Model provider implementations (`AnthropicProvider`, `OpenAIProvider`, `ZhipuProvider`)
  - All providers implement `AgentProvider` interface with a `generate()` method
  - ZhipuProvider uses OpenAI SDK with custom baseURL (`https://open.bigmodel.cn/api/paas/v4/`)
  - When adding a new provider: update `ModelProvider` type in `src/types.ts`, create provider class, add to `Agent.createProvider()`, export from `src/index.ts`

### Tools (`src/tools/`)
- **MemoryToolRegistry**: Tool registration and lookup
- **builtins/**: calculator, datetime, memory tools
- **extended tools**: web-fetch, web-search, file-read/write/list, pdf, cron, code-execute
- Tools follow schema: `{ name, description, inputSchema, handler }`

### Skills (`src/skills/`)
- **SkillRegistry**: Loads skills from multiple locations (in priority order):
  1. `~/.agent-framework/skills/`
  2. `~/.agents/skills/`
  3. `.agent-framework/skills/` (current dir)
  4. `.agents/skills/` (current dir)
- **SkillParser**: Parses frontmatter in `SKILL.md` files (name, description)
- Follows [Agent Skills standard](https://agentskills.io/specification)

### Persona (`src/persona/`)
- **PersonaLoader**: Loads `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md` from persona path
- Builds system prompt combining all persona files

### Subagent (`src/subagent/`)
- **SubagentRegistry**: Manages subagent metadata with `agent` property containing `Agent` instance
- **SubagentExecutor**: Executes subagents with timeout/turn limits
- **HandoffManager**: Transfers control between agents using strategies (immediate/await_confirmation/conditional)
- **Type guards**: Use `"agent" in fromAgent` to distinguish `Agent` vs `SubagentMetadata`

### Context (`src/context/`)
- **ContextEngine**: Token counting, context pruning, summarization, RAG
- **VectorStore**: In-memory vector store with cosine similarity for semantic search
- **createRAGTool()**: Factory for retrieval-augmented generation tools

## TypeScript Configuration

- Target: ES2022, Module: ESNext
- Strict mode enabled with `noUnusedLocals` and `noUnusedParameters`
- Prefix intentionally unused parameters with underscore (`_param`)
- Use `SimpleTokenCounter` class (not `TokenCounter` type) in summarizer

## Module Exports

The package exports sub-paths via `package.json` exports:
- `.` → Main entry (`src/index.ts`)
- `/core` → Core module (`src/core/index.ts`)
- `/tools` → Tools module (`src/tools/index.ts`)
- `/session` → Session module (`src/session/index.ts`)
