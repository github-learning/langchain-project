// import dotenv from "dotenv";
// dotenv.config();
import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { initChatModel } from 'langchain';
import { tool } from '@langchain/core/tools';
import { ToolMessage } from "@langchain/core/messages";
// import { SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, SystemMessage } from "langchain";
import { readFile } from 'node:fs/promises';
import fs from "node:fs/promises";
import { fileURLToPath } from 'node:url';
import {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  FewShotChatMessagePromptTemplate,
  FewShotPromptTemplate,
} from '@langchain/core/prompts';
import { z } from 'zod';
// console.log("cwd:", process.cwd());
// console.log('%c [process  ]-5', 'font-size:16px; background:pink; color:#bf2c9f;', process.env)




// 实例化模型
// const model = new ChatOpenAI({
//   model: process.env.MODEL_NAME,
//   apiKey: process.env.OPENAI_API_KEY,
//   configuration: {
//     baseURL: process.env.OPENAI_BASE_URL,
//   },
//   // streaming: true,
// });
// process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
// process.env.OPENAI_API_KEY = 'sk-your-key';
// 重点：当 model 名称不是 OpenAI 官方（例如 qwen-max-latest）时，initChatModel 无法自动推断提供商
// 所以必须显式指定 modelProvider（这里用 openai，表示“OpenAI-compatible 接口”）
const model = await initChatModel(process.env.MODEL_NAME, {
  modelProvider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL,
});

// const result = await model.invoke("说说你心目中的仓老师");
// console.log(result.content);
// const responses = await model.batch([
//   "Why do parrots have colorful feathers?",
//   "How do airplanes fly?",
//   "What is quantum computing?",
//   "Why do parrots have colorful feathers?",
//   "How do airplanes fly?",
//   "What is quantum computing?",
// ], {
//   maxConcurrency: 5,  // Limit to 5 parallel calls
// });
// for (const response of responses) {
//   console.log(response);
// }

// 对象格式
// const conversation = [
//   { role: "system", content: "You are a helpful assistant that translates English to French." },
//   { role: "user", content: "Translate: I love programming." },
//   { role: "assistant", content: "J'adore la programmation." },
//   { role: "user", content: "Translate: I love building applications." },
// ];

// const response = await model.invoke(conversation);
// console.log(response);  // AIMessage("J'adore créer des applications.")
// 消息对象
// const conversation = [
//   new SystemMessage("你是一个将中文翻译成英文的有用助手。"),
//   new HumanMessage("翻译：我喜欢仓老师做的视频。"),
// ];

// const response = await model.invoke("为什么鹦鹉有彩色的羽毛？");
// console.log(response);
// for await (const chunk of stream) {
//   // console.log('stream:', chunk);
//   console.log(chunk.contentBlocks)
// }
// const stream = await model.stream("为什么鹦鹉有彩色的羽毛？");
// for await (const chunk of stream) {
//   // chunk: AIMessageChunk（流式增量消息）
//   // chunk.contentBlocks: Array<ContentBlock.Standard>
//   //   这是 LangChain 把“原始 content（string 或各种 provider 格式）”懒解析成的标准 block 列表。
//   for (const block of chunk.contentBlocks) {
//     console.log('block:', block.type);
//     // block 是一个“可区分联合类型”，用 block.type 来做分支收窄（discriminated union narrowing）
//     if (block.type === "reasoning") {
//       // ContentBlock.Reasoning：模型的推理/思考片段（不是所有模型/提供商都会返回）
//       console.log(`Reasoning: ${block.reasoning}`);
//     } else if (block.type === "tool_call_chunk") {
//       // ContentBlock.Tools.ToolCallChunk：工具调用的“流式碎片”
//       // - 流式时参数会被拆成多段（args?: string），需要在更高层把 chunks 合并成完整 tool_call 才能执行工具
//       console.log(`Tool call chunk: ${block}`);
//     } else if (block.type === "text") {
//       // ContentBlock.Text：正常的文本输出片段（流式时会多次出现）
//       console.log(block.text);
//     } else {
//       // 其他可能的 block 类型（取决于模型/提供商/是否多模态/是否工具调用）：
//       // - "tool_call" / "invalid_tool_call" / "server_tool_call" / "server_tool_call_result" ...
//       // - "image" / "audio" / "video" / "file" / "text-plain"
//       // - "non_standard"（提供商特有的结构化块）
//     }
//   }
// }

