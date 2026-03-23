/**
 * Anthropic provider implementation
 */

import type {
  ModelConfig,
  Message,
  Tool,
  AgentRunResult,
  AgentProvider,
} from "../../types.js";

let AnthropicClass: any = null;

async function getAnthropic() {
  if (AnthropicClass) return AnthropicClass;

  try {
    const module = await import("@anthropic-ai/sdk");
    AnthropicClass = module.Anthropic;
    return AnthropicClass;
  } catch (error) {
    throw new Error(
      "@anthropic-ai/sdk is required to use Anthropic provider. Install it with: npm install @anthropic-ai/sdk",
    );
  }
}

function convertMessagesToAnthropic(messages: Message[]): any[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

function convertToolsToAnthropic(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

export class AnthropicProvider implements AgentProvider {
  id = "anthropic" as const;
  private config: ModelConfig;
  private client: any = null;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  private async getClient() {
    if (this.client) return this.client;

    const Anthropic = await getAnthropic();

    const options: Record<string, unknown> = {};

    if (this.config.apiKey) {
      options.apiKey = this.config.apiKey;
    } else if (process.env.ANTHROPIC_API_KEY) {
      options.apiKey = process.env.ANTHROPIC_API_KEY;
    } else {
      throw new Error("Anthropic API key is required. Set it via config.apiKey or ANTHROPIC_API_KEY env var.");
    }

    if (this.config.baseUrl) {
      options.baseURL = this.config.baseUrl;
    }

    if (this.config.headers) {
      options.defaultHeaders = this.config.headers;
    }

    this.client = new Anthropic(options);
    return this.client;
  }

  async generate(params: {
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    onProgress?: (token: string) => void;
    abortSignal?: AbortSignal;
  }): Promise<AgentRunResult> {
    const client = await this.getClient();

    const anthropicMessages = convertMessagesToAnthropic(params.messages);
    const anthropicTools = params.tools ? convertToolsToAnthropic(params.tools) : undefined;

    let response = "";
    const toolCalls: Array<{ tool: Tool; input: Record<string, unknown> }> = [];

    const stream = await client.messages.create({
      model: this.config.model,
      messages: anthropicMessages,
      tools: anthropicTools,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
    });

    for await (const event of stream) {
      if (params.abortSignal?.aborted) {
        throw new Error("Generation aborted");
      }

      switch (event.type) {
        case "content_block_start":
          if (event.content_block?.type === "tool_use") {
            toolCalls.push({
              tool: { name: event.content_block.name, description: "", inputSchema: {}, handler: async () => ({ content: "" }) },
              input: event.content_block.input as Record<string, unknown>,
            });
          }
          break;

        case "content_block_delta":
          if (event.delta?.type === "text_delta") {
            const token = event.delta.text;
            response += token;
            if (params.onProgress) {
              params.onProgress(token);
            }
          }
          break;

        case "message_stop":
          break;

        default:
          break;
      }
    }

    // Match tool calls with actual tools
    const toolExecutions = toolCalls.map((tc) => {
      const tool = params.tools?.find((t) => t.name === tc.tool.name);
      if (!tool) return null;

      return {
        tool,
        input: tc.input,
        result: { content: "" },
        durationMs: 0,
      };
    }).filter((tc): tc is NonNullable<typeof tc> => tc !== null);

    return {
      response,
      toolExecutions,
    };
  }
}
