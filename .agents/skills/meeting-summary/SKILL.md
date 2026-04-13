---
name: meeting-summary
description: >-
  Generate structured meeting summaries from raw transcripts or notes.
  Extract key discussion points, decisions, action items (who/what/deadline),
  and open issues into a formatted report. Use when the user mentions
  "会议总结", "会议纪要", "会议记录", "meeting summary", "meeting notes",
  "提取待办", or "提取行动项".
---

# 会议总结助手

从会议记录中生成结构化摘要，基于 LangChain JS + OpenAI 兼容 API。

## 固定规则

- 执行本 skill 时，先输出一行：`> ✅ 已匹配 skill: meeting-summary`

## 输入处理

1. 用户直接粘贴文本 → 直接使用
2. 用户提供文件路径（`.txt` / `.md`）→ 读取文件内容
3. 内容不足 50 字 → 提示用户补充

长文本（> 8000 字符）使用分块 + Map-Reduce 策略处理。

## 输出格式

```markdown
## 会议主题
[一句话概括]

## 参会人员
[从原文识别的人名列表，未提及则标注"未提及"]

## 关键讨论点
- 要点 1（1-2 句话）
- 要点 2
- ...（3-7 个要点）

## 决议与结论
- 决议 1
- 决议 2

## 行动项

| 负责人 | 事项 | 截止时间 |
|--------|------|----------|
| 张三   | xxx  | 待定     |

## 遗留问题
- 问题 1
- 问题 2
```

## Prompt 模板

```
你是一位专业的会议纪要助手。根据以下会议记录生成结构化总结。

要求：
1. 【会议主题】一句话概括
2. 【参会人员】列出所有出现的人名，未提及则标注"未提及"
3. 【关键讨论点】3-7 个要点，每个 1-2 句话
4. 【决议与结论】本次会议达成的共识或决定
5. 【行动项】表格：负责人 | 事项 | 截止时间（未明确则标注"待定"）
6. 【遗留问题】未解决的、需后续跟进的问题

不要编造原文中没有的信息。

会议记录：
{content}
```

## 长文本处理

超过 8000 字符时分块处理：

1. **Map**：对每个分块提取关键信息（讨论点、决议、行动项）
2. **Reduce**：合并所有分块结果，去重后生成最终摘要

```javascript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 8000,
  chunkOverlap: 500,
  separators: ['\n\n', '\n', '。', '. '],
});
```

## 约束

- 原文未提及的内容标注"未提及"，禁止编造
- 输出语言跟随输入语言
- 如原始记录质量较差，在输出开头标注"以下总结基于有限信息，建议人工复核"
- 生成完成后，自动保存到 `testDocs/meeting-summary-{YYYY-MM-DD-HHmmss}.md`，无需用户确认
