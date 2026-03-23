/**
 * OpenAI provider implementation
 */

import type {
  ModelConfig,
  Message,
  Tool,
  AgentRunResult,
  AgentProvider,
} from "../../types.js";

let OpenAIClass: any = null;

async function getOpenAI() {
  if (OpenAIClass) return OpenAIClass;

  try {
    const module = await import("openai");
    OpenAIClass = module.OpenAI;
    return OpenAIClass;
  } catch (error) {
    throw new Error(
      "openai is required to use OpenAI provider. Install it with: npm install openai",
    );
  }
}

function convertMessagesToOpenAI(messages: Message[]): any[] {
  const result: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      result.push({ role: "system", content: msg.content });
      continue;
    }

    const content = typeof msg.content === "string"
      ? msg.content
      : msg.content.map((block) => {
        if (block.type === "text") return { type: "text", text: block.text };
        if (block.type === "image") {
          return {
            type: "image_url",
            image_url: block.source.type === "url"
              ? { url: block.source.url }
              : { url: `data:${block.source.media_type};base64,${block.source.data}` },
          };
        }
        return null;
      }).filter(Boolean);

    result.push({ role: msg.role, content });
  }

  return result;
}

function convertToolsToOpenAI(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

export class OpenAIProvider implements AgentProvider {
  id = "openai" as const;
  private config: ModelConfig;
  private client: any = null;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  private async getClient() {
    if (this.client) return this.client;

    const OpenAI = await getOpenAI();

    const options: Record<string, unknown> = {
      dangerouslyAllowBrowser: true, // Allow usage in non-Node environments
    };

    if (this.config.apiKey) {
      options.apiKey = this.config.apiKey;
    } else if (process.env.OPENAI_API_KEY) {
      options.apiKey = process.env.OPENAI_API_KEY;
    } else {
      throw new Error("OpenAI API key is required. Set it via config.apiKey or OPENAI_API_KEY env var.");
    }

    if (this.config.baseUrl) {
      options.baseURL = this.config.baseUrl;
    }

    if (this.config.headers) {
      options.defaultHeaders = this.config.headers;
    }

    this.client = new OpenAI(options);
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

    const openaiMessages = convertMessagesToOpenAI(params.messages);
    const openaiTools = params.tools ? convertToolsToOpenAI(params.tools) : undefined;

    let response = "";
    const toolCalls: Array<{ toolName: string; toolInput: Record<string, unknown> }> = [];

    const stream = await client.chat.completions.create({
      model: this.config.model,
      messages: openaiMessages,
      tools: openaiTools,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      if (params.abortSignal?.aborted) {
        throw new Error("Generation aborted");
      }

      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        const token = delta.content;
        response += token;
        if (params.onProgress) {
          params.onProgress(token);
        }
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;

          if (!toolCalls[index]) {
            toolCalls[index] = { toolName: "", toolInput: {} };
          }

          if (toolCall.function?.name) {
            toolCalls[index].toolName = toolCall.function.name;
          }

          if (toolCall.function?.arguments) {
            const args = toolCalls[index].toolInput;
            try {
              toolCalls[index].toolInput = {
                ...args,
                ...(JSON.parse(toolCall.function.arguments) as Record<string, unknown>),
              };
            } catch {
              // Arguments may be partial, accumulate them
              const existingArgs = typeof args === "string" ? args : "{}";
              toolCalls[index].toolInput = existingArgs + toolCall.function.arguments as any;
            }
          }
        }
      }
    }

    // Match tool calls with actual tools
    const toolExecutions = toolCalls
      .filter((tc) => tc.toolName)
      .map((tc) => {
        const tool = params.tools?.find((t) => t.name === tc.toolName);
        if (!tool) return null;

        // Convert any string arguments to object
        let input = tc.toolInput;
        if (typeof input === "string") {
          try {
            input = JSON.parse(input);
          } catch {
            input = {};
          }
        }

        return {
          tool,
          input: input as Record<string, unknown>,
          result: { content: "" },
          durationMs: 0,
        };
      })
      .filter((tc): tc is NonNullable<typeof tc> => tc !== null);

    return {
      response,
      toolExecutions,
    };
  }
}
