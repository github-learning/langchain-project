# Kubernetes 部署模板

## 生产级最佳实践

| 配置项 | 要求 | 说明 |
|--------|------|------|
| **资源限制** | 必须设置 requests 和 limits | 避免资源抢占 |
| **健康检查** | 配置 liveness/readiness/startupProbe | 确保应用可用性 |
| **配置管理** | ConfigMap 管理非敏感配置 | Secret 管理敏感信息 |
| **高可用** | 多副本 + Pod 反亲和性 | 消除单点故障 |
| **安全策略** | PodSecurityContext | 限制容器权限 |

## Deployment 模板

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-server
  labels:
    app: ai-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-server
  template:
    metadata:
      labels:
        app: ai-server
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - ai-server
                topologyKey: kubernetes.io/hostname
      containers:
        - name: ai-server
          image: ai-server:latest
          ports:
            - containerPort: 8000
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: ai-server-secrets
                  key: database-url
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
```

## Service 模板

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-server
spec:
  selector:
    app: ai-server
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: ClusterIP
```

## HPA（自动扩缩容）模板

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```