// import { tool } from "langchain";
// import * as z from "zod";
// import { ChatOpenAI } from "@langchain/openai";

// const getWeather = tool(
//   (input) => `It's sunny in ${input.location}.`,
//   {
//     name: "get_weather",
//     description: "Get the weather at a location.",
//     schema: z.object({
//       location: z.string().describe("The location to get the weather for"),
//     }),
//   },
// );

// const model = new ChatOpenAI({ model: "gpt-4.1" });
// const modelWithTools = model.bindTools([getWeather]);  

// const response = await modelWithTools.invoke("What's the weather like in Boston?");
// const toolCalls = response.tool_calls || [];
// for (const tool_call of toolCalls) {
//   // View tool calls made by the model
//   console.log(`Tool: ${tool_call.name}`);
//   console.log(`Args: ${tool_call.args}`);
// }


// // Bind (potentially multiple) tools to the model
// const modelWithTools = model.bindTools([get_weather])

// // Step 1: Model generates tool calls
// const messages = [{"role": "user", "content": "What's the weather in Boston?"}]
// const ai_msg = await modelWithTools.invoke(messages)
// messages.push(ai_msg)

// // Step 2: Execute tools and collect results
// for (const tool_call of ai_msg.tool_calls) {
//     // Execute the tool with the generated arguments
//     const tool_result = await get_weather.invoke(tool_call)
//     messages.push(tool_result)
// }



// console.log(response);  // I like the videos made by Teacher Cang.
// const response = await model.invoke(conversation);
// ## 消息对象
// 



// # 对大模型进行调用
// 1. 直接调用
// const res = await llm.invoke("你好，你是谁？");
// console.log('res:', res.content);
// 2. 流式调用
// const res = await llm.stream("你好，你是谁？");
// for (const chunk of res) {
//    console.log('chunk:', chunk.content);
// }
// # 提示词模版
// 纯文本提示词模版
// 1. PromptTemplate:(字符串提示模版, 支持变量)
// 建立一个提示词模版, 将用户输入的{input}翻译成{output}
// 创建一个PromptTemplate实例
// 两种创建promptTemplate方式
// const template = PromptTemplate.fromTemplate("将{input}翻译成{output}"); // 它会 从字符串里自动解析/推断 变量名（看到 {input}、{output} 就推断出这两个变量）。

// // invoke
// const prompt = await template.invoke({ input: '你好', output: 'hello' });
// console.log('prompt:', prompt); // 将你好翻译成hello
// const prompt2 = await template.format({ input: '你好', output: 'hello' });
// console.log('prompt2:', prompt2); // 将你好翻译成hello
// const template = ChatPromptTemplate.fromMessages([
//   ["system", "你是一个{role}专家，擅长回答{topic}问题"],
//   ["human", "用户问题：{input}"],
// ]);
// const prompt = await template.formatPromptValue({ role: '编程', topic: '前端开发', input: '如何基于React开发一个TODO列表应用？' });
// // 输出生成的提示内容
// console.log('prompt-toString:', prompt.toString()); // 把内部的 messages 数组“序列化成可读文本”的结果，返回一个字符串
// console.log('prompt-toChatMessages:', prompt.toChatMessages()); // 返回一个消息数组



