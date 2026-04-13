# 环境配置与健康检查

## 开发环境 vs 生产环境

```python
# config/settings.py
import os
from typing import Literal

ENV = os.getenv("ENV", "development")

class Settings:
    def __init__(self, env: Literal["development", "staging", "production"]):
        self.env = env

    @property
    def database_url(self) -> str:
        if self.env == "production":
            return os.getenv("DATABASE_URL_PROD")
        return os.getenv("DATABASE_URL_DEV", "sqlite:///dev.db")

    @property
    def log_level(self) -> str:
        if self.env == "production":
            return "WARNING"
        return "DEBUG"

    @property
    def debug(self) -> bool:
        return self.env != "production"

settings = Settings(ENV)
```

## 健康检查接口

```python
# app/api/health.py
from fastapi import APIRouter, status

router = APIRouter()

@router.get("/health")
async def health():
    """存活探针 - K8s livenessProbe"""
    return {"status": "healthy"}

@router.get("/ready")
async def ready():
    """就绪探针 - K8s readinessProbe"""
    # 检查数据库连接
    # 检查依赖服务
    return {"status": "ready"}
```
