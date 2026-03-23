/**
 * Tools Usage Example
 *
 * This example demonstrates how to create and use custom tools
 * with the agent framework.
 */

import { createAgent, builtinTools } from "@megatronyy/agent-framework";
import type { Tool } from "@megatronyy/agent-framework";

// Define a custom weather tool
const weatherTool: Tool = {
  name: "get_weather",
  description: "Get the current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city name, e.g., San Francisco, CA",
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature unit",
        default: "celsius",
      },
    },
    required: ["location"],
  },
  handler: async ({ input, context }) => {
    const location = input.location as string;
    const unit = input.unit as string || "celsius";

    // Simulate weather data
    const mockWeather = {
      "San Francisco, CA": { temp: 18, condition: "foggy" },
      "New York, NY": { temp: 22, condition: "sunny" },
      "London, UK": { temp: 15, condition: "rainy" },
      "Tokyo, Japan": { temp: 28, condition: "cloudy" },
    };

    const weather = mockWeather[
      Object.keys(mockWeather).find((key) =>
        location.toLowerCase().includes(key.toLowerCase().split(",")[0])
      ) || location
    ] || { temp: 20, condition: "unknown" };

    return {
      content: JSON.stringify({
        location,
        temperature: unit === "fahrenheit" ? Math.round(weather.temp * 9 / 5 + 32) : weather.temp,
        unit: unit === "fahrenheit" ? "°F" : "°C",
        condition: weather.condition,
      }),
    };
  },
};

// Define a search tool
const searchTool: Tool = {
  name: "search",
  description: "Search the web for information",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    required: ["query"],
  },
  handler: async ({ input }) => {
    // Mock search results
    return {
      content: JSON.stringify({
        results: [
          { title: "Example Result 1", url: "https://example.com/1", snippet: "This is a mock search result." },
          { title: "Example Result 2", url: "https://example.com/2", snippet: "Another mock result." },
        ],
        query: input.query,
      }),
    };
  },
};

async function main() {
  const agent = createAgent({
    id: "weather-agent",
    name: "Weather Assistant",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: "You are a helpful weather assistant. Use the get_weather tool to check current conditions.",
    tools: [...builtinTools, weatherTool, searchTool],
  });

  console.log("=== Weather Agent Demo ===\n");

  // Ask about weather
  const result = await agent.run({
    message: "What's the weather like in San Francisco?",
  });

  console.log("Response:", result.response);

  // Ask with tool call tracking
  console.log("\n=== Tracking Tool Calls ===\n");

  const result2 = await agent.run({
    message: "Compare the weather in New York and London",
    onToolCall: (toolName, input) => {
      console.log(`Tool called: ${toolName}`, input);
    },
  });

  console.log("Response:", result2.response);
}

main().catch(console.error);
