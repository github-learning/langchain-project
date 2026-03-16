import { ChatOpenAI } from "@langchain/openai";
export const createChatModel = new ChatOpenAI({ 
  modelName: process.env.MODEL_NAME || "qwen-coder-turbo",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
  },
});