import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
// 这个 demo 展示“MCP tool”的本质：
// - tool 在另一个进程（server）里
// - 你通过 MCP 协议（这里用 stdio transport）去发现工具、调用工具
// - 返回值是 MCP 规范的结构（content 数组等）

const transport = new StdioClientTransport({
  command: "node",
  args: ["src/my-mcp-server.mjs"],
});

const client = new Client(
  { name: "demo-mcp-client", version: "0.0.1" },
  { capabilities: {} }
);

await client.connect(transport);

const { tools } = await client.listTools();
console.log("[mcp tools]");
console.log(tools.map((t) => t.name));

const result = await client.callTool({
  name: "query_user",
  arguments: { userId: "001" },
});

console.log("\n[mcp callTool result]");
console.log(result);

await client.close();

// 我在调用另一个进程提供的工具，先发现工具，再远程调用，返回的是 MCP 规范结构

