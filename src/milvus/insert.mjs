import "dotenv/config";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION_NAME = "demo";
const VECTOR_DIM = 1024;

// 1. Embedding
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

// 2. Milvus 连接
const client = new MilvusClient({
  address: "localhost:19530",
});

// 3. 获取向量
const getVector = (text) => embeddings.embedQuery(text);

async function main() {
  await client.connectPromise;

  // 4. 创建集合
  await client.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: "id",
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      {
        name: "vector",
        data_type: DataType.FloatVector,
        dim: VECTOR_DIM,
      },
      {
        name: "text",
        data_type: DataType.VarChar,
        max_length: 1000,
      },
    ],
  });

  // 5. 插入数据
  const texts = [
    "Milvus 是向量数据库",
    "LangChain 用来开发 AI 应用",
    "RAG 是检索增强生成",
  ];

  const data = await Promise.all(
    texts.map(async (text) => ({
      vector: await getVector(text),
      text,
    }))
  );

  await client.insert({
    collection_name: COLLECTION_NAME,
    data,
  });

  // 6. 加载集合（必须）
  await client.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  // 7. 搜索
  const query = "什么是向量数据库";
  const queryVector = await getVector(query);

  const res = await client.search({
    collection_name: COLLECTION_NAME,
    vector: queryVector,
    limit: 2,
    output_fields: ["text"],
  });

  console.log("\n🔍 搜索结果：");
  console.log(res.results);
}

main();