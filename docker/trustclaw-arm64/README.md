# TrustClaw ARM64 Docker 离线部署

按《选手电脑 ARM64 Docker 应用部署操作说明》格式：`Dockerfile` + `compose.yaml` + `app.env`，`pull_policy: never`，配置持久化，启动即用。

## 目录

```
docker/trustclaw-arm64/
  compose.yaml            # 离线 compose（pull_policy: never）
  app.env                 # 运行配置（端口、Token、模型；无密钥）
  app.env.example         # app.env 模板
  app.env.dev             # 本地密钥（gitignore，勿提交）
  app.env.dev.example     # 密钥模板
  Dockerfile              # TrustClaw 运行时层（基于根 Dockerfile 构建的 base）
  config/openclaw.json.seed
  dist/                   # docker save 离线包（gitignore）
  scripts/
    build-arm64.sh        # 本机构建 linux/arm64 镜像
    save-bundle.sh        # docker save 离线包
    push-dockerhub.sh     # 推送到 Docker Hub（需 VPN）
    smoke-compose.sh      # compose 自测 + healthz
    entrypoint.sh
    init-config.mjs
```

## 快速开始（本机 ARM64）

```bash
cd docker/trustclaw-arm64
chmod +x scripts/*.sh

# 1) 构建镜像（首次，约 10–20 分钟）
./scripts/build-arm64.sh

# 2) 配置
cp app.env.example app.env
cp app.env.dev.example app.env.dev
# 编辑 app.env.dev：填入 ANTHROPIC_API_KEY（可与 ~/.claude/settings.json env 一致）

# 3) 启动
docker compose up -d --force-recreate

# 4) 自测
./scripts/smoke-compose.sh
```

浏览器：

| 入口              | URL                                 | 说明                               |
| ----------------- | ----------------------------------- | ---------------------------------- |
| Control UI / Chat | `http://127.0.0.1:8080/`            | Token = `OPENCLAW_GATEWAY_TOKEN`   |
| PTDS Console      | `http://127.0.0.1:15174/trustclaw/` | Docker 映射；本地 dev 仍用 `:5174` |

验证模型 Key 已注入（不打印密钥）：

```bash
docker compose exec -T app node -e "console.log('key len', (process.env.ANTHROPIC_API_KEY||'').trim().length)"
# 应 > 0，否则聊天报 missing-provider-auth
```

## 1. 构建镜像

```bash
./scripts/build-arm64.sh
```

两阶段：

1. 根 `Dockerfile` + `OPENCLAW_TRUSTCLAW_UI=1` + `trustclaw-ptds` → `trustclaw-openclaw-base:arm64`（运行时复制完整 `trustclaw/`）
2. `docker/trustclaw-arm64/Dockerfile` overlay → `trustclaw-app:arm64`

国内拉基础镜像慢时可设镜像源：

```bash
TRUSTCLAW_DOCKER_MIRROR=docker.m.daocloud.io ./scripts/build-arm64.sh
```

## 2. 配置说明

`compose.yaml` 按顺序加载：

1. `app.env` — 端口、Gateway Token、默认 Agent Pack（可提交模板）
2. `app.env.dev` — **API Key**（可选文件，`required: false`；本地开发建议创建）

```bash
cp app.env.example app.env
cp app.env.dev.example app.env.dev
# 编辑 app.env.dev
```

| 文件          | 变量示例                                                  | 说明                         |
| ------------- | --------------------------------------------------------- | ---------------------------- |
| `app.env`     | `APP_PORT`, `TRUSTCLAW_UI_PORT`, `OPENCLAW_GATEWAY_TOKEN` | 非密钥运行参数               |
| `app.env.dev` | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`                 | 模型鉴权（**必填才能对话**） |

**不会自动进容器：** 本机 `~/.openclaw/`、`~/.claude/settings.json`；改 `app.env.dev` 后执行 `docker compose up -d --force-recreate`。

配置持久化在 volume `trustclaw-data`（`/home/node/.openclaw`），`init-config.mjs` 每次启动合并进 `openclaw.json`。

### 容器 ↔ 本地同步

| 方向              | 命令                                | 说明                                                                                              |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| 容器 → 本地       | `./scripts/pull-container-state.sh` | 拉取 volume 到 `runtime-state/`；domain-agents 注册表同步到 `trustclaw/ptds/seeds/domain-agents/` |
| 本地代码 → 容器   | `./scripts/push-container-code.sh`  | 构建并推送 plugin/UI 到运行中容器                                                                 |
| 本地 state → 容器 | `./scripts/push-container-state.sh` | 将 `runtime-state/` 的 DB、merged packs、审计写回 volume                                          |

`runtime-state/` 默认 gitignore（含密钥）；仅 `runtime-state/README.md` 可提交。

## 3. 运行与排错

```bash
docker compose up -d
docker compose logs -f
docker compose down
```

| 现象                    | 处理                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| Control UI 连不上       | Token 填 `OPENCLAW_GATEWAY_TOKEN` 字符串，不是 URL                              |
| `missing-provider-auth` | `app.env.dev` 中 `ANTHROPIC_API_KEY` 为空或未 recreate                          |
| PTDS 侧栏空白 / 503     | 确认镜像含 `trustclaw/ptds`；`curl http://127.0.0.1:8080/trustclaw/?embed=left` |
| 本地 dev 端口冲突       | Docker 用 `15174`，dev 用 `5174`                                                |

## 4. 离线打包（内网）

```bash
./scripts/save-bundle.sh
# → dist/trustclaw-app-arm64.tar
```

目标机：

```bash
docker load -i trustclaw-app-arm64.tar
# 拷贝 compose.yaml、app.env、app.env.dev 到同一目录
docker compose up -d
curl http://localhost:8080/healthz
```

## 5. Docker Hub 推送（可选）

```bash
docker login
DOCKER_USER=chenxingqiang ./scripts/push-dockerhub.sh arm64
```

国内需 VPN；成功后：

```bash
docker pull chenxingqiang/trustclaw-app:arm64
```

## 端口

| 宿主机                         | 容器    | 用途                       |
| ------------------------------ | ------- | -------------------------- |
| `8080`（`APP_PORT`）           | `19001` | Gateway / Control UI / API |
| `15174`（`TRUSTCLAW_UI_PORT`） | `19001` | PTDS Console `/trustclaw/` |

容器内仅 Gateway `19001`；两宿主机端口映射同一进程。

## 分支

基于 `trustclaw/f9da4165-base`（`440e3bdb`），分支 `trustclaw/docker-arm64`。
