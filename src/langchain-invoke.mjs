// import dotenv from "dotenv";
// dotenv.config();
import 'dotenv/config';
import { initChatModel } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
// const model = new ChatOpenAI({
//   model: process.env.MODEL_NAME,
//   apiKey: process.env.OPENAI_API_KEY,
//   configuration: {
//     baseURL: process.env.OPENAI_BASE_URL,
//   },
// });


const model = await initChatModel(process.env.MODEL_NAME, {
  modelProvider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL,
});
// invoke
const result = await model.invoke("帮我生成一个比亚迪商品标题");
console.log(result);
// stream
const stream = await model.stream("帮我生成一个比亚迪商品标题"); 
for await (const chunk of stream) { 
    // console.log('stream:', chunk);
    // console.log(chunk.text) 
    console.log(chunk.content) 
}
