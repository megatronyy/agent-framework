# Agent Framework

一个轻量级、可扩展的 AI 智能体框架，用于构建具有工具调用能力的智能代理。

## 特性

- **简单 API**: 易于使用的接口，可快速创建 AI 智能体
- **多模型支持**: 内置支持 Anthropic Claude、OpenAI 和智谱AI (GLM) 模型
- **工具调用**: 定义智能体可以使用的自定义工具
- **会话管理**: 内置会话处理，保持对话连续性
- **技能系统**: 遵循 Agent Skills 标准的自包含能力包
- **人格系统**: 通过 SOUL.md、IDENTITY.md、TOOLS.md 和 HEARTBEAT.md 定义智能体个性
- **事件系统**: 监听智能体生命周期事件
- **TypeScript**: 完整的 TypeScript 支持和类型定义
- **可扩展**: 易于扩展自定义模型提供者和工具

## 安装

```bash
npm install @megatronyy/agent-framework
```

## 快速开始

```typescript
import { createTextAgent } from "@megatronyy/agent-framework";

const agent = createTextAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  systemPrompt: "You are a helpful assistant.",
  skills: true, // 启用技能加载
});

const result = await agent.run({
  message: "Hello, how are you?",
  onProgress: (token) => process.stdout.write(token),
});

console.log(result.response);
```

## 技能系统

技能是智能体按需加载的自包含能力包。它们遵循 [Agent Skills 标准](https://agentskills.io/specification)。

### 创建技能

创建 `.agents/skills/` 目录并添加 `SKILL.md` 文件：

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

### 技能加载位置

技能从以下位置加载：
- `~/.agent-framework/skills/`
- `~/.agents/skills/`
- 当前目录下的 `.agent-framework/skills/`
- 当前目录下的 `.agents/skills/`

## 人格系统

使用工作区文件定义智能体的个性：

### SOUL.md

定义智能体的核心原则、边界和风格：

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

定义智能体的身份：

```markdown
- **Name:** Claude
- **Creature:** AI assistant
- **Vibe:** helpful, friendly, occasionally witty
- **Emoji:** 🤖
- **Avatar:** ./avatars/claude.png
```

### TOOLS.md

特定环境的配置说明：

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

智能体定期检查的任务：

```markdown
# Add tasks below when you want the agent to check something periodically
- Check system status every 30 minutes
- Review logs for errors every hour
```

## 自定义工具

定义智能体可以使用的自定义工具：

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

## 内置工具

框架包含多个内置工具：

- **calculator**: 计算数学表达式
- **datetime**: 获取各种格式的当前日期/时间
- **memory**: 跨回合存储和检索值

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

## 事件处理

监听智能体生命周期事件：

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

## API 参考

### `createAgent(config: AgentConfig): Agent`

使用指定配置创建新智能体。

### `createTextAgent(options: {...}): Agent`

创建启用了技能的简单纯文本智能体。

### `Agent.run(options: AgentRunOptions): Promise<AgentRunResult>`

使用消息运行智能体。

### `Agent.getSkillRegistry(): SkillRegistry`

获取技能注册表以管理技能。

### `Agent.getPersonaLoader(): PersonaLoader`

获取人格加载器以管理人格文件。

### `Agent.reloadSkills(): Promise<void>`

从磁盘重新加载所有技能。

## 智谱AI (GLM) 支持

框架支持使用 `zhipu` 提供者来调用智谱AI的GLM模型：

```typescript
import { createTextAgent } from "@megatronyy/agent-framework";

const agent = createTextAgent({
  apiKey: process.env.ZHIPUAI_API_KEY,
  provider: "zhipu",
  model: "glm-4-flash", // 默认模型
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run({
  message: "你好，请介绍一下智谱AI。",
  onProgress: (token) => process.stdout.write(token),
});
```

可用的智谱AI模型：
- `glm-4-flash`: 快速、经济的模型
- `glm-4`: 标准模型
- `glm-4-plus`: 增强能力模型
- `glm-4-air`: 轻量级模型
- `glm-4-long`: 长上下文模型 (128K tokens)
- `glm-4.7`: 最新一代模型
- `glm-5`: 下一代旗舰模型

## 示例

查看 `examples/` 目录以获取更多使用示例：

- `basic-usage.ts`: 简单智能体示例
- `tools-usage.ts`: 自定义工具示例
- `event-handling.ts`: 事件系统示例
- `skills-persona.ts`: 技能和人格示例
- `zhipu-usage.ts`: 智谱AI (GLM) 提供者示例

## 模板

模板文件位于 `templates/` 目录中：

- `SOUL.md`: 智能体个性模板
- `IDENTITY.md`: 智能体身份模板
- `TOOLS.md`: 环境配置模板
- `HEARTBEAT.md`: 定期任务模板
- `skills/code-review/SKILL.md`: 示例技能

## 许可证

MIT