/**
 * FewShotPromptTemplate demo (JS version of your Python snippet).
 *
 * Run:
 *   node src/langchain-invoke.mjs --fewshot
 *
 * This does NOT call any model. It only prints the final formatted prompt string.
 */

  // 几个示例，说明模型该如何输出
  const examples = [
    { input: "北京下雨吗", output: "北京" },
    { input: "上海热吗", output: "上海" },
  ];

  // 定义如何格式化每个示例
  const examplePrompt = PromptTemplate.fromTemplate("输入：{input}\n输出：{output}");

  // 构建 FewShotPromptTemplate
  const fewShotPrompt = new FewShotPromptTemplate({
    examples,
    examplePrompt,
    prefix: "按提示的格式，输出内容", // 放在示例前面的提示模板字符串
    suffix: "输入：{input}\n输出：", // 放在示例后面的提示模板字符串，{input}是变量，会自动替换为输入的值
    inputVariables: ["input"], // 输入变量
  });

  // 生成最终的 prompt（string）
  const prompt = await fewShotPrompt.format({ input: "天津今天刮风吗" });
  console.log('prompt:', prompt);
  const res = await model.invoke(prompt);
  console.log('content:', res.content);

  // # tool调用
  // tools 本质是封装了特定功能的可调用模块，是Agent,chain，LLM 可以与时间互动的接口
  // 1. 创建工具函数
  // 2. 将工具函数转为 LangChain Tool 对象（用 tool() + zod schema）
  // 3. 将大模型和 Tool 对象绑定
  // 4. 调用大模型，让它尝试调用工具
  // 5. 只执行 1 次 tool call（不写循环），把结果回传给模型生成最终总结
  // 6. 如果模型没有调用工具，则返回模型生成的内容
  // 7. 如果模型调用了工具，则返回工具调用的结果
  // 8. 如果模型调用了工具，则返回工具调用的结果
  // 9. 如果模型调用了工具，则返回工具调用的结果

  // 定义工具函数（Zod Schema 是 Zod 库中的一个类，用于定义和验证数据的结构）
  const readFileTool = tool(
    async ({ filePath }) => {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    },
    {
      name: "read_file",
      description: "读取文件内容",
      schema: z.object({
        filePath: z.string().describe("要读取的文件路径"),
      }),
    }
  );
  // 工具，本质是一个函数 + schema 对象，但是他跟普通 函数不一样。 我们写的函数是什么，
  // 可能传统意义上，就是一个函数，但是tool 工具里的函数，需要对函数做说明，name, description, schema
  // 另外
  // 需要通过 tool() 函数转换成 LangChain Tool 对象。
  // 将工具函数转为 LangChain Tool 对象
  // const tool = tool(readFileTool);
  // 将大模型和 Tool 对象绑定
  const modelWithTools = model.bindTools([readFileTool]); //本质 把 Tool schema 注入到 LLM 的 tools 参数。告诉ai你有这些能力，让 AI 决定什么时候调用工具

  // 这里开始是“完整闭环”：
  // 1) 模型先决定要不要调用工具（tool_calls）
  // 2) 你执行工具拿到结果
  // 3) 把结果作为 ToolMessage 回传给模型
  // 4) 再调用一次模型，让它基于工具结果输出“解释代码”的最终回答
  const messages = [
    new SystemMessage("你是一个代码助手，可以使用工具读取文件并解释代码。"),
    new HumanMessage("请读取 src/langchain.mjs 文件内容并解释代码"),
  ];

  const response = await modelWithTools.invoke(messages);
  console.log("response:", response);
  // messages = 对话历史,不把聊天记录存起来，AI 下一次就不知道之前发生什么。
  messages.push(response);
  console.log('messages--------:', messages);

  const toolCalls = response.tool_calls ?? [];
  if (toolCalls.length === 0) {
    console.log("模型没有调用工具，直接返回模型生成的内容:", response.content);
  } else {
    console.log("模型调用了工具，tool_calls:", toolCalls);

    // 执行所有 tool calls（这里只有 read_file 一个工具，所以直接用 readFileTool）
    for (const toolCall of toolCalls) {
      // toolCall.args 就是模型生成的参数（这里 schema 需要 { filePath: string }）
      const toolResult = await readFileTool.invoke(toolCall.args);
      console.log('toolResult+++++:', toolResult);

      // 把工具执行结果回传给模型：tool_call_id 必须对应 toolCall.id
      messages.push(
        new ToolMessage({ // ToolMessage 工具返回的结果
          content: String(toolResult),
          tool_call_id: toolCall.id ?? "tool_call_id_missing", // 对应 AI 的工具调用
        })
      );
    }

    // 再调用一次模型，生成最终“解释代码”的回答
    const final = await modelWithTools.invoke(messages);
    console.log("final content:", final.content);
  }

  
  
// partial
// const partialPrompt = await template.partial({ input: '你好' });
// const prompt = await partialPrompt.format({ output: 'hello' });
// console.log('prompt:', prompt); // 将你好翻译成hello
// invoke() 是 LangChain Expression Language（LCEL 的统一执行入口，用于执行任意可运行对象（Runnable ）。返回的是一个 PromptValue 对象，可以用 .to_string() 或 .to_messages() 查看内容。

