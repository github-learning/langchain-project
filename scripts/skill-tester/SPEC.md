# Skill 测试规范

本文档定义了 Skill 测试框架的检测标准，分为**静态检查**和**动态测试**两部分。

## 一、静态检查（11 项）

不调用 LLM，纯分析 SKILL.md 文件内容。

### 1. YAML Frontmatter

- **规则**：必须存在 `---` 包裹的 YAML 元数据块
- **依据**：Codex 官方规范 — 每个 SKILL.md 必须有 frontmatter
- **等级**：❌ 失败（缺失则后续检查全部跳过）

### 2. name 字段

- **规则**：必须存在，≤64 字符，只含小写字母、数字和连字符（`[a-z0-9-]`）
- **依据**：Cursor Create Skill 规范 — `name: max 64 chars, lowercase letters/numbers/hyphens only`
- **等级**：❌ 失败

### 3. description 长度

- **规则**：必须存在，≤1024 字符
- **依据**：Cursor Create Skill 规范 — `description: max 1024 chars, non-empty`
- **等级**：❌ 失败

### 4. description 触发词（WHEN）

- **规则**：应包含触发场景描述，如 `Use when...`、`用户提到...时触发`、`当...时`
- **依据**：Codex 官方规范 — description 是 Agent 判断是否触发 skill 的唯一依据，必须包含 WHEN
- **等级**：⚠️ 警告

### 5. description WHAT+WHEN

- **规则**：同时包含功能描述（做什么）和触发条件（什么时候用）
- **依据**：Codex 官方规范 — Include both what the Skill does and specific triggers/contexts for when to use it
- **等级**：✅ 通过（两者都有时额外显示）

### 6. Body 行数

- **规则**：≤500 行（400-500 行警告，>500 行失败）
- **依据**：Codex 官方规范 — Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat
- **等级**：❌ >500 失败 / ⚠️ >400 警告

### 7. Token 预估

- **规则**：粗略估算 body 的 token 消耗（中文 ~1.5 token/字，其他 ~0.4 token/字符），>4000 警告
- **依据**：Codex 官方原则 — "The context window is a public good"，skill body 应尽量精简
- **等级**：⚠️ 警告

### 8. Markdown 结构

- **规则**：应使用 `##` 标题组织内容
- **依据**：最佳实践 — 结构化内容提高 Agent 理解准确性和执行一致性
- **等级**：⚠️ 警告（无标题时）

### 9. 约束/规则章节

- **规则**：body 中应包含「约束」「规则」「constraint」「rule」「注意」等关键词
- **依据**：最佳实践 — 没有约束 = Agent 自由发挥 = 不可控。明确的约束是行为边界的保障
- **等级**：⚠️ 警告

### 10. 输出格式定义

- **规则**：body 中应包含「输出格式」「output format」「模板」「template」等关键词
- **依据**：最佳实践 — 输出模板是跨模型一致性的核心保障，没有模板则不同模型输出结构可能完全不同
- **等级**：⚠️ 警告

### 11. 命名一致性

- **规则**：文件夹名应与 `name` 字段一致
- **依据**：Codex 官方建议 — Name the skill folder exactly after the skill name
- **等级**：⚠️ 警告（不影响触发，但影响可维护性）

---

## 二、动态测试（7 个验证器）

调用 LLM 模拟 skill 执行，验证输出是否符合 SKILL.md 中定义的规则。

需要在 skill 目录下创建 `tests.json` 文件定义测试用例。

### 测试用例格式

```json
{
  "model": "gpt-4o",
  "cases": [
    {
      "name": "测试名称",
      "input": "直接文本内容",
      "inputFile": "相对于项目根目录的文件路径",
      "prompt": "自定义用户指令（可选）",
      "expect": {
        "reject": true,
        "sections": ["章节名1", "章节名2"],
        "minSections": 6,
        "hasTable": true,
        "language": "zh",
        "contains": ["必须包含的文本"],
        "notContains": ["不能包含的文本"],
        "maxLength": 2000
      }
    }
  ]
}
```

### 验证器说明

| 验证器 | 字段 | 检查内容 | 用途 |
|--------|------|----------|------|
| **拒绝检测** | `reject: true/false` | 应拒绝时是否拒绝（输出短且包含拒绝信号词） | 验证边界处理能力 |
| **章节存在** | `sections: [...]` | 输出是否包含指定的 `##` 章节标题 | 验证格式一致性 |
| **最少章节数** | `minSections: N` | `##` 章节数量是否 ≥ N | 验证结构完整性 |
| **表格存在** | `hasTable: true` | 是否包含 Markdown 表格（`|` 分隔 + 分隔线） | 验证格式准确性 |
| **语言检测** | `language: "zh"/"en"` | 输出语言是否匹配（基于中文字符占比判断） | 验证多语言能力 |
| **包含文本** | `contains: [...]` | 输出是否包含指定文本 | 验证约束遵守度 |
| **排除文本** | `notContains: [...]` | 输出是否不包含指定文本 | 验证约束遵守度 |
| **长度上限** | `maxLength: N` | 输出字符数是否 ≤ N | 验证输出可控性 |

---

## 三、规范来源

### 官方规范

1. **Codex Skill Creator**（`~/.codex/skills/.system/skill-creator/SKILL.md`）
   - Frontmatter 必须有 `name` 和 `description`
   - `description` 是触发机制，body 触发后才加载
   - Concise is Key — 上下文窗口是公共资源
   - ≤500 行，超过应拆分到 references
   - Progressive Disclosure（渐进式披露）

2. **Cursor Create Skill**（`~/.cursor/skills-cursor/create-skill/SKILL.md`）
   - `name`：max 64 chars, lowercase + hyphens
   - `description`：max 1024 chars, 第三人称, WHAT + WHEN
   - 反模式：模糊命名、时效信息、术语不一致

### 最佳实践补充

| 实践 | 理由 |
|------|------|
| 约束章节 | 没有约束 = Agent 自由发挥 = 不可控 |
| 输出格式/模板 | 跨模型一致性的核心保障 |
| Token 预估 <4000 | 多 skill 共存时避免挤占上下文 |
| 固定规则提示 | 如 `> ✅ 已匹配 skill: xxx`，便于调试观察 |

---

## 四、使用方式

```bash
# 测试单个 skill（静态）
node scripts/skill-tester/index.mjs <skill-name> --static

# 测试单个 skill（静态 + 动态）
node scripts/skill-tester/index.mjs <skill-name>

# 测试所有 skill（静态）
node scripts/skill-tester/index.mjs --all --static

# 指定模型
node scripts/skill-tester/index.mjs <skill-name> --model=deepseek-chat

# 查看帮助
node scripts/skill-tester/index.mjs
```
