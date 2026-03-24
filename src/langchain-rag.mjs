/**
 * 1. 离线解析（知识库构建）： 把原始文档变成可检索的结构化内容。负责文档解析，chunk 切分，Embeddings 向量化, 向量入库。
 * 2. Query 理解 （查询预处理）：用户query 进来后，先读懂他，再决定怎么处理，包括意图识别，实体提取，query 改写/扩写。这是系统调度员
 * 3. 在线找回（检索与精排）根据处理后的query, 从知识库中找到最相关的文档片段。包括向量检索，BM25 关键词检索，混合检索融合，Rerank 惊排，这是搜索引擎
 * 4. 上下文生成（LLM回答)：把检索到的片段和用户的问题，一起喂给LLM，生成最终的回答，包括prompt 构建，幻觉压制，多伦会话衔接。只是系统面向用户的最终输出
 */

/**
 * pnpm install @langchain/core @langchain/openai @langchain/classic dotenv 
 */
import "dotenv/config";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

// 用户问题
//    ↓
// Embedding
//    ↓
// 向量检索（TopK）
//    ↓
// 拼接上下文
//    ↓
// LLM 生成答案


/**
 * 0. 初始化 LLM
 */
const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

/**
 * 1. 初始化 Embedding
 */
const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.EMBEDDINGS_MODEL_NAME,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL
    },
  });

/**
 * 2. 构建本地文档库
 */
const docs = [
  new Document({
    pageContent: "Vue 是一个用于构建用户界面的渐进式框架",
    metadata: { id: 1 },
  }),
  new Document({
    pageContent: "React 是一个用于构建 UI 的 JavaScript 库",
    metadata: { id: 2 },
  }),
  new Document({
    pageContent: "LangChain 是一个用于构建 LLM 应用的框架",
    metadata: { id: 3 },
  }),
  new Document({
    pageContent: "RAG 是通过检索外部知识增强大模型回答能力的方法",
    metadata: { id: 4 },
  }),
];

/**
 * 3. 构建向量库（内存版）
 */
const vectorStore = await MemoryVectorStore.fromDocuments(
  docs,
  embeddings
);

/**
 * 4. 用户问题
 */
const query = "什么是前端框架？";

/**
 * 5. 相似度检索（Top3）
 * 内部自动做 query 的 Embedding 向量化
 */
const results = await vectorStore.similaritySearchWithScore(query, 3);

/**
 * 6. 打印 Top3 文档 + 相似度
 */
console.log("===== Top 3 相似文档 =====");
results.forEach(([doc, score], index) => {
  console.log(`\n#${index + 1}`);
  console.log("内容:", doc.pageContent);
  console.log("相似度:", score);
});

/**
 * 7. 构造上下文
 */
const context = results
  .map(([doc], index) => `【文档${index + 1}】${doc.pageContent}`)
  .join("\n");

console.log("===== 上下文 =====");
console.log(context);

/**
 * 8. 构造 Prompt
 */
const prompt = `
你是一个专业 AI 助手，请基于以下知识回答问题：

${context}

用户问题：${query}

要求：
- 只基于提供的文档回答
- 回答简洁清晰
`;

/**
 * 9. 调用 LLM
 */

const response = await model.invoke(prompt);

/**
 * 10. 输出最终答案
 */
console.log("\n===== AI 回答 =====");
console.log(response.content);