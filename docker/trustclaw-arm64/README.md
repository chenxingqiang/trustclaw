# TrustClaw ARM64 Docker 离线部署

按《选手电脑 ARM64 Docker 应用部署操作说明》格式：`Dockerfile` + `compose.yaml` + `app.env`，`pull_policy: never`，配置持久化，启动即用。

## 目录

```
docker/trustclaw-arm64/
  compose.yaml          # 离线 compose（pull_policy: never）
  app.env               # 运行配置（含 API Key，勿提交真实密钥）
  app.env.example       # 配置模板
  Dockerfile            # TrustClaw 运行时层（基于根 Dockerfile 构建的 base）
  config/openclaw.json.seed
  scripts/
    build-arm64.sh      # 本机构建 linux/arm64 镜像
    save-bundle.sh      # docker save 离线包
    smoke-compose.sh    # compose 自测 + healthz
    entrypoint.sh
    init-config.mjs
```

## 1. 本机构建（ARM64 Mac / linux/arm64）

```bash
cd docker/trustclaw-arm64
chmod +x scripts/*.sh
./scripts/build-arm64.sh
```

构建两阶段：
1. 根 `Dockerfile` + `OPENCLAW_TRUSTCLAW_UI=1` + `trustclaw-ptds` 插件 → `trustclaw-openclaw-base:arm64`
2. `docker/trustclaw-arm64/Dockerfile` 加入 entrypoint、配置种子 → `trustclaw-app:arm64`

## 2. 配置 app.env

```bash
cp app.env.example app.env
# 编辑 ANTHROPIC_API_KEY、OPENCLAW_GATEWAY_TOKEN 等
```

| 变量 | 说明 |
|------|------|
| `APP_PORT` | Gateway / Control UI 宿主机端口，默认 `8080` |
| `TRUSTCLAW_UI_PORT` | PTDS Console 宿主机端口，默认 `5174`（访问 `/trustclaw/`） |
| `OPENCLAW_GATEWAY_TOKEN` | Control UI 访问令牌 |
| `ANTHROPIC_API_KEY` | Sonnet 聊天（必填才能对话） |
| `ANTHROPIC_BASE_URL` | Anthropic 代理地址 |
| `TRUSTCLAW_DEFAULT_AGENT_PACK` | 默认领域包，如 `glp1-eligibility` |

配置写入 volume `trustclaw-data`（`/home/node/.openclaw`），重启不丢失。

## 3. 本机自测

```bash
./scripts/smoke-compose.sh
# 或
docker compose up -d
curl http://localhost:8080/healthz
curl -I http://localhost:5174/trustclaw/
```

浏览器：
- Control UI / Chat：`http://<本机IP>:8080/`（Token 见 `OPENCLAW_GATEWAY_TOKEN`）
- **PTDS Runtime Console**：`http://127.0.0.1:5174/trustclaw/`（与 `pnpm trustclaw:dev` 端口一致）

## 4. 离线打包（内网）

```bash
./scripts/save-bundle.sh
# 输出: dist/trustclaw-app-arm64.tar
```

拷贝到内网机器：

```bash
docker load -i trustclaw-app-arm64.tar
# 连同 compose.yaml、app.env 一起放到同一目录
docker compose up -d
curl http://localhost:8080/healthz
```

## 端口与健康检查

| 宿主机 | 容器 | 用途 |
|--------|------|------|
| `8080`（`APP_PORT`） | `19001` | Gateway / Control UI / API |
| `5174`（`TRUSTCLAW_UI_PORT`） | `19001` | PTDS Console：`/trustclaw/` |

两端口均映射到同一 Gateway 进程；`5174` 与本地 dev（`pnpm trustclaw:dev`）的 Console 地址一致。

- 健康检查：`GET /healthz`（两端口均可，如 `http://localhost:8080/healthz`）
- PTDS 看板：`http://127.0.0.1:5174/trustclaw/`

## 分支

基于 `trustclaw/f9da4165-base`（`440e3bdb`），分支名 `trustclaw/docker-arm64`。