// console.log('template:', template);
// const prompt = await template.format({ input: '你好', output: 'hello' });
// console.log('prompt:', prompt); // 将你好翻译成hello
// const prompt = await template.invoke({ input: '你好', output: 'hello' });
// console.log('prompt:', prompt);

// 创建 PromptTemplate

// const promptA = PromptTemplate.fromTemplate("请用一句话介绍{topic}，要求通俗易懂\n");
// const promptB = PromptTemplate.fromTemplate("内容不超过{length}个字");
// const promptAll = PromptTemplate.fromTemplate(`${promptA.template}${promptB.template}`);

// const prompt2 = await promptAll.format({ topic: "LangChain", length: 20 });
// console.log('prompt2', prompt2);

// 填充实例中的变量，暂且使用fromatTemplate方法
// const prompt = await template.({ input: '你好', output: 'hello' });


// const template2 = PromptTemplate.fromTemplate("将{input}翻译成{output}"); // 它会 从字符串里自动解析/推断 变量名（看到 {input}、{output} 就推断出这两个变量）。
// const template2 = PromptTemplate.fromTemplate("请评价一下{input}的优缺点"); // 它会 从字符串里自动解析/推断 变量名（看到 {input}、{output} 就推断出这两个变量）。
// const prompt2 = await template2.format({ input: '你好', output: 'hello' }); // 参数是字典
// console.log('prompt2:', prompt2); // str 类型
// console.log('template:', template);
// const prompt = await template.format({ something: "天气" });
// console.log('prompt:', prompt);
// 直接调用模型
// 方式 A：用 invoke 填充变量（等价于 format），返回的是“字符串提示词”
// const filledPrompt = await template2.invoke({ input: '智能手机' }); // 参数时字典
// console.log('filledPrompt:', filledPrompt); // 返回值不一样：PromptValue 类型， 推荐
// // 流式输出：用 stream()，并用 for await...of 迭代增量 chunk
// const filledPromptStream = await llm.stream(filledPrompt);
// let full = '';
// for await (const chunk of filledPromptStream) {
//   const delta = chunk?.content ?? '';
//   full += delta;
//   process.stdout.write(String(delta));
// }
// process.stdout.write('\n');
// console.log('filledPromptData(full):', full);
// console.log('filledPrompt:', filledPrompt.value);

// 方式 B：填充后直接调用模型（推荐）
// const res = await template2.pipe(llm).invoke({ input: '你好', output: 'hello222' });
// console.log('res:', res.content);
// 流式调用
// const resStream = await llm.stream(prompt);
// for await (const chunk of resStream) {
//   console.log('chunk:', chunk.content);
// }

// 先创建一个提示词模版，然后把模版 + 变量 = 》 提示词 = 》 调用模型

// 聊天提示模版
// 关键点：要让 {role}/{topic}/{input} 生效，必须用“提示模板”(template)，不要用 new SystemMessage/new HumanMessage（那是固定消息，不会做变量替换）
// tuples 元组：一个有序的、长度固定的数组。
// 身份，角色，问题
// 提示词模版抽象化，复用
// const template = ChatPromptTemplate.fromMessages([
//   ["system", "你是一个{role}专家，擅长回答{topic}问题"],
//   ["human", "用户问题：{input}"],
// ]);
// console.dir(template, { depth: null });

// // 方式1：直接 invoke（推荐）
// const res = await template.pipe(llm).invoke({
//   role: "编程",
//   topic: "前端开发",
//   input: "如何基于React开发一个TODO列表应用？",
// });
// console.log('res:', res);

// 抽象提示词模版中的某一条消息=》对提示词和模版进行抽象化，复用
// 注意：不要用 ChatMessagePromptTemplate 去造 "human" role（会把 role="human" 原样发给 OpenAI，从而 400）
// 用 SystemMessagePromptTemplate/HumanMessagePromptTemplate 会正确映射到 OpenAI 的 system/user
// const systemMessageTemplate = SystemMessagePromptTemplate.fromTemplate(
//   '你是一个{role}专家，擅长回答{topic}问题'
// );
// const humanMessageTemplate =
//   HumanMessagePromptTemplate.fromTemplate('用户问题：{input}');

