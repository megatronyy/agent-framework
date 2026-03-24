# Agent Framework 改进计划

> 基于全面的代码审查生成
> 日期: 2025-03-23
> 状态: **待审核**

---

## 执行摘要

agent-framework 拥有坚实的基础，架构良好且模块化设计清晰。但为了达到生产就绪状态，以下几个领域需要改进：

- **P0 (关键)**: 安全加固、错误处理一致性
- **P1 (高优先级)**: 性能优化、缺失的核心功能
- **P2 (中优先级)**: 额外的提供商支持、监控、文档

---

## P0: 关键问题 (必须修复)

### 1. 安全加固

#### 1.1 文件工具路径遍历漏洞
**问题**: 文件工具中缺少路径验证
**影响**: 可以访问预期目录之外的敏感文件

```typescript
// 当前: 存在漏洞
await fs.readFile(input.path as string)

// 修复: 添加路径验证
function validatePath(filePath: string, allowedBase?: string): void {
  const resolved = resolve(filePath);
  if (allowedBase && !resolved.startsWith(allowedBase)) {
    throw new Error('检测到路径遍历攻击');
  }
}
```

#### 1.2 代码执行沙箱弱点
**问题**: 基于模式的阻止可以被绕过
**影响**: 可能存在命令注入

```typescript
// 当前: 可被绕过的模式
/\brm\s+-rf\s+/

// 修复: 使用适当的沙箱
- 实现基于容器的执行 (Docker/podman)
- 或使用 node:vm 模块配合受限上下文
- 或集成现有沙箱: isolated-vm
```

#### 1.3 输入验证框架
**问题**: 工具间的验证不一致
**影响**: 各种注入漏洞

```typescript
// 添加: src/validation/
interface Validator<T> {
  validate(input: unknown): T;
  sanitize(input: unknown): T;
}

// 实现:
- 字符串验证器 (长度、模式、允许的字符)
- 路径验证器 (无遍历、允许的目录)
- 命令验证器 (无 shell 注入)
- JSON 验证器 (基于 schema、最大深度/大小)
```

#### 1.4 审计日志
**问题**: 敏感操作没有日志记录
**影响**: 无法跟踪安全事件

```typescript
// 添加: src/audit/
interface AuditLogger {
  log(event: AuditEvent): void;
}

interface AuditEvent {
  timestamp: number;
  agentId: string;
  sessionId: string;
  action: string;  // tool_call, file_access, code_execution
  details: Record<string, unknown>;
  userId?: string;
  success: boolean;
}
```

### 2. 错误处理一致性

#### 2.1 标准化错误类型
```typescript
// 添加: src/errors/
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) { super(message); }
}

export class ToolExecutionError extends AgentError { }
export class ValidationError extends AgentError { }
export class ContextOverflowError extends AgentError { }
export class SubagentHandoffError extends AgentError { }
```

#### 2.2 错误恢复机制
```typescript
// 添加带指数退避的重试逻辑
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T>
```

---

## P1: 高优先级改进

### 3. 性能优化

#### 3.1 缓存层
```typescript
// 添加: src/cache/
interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// 实现:
- 内存缓存 (LRU)
- Redis 缓存适配器
- 基于文件的缓存

// 缓存:
- LLM 响应 (按消息哈希)
- 工具结果 (按输入哈希)
- Web 获取结果 (按 URL 和 TTL)
- RAG 搜索结果
```

#### 3.2 连接池
```typescript
// 添加: src/http/
export class HttpClientPool {
  private pools: Map<string, Pool<Agent>>;

  acquire(baseUrl: string): Agent;
  release(baseUrl: string, agent: Agent): void;
  drain(): Promise<void>;
}
```

#### 3.3 懒加载
```typescript
// 工具和技能按需加载
export class LazyToolRegistry implements ToolRegistry {
  private loaders: Map<string, () => Promise<Tool>>;

  async get(name: string): Promise<Tool>;
  register(name: string, loader: () => Promise<Tool>): void;
}
```

### 4. 缺失的核心功能

#### 4.1 持久化向量存储
```typescript
// 添加: src/context/stores/
- PostgresVectorStore (使用 pgvector 扩展)
- PineconeVectorStore
- WeaviateVectorStore
- QdrantVectorStore
- ChromaVectorStore
```

#### 4.2 长期记忆系统
```typescript
// 添加: src/memory/
interface MemoryStore {
  // 语义记忆 (事实、知识)
  storeSemantic(key: string, value: unknown): Promise<void>;
  retrieveSemantic(query: string, limit?: number): Promise<Memory[]>;

  // 情景记忆 (对话、事件)
  storeEpisode(episode: Episode): Promise<void>;
  retrieveEpisodes(agentId: string, since?: Date): Promise<Episode[]>;

  // 程序记忆 (技能、过程)
  storeProcedure(skill: string): Promise<void>;
  retrieveProcedures(context: string): Promise<Skill[]>;
}
```

#### 4.3 中间件管道
```typescript
// 添加: src/middleware/
type Middleware = (
  context: ExecutionContext,
  next: () => Promise<void>
) => Promise<void>;

// 内置中间件:
- LoggingMiddleware (日志记录)
- CacheMiddleware (缓存)
- RateLimitMiddleware (速率限制)
- ValidationMiddleware (验证)
- AuthMiddleware (认证)
- MetricsMiddleware (指标)
```

#### 4.4 流式响应处理
```typescript
// 添加: src/streaming/
interface StreamProcessor {
  process(chunk: string): void;
  complete(): void;
  error(err: Error): void;
}

// 实现:
- 增量处理器 (增量更新)
- 思维处理器 (推理提取)
- 工具调用处理器 (流中检测工具使用)
```

