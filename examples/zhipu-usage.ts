/**
 * Zhipu AI (GLM) provider usage example
 */

import { createAgent } from "@megatronyy/agent-framework";
import { ZhipuProvider } from "@megatronyy/agent-framework/core/providers/ZhipuProvider";

// Example 1: Using ZhipuProvider directly
const agent = createAgent({
  id: "zhipu-agent",
  name: "Zhipu AI Assistant",
  model: {
    provider: "zhipu",
    model: "glm-4-flash", // or "glm-4", "glm-4-plus", etc.
    apiKey: process.env.ZHIPUAI_API_KEY || "your-zhipuai-api-key",
  },
  systemPrompt: "You are a helpful AI assistant powered by Zhipu AI.",
});

// Example 2: Using createTextAgent with zhipu provider
import { createTextAgent } from "@megatronyy/agent-framework";

const simpleAgent = createTextAgent({
  apiKey: process.env.ZHIPUAI_API_KEY || "your-zhipuai-api-key",
  provider: "zhipu",
  model: "glm-4-flash", // Default is "glm-4-flash"
  systemPrompt: "You are a helpful assistant.",
  skills: true,
});

// Example 3: Run the agent
async function main() {
  const result = await simpleAgent.run({
    message: "你好，请介绍一下智谱AI的GLM模型。",
    onProgress: (token) => process.stdout.write(token),
  });

  console.log("\n---");
  console.log("Response:", result.response);
}

// Available Zhipu AI models:
// - glm-4-flash: Fast, cost-effective model
// - glm-4: Standard model
// - glm-4-plus: Enhanced capabilities
// - glm-4-air: Lightweight model
// - glm-4-long: Long context model (128K tokens)
// - glm-4.7: Latest generation model
// - glm-5: Next-generation flagship model

export { agent, simpleAgent };
