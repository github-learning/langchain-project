import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 这个 demo 展示“LangChain 本地 tool”的本质：就是你进程里的一个 JS 函数。
// 没有网络、没有协议、没有 server/client —— 直接 invoke() 就执行了。

const database = {
  users: {
    "001": { id: "001", name: "张三", email: "zhangsan@example.com", role: "admin" },
    "002": { id: "002", name: "李四", email: "lisi@example.com", role: "user" },
    "003": { id: "003", name: "王五", email: "wangwu@example.com", role: "user" },
  },
};

const queryUserLocalTool = tool(
  async ({ userId }) => {
    const user = database.users[userId];
    if (!user) return { ok: false, error: `用户 ${userId} 不存在` };
    return { ok: true, user };
  },
  {
    name: "query_user_local",
    description: "（本地 tool）查询内存 database.users",
    schema: z.object({
      userId: z.string().describe("用户 ID，例如 001/002/003"),
    }),
  }
);

const result = await queryUserLocalTool.invoke({ userId: "001" });
console.log("[local tool result]");
console.log(result);
// 你运行它的感受会是：“就是函数返回了一个对象”。

