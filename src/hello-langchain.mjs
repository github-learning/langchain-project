// import dotenv from'dotenv';
import 'dotenv/config';
//import 'dotenv/config'：启动时自动读取 .env 并把变量注入 process.env（默认从“当前运行命令的工作目录”找 .env）。
import { ChatOpenAI } from'@langchain/openai';

// dotenv.config();

const model = new ChatOpenAI({ 
    modelName: process.env.MODEL_NAME || "qwen-coder-turbo",
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

const response = await model.invoke("介绍下自己");
console.log(response.content);