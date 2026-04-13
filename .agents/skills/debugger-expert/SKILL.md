---
name: "debugger-expert"
description: "Bug排查与修复专家，基于错误日志、异常堆栈、复现步骤快速定位根因，给出可落地的修复方案。当用户提到bug修复、排查问题、报错、异常、崩溃、无法运行等场景时使用。"
---

# Debugger Expert - Bug排查与修复专家技能

## 语言规范

- **交流与思考**：与用户交流、思考分析过程、解释方案时**必须使用中文**
- **问题分析**：中文描述根因分析过程和修复逻辑
- **修复说明**：中文说明修复原因和预防措施

## 触发场景

- 用户提到「bug 修复」「排查问题」「报错」「异常」「崩溃」「无法运行」等关键词
- 提供错误日志、异常堆栈时

## 核心排查流程

```
信息收集 → 上下文理解 → 根因定位 → 修复方案 → 验证预防
    ↓          ↓           ↓          ↓          ↓
  错误日志    业务场景     定位代码     具体代码    测试验证
```

## 步骤1: 信息收集与上下文理解

### 必须收集的信息

- **错误日志**：完整的错误信息
- **异常堆栈**：从顶层到底层的完整调用链
- **复现步骤**：触发 bug 的具体操作
- **相关代码**：涉及的文件和代码片段
- **环境信息**：Python 版本、依赖版本、操作系统

### 区分 bug 类型

| 类型 | 特征 | 排查难度 |
|------|------|----------|
| **必现 bug** | 每次操作都触发 | 相对简单 |
| **偶现 bug** | 间歇性出现 | 复杂，需要收集更多上下文 |
| **性能 bug** | 响应慢/资源占用高 | 需要性能分析工具 |
| **并发 bug** | 多线程/异步场景下出现 | 需要锁分析 |

## 步骤2: 根因定位

### 定位方法

1. **从异常堆栈顶层开始**：第一行通常是直接出错的位置
2. **逐层分析调用链**：找出是哪一行代码实际出错
3. **分析变量状态**：检查出错时变量的值是否合理
4. **排除干扰信息**：忽略不重要的中间调用

### 常见根因分类

| 类别 | 常见原因 | 典型特征 |
|------|----------|----------|
| **逻辑错误** | 条件判断错误、边界遗漏 | 功能不正确但无异常 |
| **边界条件** | 空值、未初始化、数组越界 | IndexError, NoneType |
| **类型错误** | 类型不匹配、强制转换失败 | TypeError |
| **并发问题** | 竞态条件、锁顺序错误 | 偶现、不稳定 |
| **环境问题** | 依赖版本、路径问题 | ImportError, FileNotFoundError |
| **资源问题** | 内存泄漏、连接池耗尽 | 逐渐变慢最终崩溃 |

### 定位示例

```
Traceback (most recent call last):
  File "/app/services/ontology_next/retriever.py", line 87, in retrieve
    results = await hybrid_search(query, top_k)
  File "/app/services/ontology_next/retriever.py", line 45, in hybrid_search
    embedding = await generate_embedding(text)
  File "/app/services/llm/openai_client.py", line 30, in generate_embedding
    response = await client.embeddings.create(
  File "/Users/xxx/.venv/lib/python3.11/site-packages/openai/resources/embeddings.py", line 178, in create
    raise error
openai.AuthenticationError: Incorrect API key provided
```

**分析**：
- 顶层：`retriever.py:87` 调用 `hybrid_search`
- 中间层：`hybrid_search` 调用 `generate_embedding`
- 实际错误：`Incorrect API key provided` - API 密钥配置错误

## 步骤3: 修复方案设计与实现

### 设计原则

1. **最小侵入**：只修改必要的代码，不改变核心业务逻辑
2. **处理根因**：修复问题的根本原因，而非表面症状
3. **防止回归**：添加测试用例防止相同 bug 再次出现

### 修复代码模板

```python
# 修复前（有问题）
def retrieve(self, query: str):
    results = self.hybrid_search(query)  # 可能返回 None
    return results["items"]  # 如果 results 是 None 会报错

# 修复后
def retrieve(self, query: str):
    results = self.hybrid_search(query)
    if results is None:
        logger.warning(f"检索结果为空, query={query}")
        return []
    return results.get("items", [])
```

### 多方案选择

如果有多个修复方案：

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 方案A | 简单直接 | 可能有副作用 | 紧急修复 |
| 方案B | 更健壮 | 改动较大 | 长期方案 |

## 步骤4: 验证与预防

### 验证步骤

1. **复现验证**：用相同步骤确认 bug 已修复
2. **影响验证**：确认修复不破坏其他功能
3. **边界验证**：测试边界条件是否正确处理

### 补充测试用例

```python
def test_retrieve_with_empty_results(self):
    """验证检索结果为空时的处理"""
    mock_search.return_value = None
    result = retriever.retrieve("test query")
    assert result == []
    mock_logger.warning.assert_called_once()
```

### 预防同类bug

| 预防措施 | 说明 |
|----------|------|
| 类型注解 | 使用 TypeHint 避免类型错误 |
| 空值检查 | 对外部返回值做空检查 |
| 日志记录 | 关键节点添加日志便于排查 |
| 单元测试 | 覆盖边界条件和异常场景 |

## Bug 修复报告模板

```markdown
# Bug 修复报告

## 基本信息
- **Bug ID**: BUG-XXX
- **发现时间**: YYYY-MM-DD
- **发现人**: [姓名]
- **优先级**: P0/P1/P2/P3

## 问题描述
[Bug 的清晰描述]

## 复现步骤
1. [步骤1]
2. [步骤2]
3. [步骤3]

## 根因分析
[分析问题产生的根本原因]

## 修复方案
[具体修复方法]

### 修复代码
```python
# 修复代码
```

## 验证结果
- [ ] 复现步骤已验证通过
- [ ] 边界条件测试通过
- [ ] 回归测试通过

## 预防措施
[如何防止同类 bug 再次发生]
```

## 禁忌

- **不猜测根因**：必须基于实际错误信息和代码分析
- **不盲目修复**：只修复与 bug 直接相关的代码
- **不忽略测试**：修复后必须验证，不能只靠"感觉好了"
