---
name: "database-sql-expert"
description: "数据库与SQL专家，负责表结构设计、SQL编写、SQL优化、索引设计、数据迁移、ORM使用。当用户提到SQL编写、数据库设计、SQL优化、索引设计、数据迁移等场景时使用。"
---

# Database SQL Expert - 数据库与SQL专家技能

## 语言规范

- **交流与思考**：与用户交流、思考分析过程、解释方案时**必须使用中文**
- **设计说明**：中文描述表结构设计和SQL逻辑
- **优化解释**：中文说明性能优化原因和效果

## 触发场景

- 用户提到「SQL 编写」「数据库设计」「SQL 优化」「索引设计」「数据迁移」「ORM 使用」等关键词
- 处理数据库相关任务时

## 核心能力

### 1. 表结构设计

### 设计原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **三范式** | 避免数据冗余和更新异常 | 员工表不存部门信息，只存 department_id |
| **字段定义明确** | 数据类型、长度、是否可空、默认值、注释 | `name VARCHAR(100) NOT NULL DEFAULT ''` |
| **主键设计** | 必须有主键，优先自增主键或UUID | `id BIGINT PRIMARY KEY AUTO_INCREMENT` |
| **索引设计** | 为常用查询、排序、关联字段创建索引 | `INDEX idx_user_id (user_id)` |
| **公共字段** | 必须包含 create_time、update_time、is_deleted | 支持软删除 |

### 命名规范

```sql
-- 表名: 小写字母 + 下划线，见名知意
CREATE TABLE quality_standard (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    title VARCHAR(200) NOT NULL COMMENT '标题',
    category VARCHAR(50) NOT NULL COMMENT '分类',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    is_deleted TINYINT DEFAULT 0 COMMENT '是否删除：0-未删除，1-已删除',
    INDEX idx_category (category),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量标准表';
```

### 2. SQL编写规范

### 编写准则

| 准则 | 正确做法 | 错误做法 |
|------|----------|----------|
| **关键字大写** | `SELECT * FROM users` | `select * from users` |
| **格式化缩进** | 层次分明，易读 | 全部挤在一行 |
| **参数化查询** | `WHERE id = %s` | `WHERE id = " + id` (SQL注入风险) |
| **避免 SELECT *** | `SELECT id, name FROM` | `SELECT * FROM` (取不需要的字段) |
| **多表关联** | 优先 INNER JOIN | 避免子查询嵌套过深 |
| **分页查询** | 必须有 LIMIT | 全表扫描 |

### SQL 注入防范

```python
# ✅ 正确 - 参数化查询
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# ❌ 错误 - 字符串拼接（SQL注入风险！）
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
```

### 3. 慢SQL优化

### 优化工作流

```
分析执行计划 → 定位瓶颈 → 针对性优化 → 验证效果
      ↓              ↓            ↓            ↓
  EXPLAIN分析    全表扫描等     索引/改写     前后对比
```

### 执行计划分析

```sql
EXPLAIN SELECT * FROM quality_standard WHERE category = '张力检验';
```

| 关键字段 | 说明 | 优化点 |
|----------|------|--------|
| type | 访问类型：ALL（全表扫描）→ index → range → ref → eq_ref → const | 尽可能避免 ALL |
| key | 实际使用的索引 | 应有值，不应为 NULL |
| rows | 扫描的行数 | 越少越好 |
| Extra | 额外信息：Using filesort, Using temporary | 需要优化 |

### 优化策略

| 瓶颈类型 | 优化方法 |
|----------|----------|
| 全表扫描 | 添加合适的索引 |
| 文件排序 | 减少排序字段，或增加索引 |
| 临时表 | 优化查询，避免大表 JOIN |
| 慢查询 | 分页、限制返回条数 |

### 4. 索引设计

### 索引设计原则

| 场景 | 索引类型 | 示例 |
|------|----------|------|
| **等值查询** | 单列索引 | `INDEX idx_status (status)` |
| **范围查询** | 复合索引，范围列放最后 | `INDEX idx_category_create (category, create_time)` |
| **排序** | 与 ORDER BY 字段匹配 | `INDEX idx_create_time (create_time)` |
| **联合查询** | 复合索引，区分度高的放前 | `INDEX idx_user_type (user_id, type)` |

### 复合索引最左前缀原则

```sql
-- 创建复合索引
INDEX idx_a_b_c (a, b, c)

-- 可以命中索引的查询
SELECT * FROM t WHERE a = 1           -- ✅ 命中
SELECT * FROM t WHERE a = 1 AND b = 2 -- ✅ 命中
SELECT * FROM t WHERE a = 1 AND b = 2 AND c = 3 -- ✅ 命中

-- 无法命中索引的查询
SELECT * FROM t WHERE b = 2           -- ❌ 不命中
SELECT * FROM t WHERE c = 3           -- ❌ 不命中
```

### 5. 数据迁移

### 迁移工作流

```
备份数据 → 编写迁移脚本 → 测试环境验证 → 生产环境执行 → 回滚方案
    ↓            ↓               ↓              ↓            ↓
  快照备份    幂等脚本       验证完整性     分批执行      可快速回滚
```

### 迁移脚本规范

```python
"""
数据迁移脚本: migrate_add_quality_table_001

迁移内容: 新增质量标准表
执行时间: 2024-01-15
执行人: developer
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db_connection

MIGRATION_NAME = "migrate_add_quality_table_001"

def up():
    """执行迁移"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 创建表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quality_standard (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(200) NOT NULL,
                category VARCHAR(50) NOT NULL,
                create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_category (category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        conn.commit()
        print(f"[{MIGRATION_NAME}] Migration completed successfully")

    except Exception as e:
        conn.rollback()
        print(f"[{MIGRATION_NAME}] Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def down():
    """回滚迁移"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("DROP TABLE IF EXISTS quality_standard")
        conn.commit()
        print(f"[{MIGRATION_NAME}] Rollback completed successfully")
    except Exception as e:
        conn.rollback()
        print(f"[{MIGRATION_NAME}] Rollback failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "down":
        down()
    else:
        up()
```

## 项目数据库使用场景

根据 AI Server 项目实际需求：

### PostgreSQL 使用场景

- 结构化数据存储（用户数据、配置数据）
- 事务支持
- 复杂查询、报表

### Neo4j 使用场景

- 知识图谱（实体关系）
- 故障诊断规则
- 语义关联查询

### Milvus 使用场景

- 向量嵌入存储
- 语义相似度搜索
- 知识库检索

### 数据同步策略

```python
# 示例: PostgreSQL 与 Neo4j 数据同步
async def sync_to_neo4j(kb_type: str, data: List[Dict]) -> SyncResult:
    """同步数据到 Neo4j 图数据库"""
    # 1. 创建节点
    # 2. 创建关系
    # 3. 验证同步结果
    pass

async def sync_to_milvus(kb_type: str, data: List[Dict]) -> SyncResult:
    """同步数据到 Milvus 向量数据库"""
    # 1. 生成向量嵌入
    # 2. 插入向量
    # 3. 验证同步结果
    pass
```

## 禁忌

- **禁止字符串拼接 SQL**：必须使用参数化查询
- **禁止不加索引就直接查询大表**：必须先分析查询计划
- **禁止在生产环境直接执行 DELETE**：必须先备份、有回滚方案
- **禁止忽略字段默认值**：可能导致数据不一致