// 重新组装成一个 ChatPromptTemplate（等价于你上面的 tuples 写法）
// const template2 = ChatPromptTemplate.fromMessages([
//   systemMessageTemplate,
//   fewShotTemplate,
//   humanMessageTemplate,
// ]);

// const res2 = await template2.pipe(llm).invoke({
//   role: '编程',
//   topic: '前端开发',
//   input: '你擅长什么',
// });
// console.log('res2:', res2.content);

// ## FewShotPromptTemplate 少样本提示（字符串版，结构和你截图一样）


// Python 版 few-shot 示例（已转为 JS 版；见文件顶部 `--fewshot` demo）


// const examples = [
//   // 英 -> 中
//   { input: 'I love programming.', output: '我喜欢编程。' },
//   { input: 'What are you good at?', output: '你擅长什么？' },
//   // 中 -> 英
//   {
//     input: '特别的爱给特别的你。',
//     output: 'A special love for a special you.',
//   },
//   { input: '你今天感觉怎么样？', output: 'How are you feeling today?' },
// ];

// const examplePrompt = PromptTemplate.fromTemplate(
//   '输入: {input}\n输出: {output}'
// );

// const fewShotPrompt = new FewShotPromptTemplate({
//   examples,
//   examplePrompt,
//   prefix: 
//   '中英互译/只输出译文/不要解释/保持口语/不要添加标点',
//   // 你希望模型严格按规则做事（比如“中英互译/只输出译文/不要解释/保持口语/不要添加标点”等）
//   // 不要给模型“自由发挥”的空间，就告诉他“必须做什么”，不要让他自己揣摩“应该做什么”
//   suffix: '输入: {text}\n输出:', // 现在要你回答的这一条
//   inputVariables: ['text'],
// });

// // 生成最终 prompt（纯文本），再喂给 chat model（它会当作 user message 处理）
// const prompt = await fewShotPrompt.format({ text: '我晚点去的' });
// // const prompt = await fewShotPrompt.format({ text: '特别的爱给特别的你?' });
// const res3 = await llm.invoke(prompt);
// console.log('res3:', res3.content);

// // 链式调用大模型，把 “渲染 prompt” 和 “调用模型” 串成一个 Runnable chain，更短、更不容易把参数传错，也更方便继续往后 pipe（比如 .pipe(outputParser)、加重试/回调等）。
// const res4 = await fewShotPrompt
//   .pipe(llm)
//   .invoke({ text: '娃大点前到我的钱我打钱' });
// console.log('res4:', res4.content);

// # 绑定自定义工具

// demo：一个工具（读取当前文件内容）+ 一次总结
// 第一步：开发工具函数
// 第二步：将工具函数转为 LangChain Tool 对象（用 tool() + zod schema）
// const readCurrentFileTool = tool(
//   async ({ path, maxChars }) => {
//     const defaultPath = fileURLToPath(import.meta.url);
//     const targetPath = typeof path === 'string' && path.trim() ? path.trim() : defaultPath;
//     const limit =
//       typeof maxChars === 'number' && Number.isFinite(maxChars) ? Math.max(0, maxChars) : null;

//     try {
//       const text = await readFile(targetPath, 'utf8');
//       const truncated = typeof limit === "number" ? text.length > limit : false;
//       const body = typeof limit === "number" ? text.slice(0, limit) : text;
//       return (
//         `file: ${targetPath}\n` +
//         `chars: ${text.length}${truncated ? ` (truncated to ${limit})` : ''}\n` +
//         `---\n` +
//         body
//       );
//     } catch (e) {
//       return `read_current_file failed: ${e?.message ?? String(e)}`;
//     }
//   },
//   {
//     name: 'read_current_file',
//     description:
//       '读取指定文件的文本内容（默认读取当前脚本文件）。可传 path 和 maxChars 控制截断长度。',
//     schema: z.object({
//       path: z.string().optional().describe('要读取的文件路径（可选，默认当前脚本）'),
//       maxChars: z
//         .number()
//         .optional()
//         .describe('最多返回多少字符（可选；不传则不截断）'),
//     }),
//   }
// );

// // 第三步：将大模型和 Tool 对象绑定
// const modelWithTools = llm.bindTools([readCurrentFileTool]);

