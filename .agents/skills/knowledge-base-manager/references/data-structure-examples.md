# 数据结构示例

## QualityStandard
```json
{
  "title": "线迹张力检验标准",
  "category": "线迹检验",
  "sub_category": "张力检验",
  "check_items": [
    {
      "item": "张力均匀性",
      "standard": "无明显松弛或过紧",
      "acceptable_range": "3-5刻度"
    }
  ],
  "tags": ["张力", "线迹", "检验"],
  "related_faults": ["跳针", "断线"]
}
```

## MechanicalFault
```json
{
  "fault_name": "跳针",
  "category": "线迹问题",
  "keywords": ["跳针", "跳线"],
  "root_cause": ["张力过紧", "针弯曲", "针与旋钩不同步"],
  "solution": "检查并调节张力..."
}
```
