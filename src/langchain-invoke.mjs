// import dotenv from "dotenv";
// dotenv.config();
import 'dotenv/config';
import { initChatModel } from 'langchain';

const model = await initChatModel(process.env.MODEL_NAME, {
  modelProvider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL,
});

const result = await model.invoke("为什么鹦鹉有彩色的羽毛？");
console.log(result);