// // 第四步：调用大模型，让它尝试调用工具
// const toolCallMsg = await modelWithTools.invoke([
//   new SystemMessage(
//     '你可以调用工具来获取信息。请先读取当前文件内容，然后用 5 条要点总结这个文件里做了什么。'
//   ),
//   new HumanMessage('请读取并总结。'),
// ]);

// console.dir(toolCallMsg, { depth: null });

// // 第五步：只执行 1 次 tool call（不写循环），把结果回传给模型生成最终总结
// if (Array.isArray(toolCallMsg.tool_calls) && toolCallMsg.tool_calls.length > 0) {
//   const call = toolCallMsg.tool_calls[0];
//   const result = await readCurrentFileTool.invoke(call.args ?? {});
//   const toolMsg = new ToolMessage({
//     tool_call_id: call.id,
//     content: String(result),
//   });
//   const finalMsg = await llm.invoke([toolCallMsg, toolMsg]);
//   console.log('final summary:', finalMsg.content);
  
// } else {
//   console.log('model did not call read_current_file, content:', toolCallMsg.content);
// }


// 如果你只想看看 few-shot 生成的“示例消息”，不想真的调用模型，可以用：
// console.log(
//   'fewShotMessages:',
//   (await fewShotTemplate.formatMessages({})).map((m) => ({
//     type: m.getType?.() ?? m._getType?.() ?? m.constructor?.name,
//     content: m.content,
//   }))
// );

// const res = await template.invoke({ input: "你好，你是谁？", output: "Hello, who are you?" });
// console.log('res:', res.content);

// 2. ChatPromptTemplate
// const template = ChatPromptTemplate.fromMessages([
//   new SystemMessage("你是一个翻译专家，将用户输入的中文翻译成英文"),
//   new HumanMessage("{input}"),
// ]);
// const res = await template.invoke({ input: "你好，你是谁？" });
// console.log('res:', res.content);

// 示例1：直接调用模型
// const res = await model.invoke("你好，你是谁？");

// 示例2：使用系统消息和人类消息调用模型
// const res = await model.invoke([
//   new SystemMessage("你是翻译专家, 将用户输入的中文翻译成英文"),
//   new HumanMessage("你好，你是谁?"),
// ]);
// console.log('res:', llm);
// new SystemMessage("你是翻译专家, 将用户输入的英文翻译成中文"),

// const schema = z.object({
//   name: z.string().describe("人物名称"),
//   age: z.number().describe("人物年龄"),
//   description: z.string().describe("人物描述"),
// })

// const structuredModel = model.withStructuredOutput(schema);

//   const res = await structuredModel.invoke(
//     "生成一个随机人物信息，必须以 JSON 格式输出"
//   );
// const res = await structuredModel.invoke('介绍一个牛顿')
// const res = await structuredModel.invoke([
//   new SystemMessage(
//     "你是一个只输出 JSON 的助手。只返回一个 JSON 对象，不要任何解释，不要 Markdown，不要 ```json 代码块。"
//   ),
//   new HumanMessage('生成一个 水浒传 里的随机人物信息, 必须符合这个 JSON schema：{"name": string, "age": number, "description": string}'),
// ]);

// const getTimeTool = tool(
//     async () => {
//       return new Date().toISOString();
//     },
//     {
//       name: "get_time",
//       description: "获取当前时间",
//       schema: z.object({}),
//     }
//   );

//   const modelWithTools = model.bindTools([getTimeTool]);

//   const res2 = await modelWithTools.invoke(
//     "现在几点？"
//   );
// console.log(res2);

/**
 * pipe 的作用是把两个 Runnable 串起来形成一个“流水线”：
template：负责 把变量渲染成最终的 prompt/messages（它本身不产出答案，只产出“要喂给模型的输入”）
llm：负责 把 prompt/messages 生成成回答
所以你写：
template.pipe(llm).invoke(vars)
等价于：
const promptValue = await template.invoke(vars)（或 formatPromptValue/formatMessages）
const res = await llm.invoke(promptValue)
用 pipe 的好处是：少写两步、类型/输入输出更不容易弄错、后面还能继续串别的东西（比如 outputParser、tools、RunnableLambda）。
你也可以不 pipe，手写两步同样能跑；pipe 只是 LangChain 推荐的组合方式。
 * 
 */