### 5. 提供商支持

#### 5.1 额外的提供商
```typescript
// 添加: src/core/providers/
- GeminiProvider (Google)
- CohereProvider
- MistralProvider
- AzureOpenAIProvider
- BedrockProvider (AWS)
- OllamaProvider (改进本地模型支持)
```

#### 5.2 提供商抽象层
```typescript
// 标准化工具调用格式转换
interface ProviderAdapter {
  // 将我们的格式转换为提供商格式
  convertMessages(messages: Message[]): ProviderMessage[];
  convertTools(tools: Tool[]): ProviderTool[];

  // 将提供商响应转换为我们的格式
  convertResponse(response: ProviderResponse): AgentRunResult;
}
```

---

## P2: 中优先级增强

### 6. 监控与可观察性

#### 6.1 指标收集
```typescript
// 添加: src/telemetry/
interface MetricsCollector {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  timing(name: string, duration: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
}

// 要跟踪的指标:
- Agent 调用次数
- 工具执行次数 (按工具)
- LLM token 使用量 (输入/输出)
- 响应延迟 (p50, p95, p99)
- 错误率 (按类型)
- 缓存命中率
```

#### 6.2 链路追踪
```typescript
// 添加: src/tracing/
interface Tracer {
  startSpan(name: string, options?: SpanOptions): Span;
}

interface Span {
  setAttribute(key: string, value: unknown): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  end(): void;
}
```

#### 6.3 调试仪表板
```typescript
// 添加: src/debug/
- Inspector: 查看 agent 状态、消息、上下文
- Profiler: 性能分析
- Logger: 带级别的结构化日志
- Repl: 交互式调试 shell
```

### 7. 开发者体验

#### 7.1 CLI 工具
```typescript
// 添加: bin/agent-framework
agent-framework init <project-name>  # 脚手架新项目
agent-framework add <tool>           # 添加新工具
agent-framework test                 # 运行测试
agent-framework lint                 # 代码检查
agent-framework build                # 生产构建
```

#### 7.2 热重载
```typescript
// 添加: src/dev/
- 监听文件变化
- 无需重启重新加载工具/技能
- 重载期间保持会话状态
```

### 8. 文档

#### 8.1 API 文档
```markdown
# docs/api/
- overview.md (概述)
- agents.md (Agent 类、配置、生命周期)
- tools.md (Tool 接口、内置工具、自定义工具)
- skills.md (Skill 格式、加载、最佳实践)
- persona.md (Persona 文件、配置)
- subagent.md (Subagent 系统、委托)
- context.md (上下文引擎、向量存储)
- providers.md (提供商配置、切换)
- errors.md (错误类型、处理)
- migration.md (版本迁移指南)
```

#### 8.2 教程
```markdown
# docs/tutorials/
- getting-started.md (快速开始)
- building-a-tool.md (构建工具)
- creating-skills.md (创建技能)
- multi-agent-workflows.md (多代理工作流)
- rag-implementation.md (RAG 实现)
- deployment.md (部署)
```

### 9. 测试改进

#### 9.1 测试工具
```typescript
// 添加: src/testing/
- MockAgent (用于测试工具)
- MockProvider (用于测试代理)
- TestHarness (集成测试辅助)
- Assertion helpers (代理专用断言)
```

#### 9.2 额外的测试覆盖
```
tests/
- integration/ (提供商集成测试)
- security/ (漏洞测试)
- performance/ (负载测试、基准测试)
- e2e/ (完整工作流测试)
```

---

## 实施优先级顺序

### 阶段 1: 安全与稳定性 (第 1-2 周)
1. ✅ 修复文件工具路径遍历
2. ✅ 实现输入验证框架
3. ✅ 标准化错误类型
4. ✅ 审计日志
5. ✅ 代码执行沙箱改进

### 阶段 2: 性能 (第 3-4 周)
1. ✅ 缓存层
2. ✅ 连接池
3. ✅ 懒加载
4. ✅ 内存泄漏修复

### 阶段 3: 功能 (第 5-8 周)
1. ✅ 持久化向量存储
2. ✅ 长期记忆系统
3. ✅ 中间件管道
4. ✅ 额外的提供商
5. ✅ 流式改进

### 阶段 4: 开发体验与可观察性 (第 9-10 周)
1. ✅ CLI 工具
2. ✅ 热重载
3. ✅ 指标收集
4. ✅ 调试仪表板
5. ✅ 文档

---

## 快速见效 (每个可在 1-2 小时内完成)

1. 为所有公共 API 添加 JSDoc 注释
2. 创建包含指南的 CONTRIBUTING.md
3. 添加 .editorconfig 以确保一致的格式
4. 为常见用例创建示例项目
5. 添加用于 lint/测试的预提交钩子
6. 创建 issue/PR 模板
7. 添加 CHANGELOG.md 生成
8. 设置自动化发布工作流

---

## 审核问题

1. **安全性**: 当前的威胁模型对您的用例是否可接受？
2. **性能**: 您的延迟/预算要求是什么？
3. **提供商**: 您需要哪些额外的 LLM 提供商？
4. **部署**: 这将在哪里运行？(边缘、无服务器、容器？)
5. **规模**: 您期望有多少并发代理/会话？
6. **持久化**: 您是否需要持久化的会话存储？
7. **合规性**: 是否有任何监管要求 (GDPR、SOC2 等)？

---

## 后续步骤

审核此计划后：

1. **确定优先级**: 将项目标记为必须有、最好有、以后再说
2. **时间表**: 根据您的资源估算实施时间表
3. **批准**: 确认首先实施哪些项目
4. **迭代**: 从阶段 1 (安全与稳定性) 开始
