# 数据验证与同步

## 数据格式验证

```python
def validate_import_data(
    data: List[Dict],
    kb_type: str
) -> ValidationResult:
    """验证导入数据的格式和内容"""

    required_fields = {
        "QualityStandard": ["title", "category", "check_items"],
        "MechanicalFault": ["fault_name", "root_cause"],
        "ElectricalFault": ["fault_code", "description"],
        "FabricParameter": ["fabric_type", "parameters"],
    }

    errors = []
    for idx, item in enumerate(data):
        for field in required_fields[kb_type]:
            if field not in item:
                errors.append(f"Row {idx}: Missing field '{field}'")

        if kb_type == "ElectricalFault":
            if not item.get("fault_code", "").startswith("E"):
                errors.append(f"Row {idx}: fault_code should start with 'E'")

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors
    )
```

## 数据同步

```python
# Neo4j 同步
async def sync_to_neo4j(
    kb_type: str,
    data: List[Dict]
) -> SyncResult:
    """同步数据到Neo4j图数据库"""
    # 1. 创建节点
    # 2. 创建关系
    # 3. 验证同步结果
    pass

# Milvus 同步
async def sync_to_milvus(
    kb_type: str,
    data: List[Dict]
) -> SyncResult:
    """同步数据到Milvus向量数据库"""
    # 1. 生成向量嵌入
    # 2. 插入向量
    # 3. 验证同步结果
    pass
```
