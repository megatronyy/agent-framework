# Agent Framework

A lightweight, extensible AI agent framework for building intelligent agents with tool calling capabilities.

## Features

- **Simple API**: Easy-to-use interface for creating AI agents
- **Multi-Provider Support**: Built-in support for Anthropic Claude and OpenAI models
- **Tool Calling**: Define custom tools that agents can use
- **Session Management**: Built-in session handling for conversational continuity
- **Event System**: Listen to agent lifecycle events
- **TypeScript**: Full TypeScript support with type definitions
- **Extensible**: Easy to extend with custom providers and tools

## Installation

```bash
npm install @megatronyy/agent-framework
```

Or with yarn:

```bash
yarn add @megatronyy/agent-framework
```

## Quick Start

```typescript
import { createTextAgent } from "@megatronyy/agent-framework";

const agent = createTextAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run({
  message: "Hello, how are you?",
  onProgress: (token) => process.stdout.write(token),
});

console.log(result.response);
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
  systemPrompt: "You are a weather assistant.",
  tools: [weatherTool],
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
    case "tool:end":
      console.log(`Tool completed in ${event.data?.durationMs}ms`);
      break;
  }
});
```

## Session Management

Continue conversations across multiple runs:

```typescript
const result1 = await agent.run({
  message: "My favorite color is blue.",
});

const result2 = await agent.run({
  sessionId: result1.metadata?.sessionId,
  message: "What's my favorite color?",
});
```

## API Reference

### `createAgent(config: AgentConfig): Agent`

Create a new agent with the specified configuration.

### `createTextAgent(options: {...}): Agent`

Create a simple text-only agent.

### `Agent.run(options: AgentRunOptions): Promise<AgentRunResult>`

Run the agent with a message.

### `Agent.on(listener: EventListener): () => void`

Register an event listener. Returns an unsubscribe function.

### Types

```typescript
interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  model: ModelConfig;
  systemPrompt?: string;
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}
```

## Examples

See the `examples/` directory for more usage examples:

- `basic-usage.ts`: Simple agent example
- `tools-usage.ts`: Custom tools example
- `event-handling.ts`: Event system example

## License

MIT
