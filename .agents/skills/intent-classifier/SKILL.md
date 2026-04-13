---
name: "intent-classifier"
description: "意图分类器 - 自动识别用户输入类型并分配给合适的角色处理。Invoke at the start of every conversation to classify user intent."
---

# Intent Classifier - 意图自动分类系统

## 分类目标

根据用户输入自动识别任务类型，并选择最合适的角色处理。

## 意图分类树

```
User Input
    │
    ├─► 问答类 (Q&A)
    │       ├─► 知识查询 → knowledge-base-manager
    │       ├─► 故障咨询 → knowledge-base-manager
    │       └─► 参数咨询 → knowledge-base-manager
    │
    ├─► 开发类 (Development)
    │       ├─► 功能开发 → developer (主导) + qa-engineer (验证)
    │       ├─► 代码修改 → developer (主导) + qa-engineer (验证)
    │       └─► 接口设计 → developer (主导) + product-manager (评审)
    │
    ├─► 测试类 (Testing)
    │       ├─► 功能测试 → qa-engineer (主导) + developer (修复)
    │       ├─► 问题诊断 → qa-engineer (主导) + developer (支持)
    │       └─► 性能测试 → qa-engineer (主导)
    │
    ├─► 规划类 (Planning)
    │       ├─► 方案设计 → product-manager (主导) + developer (评审) + qa (验证)
    │       ├─► 优化规划 → product-manager (主导) + 全团队
    │       └─► 迭代计划 → product-manager (主导)
    │
    └─► 管理类 (Management)
            ├─► 知识库管理 → knowledge-base-manager (主导)
            ├─► 数据导入 → knowledge-base-manager (主导) + developer (支持)
            └─► 团队协作 → task-orchestrator (协调)
```

## 关键词映射

### 问答类关键词
```yaml
qa_keywords:
  knowledge_query:
    - "是什么"
    - "什么是"
    - "哪个"
    - "哪些"
    - "在哪里"
    - "怎么用"

  parameter_query:
    - "参数"
    - "设置"
    - "多少"
    - "范围"
    - "标准"

  fault_query:
    - "问题"
    - "故障"
    - "报警"
    - "错误"
    - "怎么回事"

  solution_query:
    - "怎么解决"
    - "怎么处理"
    - "怎么调"
    - "如何解决"
```

### 开发类关键词
```yaml
dev_keywords:
  implementation:
    - "实现"
    - "开发"
    - "编写"
    - "创建"
    - "新增"

  modification:
    - "修改"
    - "更改"
    - "调整"
    - "优化"
    - "改进"

  design:
    - "设计"
    - "架构"
    - "方案"
    - "思路"
```

### 测试类关键词
```yaml
test_keywords:
  testing:
    - "测试"
    - "验证"
    - "检查"
    - "校验"

  debugging:
    - "调试"
    - "排查"
    - "诊断"
    - "问题"
    - "报错"
    - "失败"

  performance:
    - "性能"
    - "响应时间"
    - "并发"
    - "压力"
```

### 规划类关键词
```yaml
plan_keywords:
  design:
    - "设计"
    - "方案"
    - "规划"
    - "方案"

  optimization:
    - "优化"
    - "改进"
    - "提升"
    - "增强"

  iteration:
    - "迭代"
    - "版本"
    - "里程碑"
    - "计划"
```

### 管理类关键词
```yaml
manage_keywords:
  knowledge_base:
    - "知识库"
    - "导入"
    - "导出"
    - "更新"
    - "实体"
    - "关系"

  data:
    - "数据"
    - "数据导入"
    - "批量"
    - "同步"
```

## 优先级规则

### 规则1: 显式关键词优先
如果输入包含明确的角色关键词，直接分配给对应角色。
- 包含"代码"、"开发" → developer
- 包含"测试"、"验证" → qa-engineer
- 包含"知识库"、"导入" → knowledge-base-manager

### 规则2: 问题形式优先
如果输入是问句且简单，分配给 knowledge-base-manager

### 规则3: 多关键词时按顺序判断
1. 管理类 (knowledge_base) 最高优先
2. 开发类 (implementation)
3. 测试类 (testing)
4. 问答类 (Q&A) 最低

### 规则4: 组合检测
如果输入包含多个意图，分配给 task-orchestrator 进行多角色协调

## 分类决策表

| 输入关键词 | 置信度 | 分配角色 | 备注 |
|-----------|--------|----------|------|
| "张力合格范围" | 高 | kb-manager | 知识查询 |
| "跳针怎么调" | 高 | kb-manager | 故障咨询 |
| "E01报警" | 高 | kb-manager | 故障代码 |
| "实现xxx功能" | 高 | developer | 开发任务 |
| "测试xxx" | 高 | qa-engineer | 测试任务 |
| "优化准确率" | 高 | product-manager | 规划任务 |
| "导入知识库" | 高 | kb-manager | 管理任务 |
| "帮我看看这个问题" | 中 | qa-engineer | 问题诊断 |
| "设计一个方案" | 高 | product-manager | 设计任务 |
| 复杂多步骤请求 | 高 | orchestrator | 需要多角色 |

## 分类输出格式

```json
{
  "intent": "development",
  "confidence": 0.85,
  "roles": ["developer", "qa-engineer"],
  "reasoning": "输入包含'实现'和'功能'关键词",
  "suggested_action": "developer 主导实现，qa-engineer 验证"
}
```

## 置信度阈值

| 置信度 | 行动 |
|--------|------|
| >= 0.9 | 直接分配给对应角色 |
| 0.7-0.9 | 分配给对应角色，可能需要澄清 |
| 0.5-0.7 | 分配给 orchestrator 进行判断 |
| < 0.5 | 询问用户澄清 |

## 自我学习

### 反馈收集
每次分类后记录：
- 分类结果
- 用户反馈（是否满意）
- 后续角色是否调整

### 模式更新
基于反馈定期更新：
- 关键词权重
- 分类规则
- 角色映射

## 使用示例

### 示例1: "张力合格范围是多少？"
```
分类结果:
- intent: qa (知识查询)
- confidence: 0.95
- roles: [knowledge-base-manager]
- reasoning: 问句形式，包含"合格范围"知识类关键词
```

### 示例2: "帮我实现一个缓存机制"
```
分类结果:
- intent: development
- confidence: 0.90
- roles: [developer, qa-engineer]
- reasoning: 包含"实现"关键词，需要开发+测试
```

### 示例3: "系统响应慢，怎么优化？"
```
分类结果:
- intent: optimization
- confidence: 0.85
- roles: [product-manager, developer, qa-engineer]
- reasoning: 包含"优化"和性能问题，需要多角色协作
```

### 示例4: "导入一批新的质检标准"
```
分类结果:
- intent: management
- confidence: 0.95
- roles: [knowledge-base-manager]
- reasoning: 包含"导入"和"质检标准"关键词
```
