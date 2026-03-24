import { InMemoryVectorStore } from './dist/context/VectorStore.js';

async function test() {
  const store = new InMemoryVectorStore();
  
  await store.add([
    { id: "doc-1", content: "The weather is sunny today" },
    { id: "doc-2", content: "I like programming in TypeScript" },
    { id: "doc-3", content: "Weather forecasting is important" },
  ]);
  
  const results = await store.search("weather forecast");
  console.log("Results:", results.length);
  console.log(JSON.stringify(results, null, 2));
}

test().catch(console.error);
