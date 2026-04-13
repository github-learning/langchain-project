# Dockerfile 与 .dockerignore 模板

## 最佳实践原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **多阶段构建** | 分离构建环境和运行环境 | 使用 `python:3.11-slim` 而非 `python:3.11` |
| **最小化镜像** | 优先使用 alpine/slim 精简镜像 | `FROM python:3.11-slim` |
| **固定版本** | 禁止使用 latest 标签 | `python:3.11.9` 而非 `python:latest` |
| **安全用户** | 使用非 root 用户运行应用 | `USER app` |
| **缓存优化** | 不变依赖放前，代码变更放后 | requirements.txt 在 COPY . 之前 |

## Dockerfile 模板

```dockerfile
# 多阶段构建
FROM python:3.11-slim as builder

WORKDIR /app

# 安装依赖（不变层，优先构建）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码（变更层，后构建）
COPY . .

# 生产镜像
FROM python:3.11-slim

WORKDIR /app

# 从 builder 复制依赖
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /app .

# 创建非 root 用户
RUN useradd -m app && chown -R app:app /app
USER app

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## .dockerignore 模板

```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
*.so
*.egg
*.egg-info
dist
build
.pytest_cache
.coverage
htmlcov
.env
.venv
venv
.git
.gitignore
README.md
*.md
.DS_Store
```
