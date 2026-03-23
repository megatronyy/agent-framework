# Agent Framework

A lightweight, extensible AI agent framework for building intelligent agents with tool calling capabilities.

## Features

- **Simple API**: Easy-to-use interface for creating AI agents
- **Multi-Provider Support**: Built-in support for Anthropic Claude and OpenAI models
- **Tool Calling**: Define custom tools that agents can use
- **Session Management**: Built-in session handling for conversational continuity
- **Skills System**: Self-contained capability packages following the Agent Skills standard
- **Persona System**: Define agent personality with SOUL.md, IDENTITY.md, TOOLS.md, and HEARTBEAT.md
- **Event System**: Listen to agent lifecycle events
- **TypeScript**: Full TypeScript support with type definitions
- **Extensible**: Easy to extend with custom providers and tools

## Installation

```bash
npm install @megatronyy/agent-framework
```

## Quick Start

```typescript
import { createTextAgent } from "@megatronyy/agent-framework";

const agent = createTextAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  systemPrompt: "You are a helpful assistant.",
  skills: true, // Enable skills loading
});

const result = await agent.run({
  message: "Hello, how are you?",
  onProgress: (token) => process.stdout.write(token),
});

console.log(result.response);
```

## Skills System

Skills are self-contained capability packages that the agent loads on-demand. They follow the [Agent Skills standard](https://agentskills.io/specification).

### Creating a Skill

Create a `.agents/skills/` directory and add a `SKILL.md` file:

```markdown
---
name: code-review
description: Perform comprehensive code reviews including style, security, performance, and best practices.
---

# Code Review Skill

## Review Checklist

### Style & Conventions
- Follow TypeScript best practices
- Use meaningful variable and function names

### Security
- Check for SQL injection, XSS, CSRF vulnerabilities
- Validate user input

## Usage

When reviewing code, provide:
1. Summary
2. Issues (critical, major, minor)
3. Suggestions
4. Positive notes
```

### Skill Locations

Skills are loaded from:
- `~/.agent-framework/skills/`
- `~/.agents/skills/`
- `.agent-framework/skills/` in current directory
- `.agents/skills/` in current directory

## Persona System

Define your agent's personality using workspace files:

### SOUL.md

Defines the agent's core truths, boundaries, and vibe:

```markdown
# SOUL.md - Who You Are

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip filler words — just help.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring.

## Boundaries

- Private things stay private.
- When in doubt, ask before acting externally.

## Vibe

Be the assistant you'd actually want to talk to. Concise when needed, thorough when it matters.
```

### IDENTITY.md

Defines the agent's identity:

```markdown
- **Name:** Claude
- **Creature:** AI assistant
- **Vibe:** helpful, friendly, occasionally witty
- **Emoji:** 🤖
- **Avatar:** ./avatars/claude.png
```

### TOOLS.md

Environment-specific configuration notes:

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova"
- Default speaker: Kitchen HomePod
```

### HEARTBEAT.md

Periodic tasks for the agent to check:

```markdown
# Add tasks below when you want the agent to check something periodically
- Check system status every 30 minutes
- Review logs for errors every hour
```

## Custom Tools

Define custom tools that agents can use:

```typescript
import { createAgent } from "@megatronyy/agent-framework";
import type { Tool } from "@megatronyy/agent-framework";

const weatherTool: Tool = {
  name: "get_weather",
  description: "Get the current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city name",
      },
    },
    required: ["location"],
  },
  handler: async ({ input }) => {
    // Your weather logic here
    return { content: "The weather in " + input.location + " is sunny." };
  },
};

const agent = createAgent({
  id: "weather-agent",
  name: "Weather Assistant",
  model: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  tools: [weatherTool],
  skills: true,
});
```

## Built-in Tools

The framework includes several built-in tools:

- **calculator**: Evaluate mathematical expressions
- **datetime**: Get current date/time in various formats
- **memory**: Store and retrieve values across turns

```typescript
import { createAgent, builtinTools } from "@megatronyy/agent-framework";

const agent = createAgent({
  id: "my-agent",
  name: "My Agent",
  model: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  tools: builtinTools,
  skills: true,
});
```

## Event Handling

Listen to agent lifecycle events:

```typescript
agent.on((event) => {
  switch (event.type) {
    case "session:start":
      console.log("Session started");
      break;
    case "tool:start":
      console.log(`Tool called: ${event.data?.tool}`);
      break;
    case "skill:loaded":
      console.log(`Skill loaded: ${event.data?.skill}`);
      break;
  }
});
```

## API Reference

### `createAgent(config: AgentConfig): Agent`

Create a new agent with the specified configuration.

### `createTextAgent(options: {...}): Agent`

Create a simple text-only agent with skills enabled.

### `Agent.run(options: AgentRunOptions): Promise<AgentRunResult>`

Run the agent with a message.

### `Agent.getSkillRegistry(): SkillRegistry`

Get the skill registry for managing skills.

### `Agent.getPersonaLoader(): PersonaLoader`

Get the persona loader for managing persona files.

### `Agent.reloadSkills(): Promise<void>`

Reload all skills from disk.

## Examples

See the `examples/` directory for more usage examples:

- `basic-usage.ts`: Simple agent example
- `tools-usage.ts`: Custom tools example
- `event-handling.ts`: Event system example
- `skills-persona.ts`: Skills and persona example

## Templates

Template files are available in the `templates/` directory:

- `SOUL.md`: Agent personality template
- `IDENTITY.md`: Agent identity template
- `TOOLS.md`: Environment configuration template
- `HEARTBEAT.md`: Periodic tasks template
- `skills/code-review/SKILL.md`: Example skill

## License

MIT
