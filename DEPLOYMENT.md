# 公网部署说明

这个站点需要保存后台内容、每日占卜和用户选题留言，所以推荐部署到有持久化磁盘的 Node.js 服务器或 Docker 主机。不要把它部署成纯静态网站。

## 生产环境变量

至少配置：

```bash
ADMIN_PASSWORD=一个足够强的后台密码
SESSION_SECRET=一个随机长字符串
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-5.4-mini
LENORMAND_DB_PATH=/app/data/lenormand.sqlite
NEXT_PUBLIC_SITE_URL=https://你的域名
```

`LENORMAND_DB_PATH` 指向的目录必须可写并且持久化备份。

## Docker 部署

```bash
docker build -t acai-cosmic-station .
docker run -d \
  --name acai-cosmic-station \
  -p 3000:3000 \
  -v acai-cosmic-data:/app/data \
  --env-file .env \
  acai-cosmic-station
```

然后把域名通过 Nginx、Caddy 或平台自带反向代理指向服务器的 `3000` 端口，并开启 HTTPS。

## Render Blueprint 部署

项目根目录已经包含 `render.yaml`，可以通过 Render Blueprint 创建公网网站。Render 的 Blueprint 文件需要放在 Git 仓库根目录；Render 官方文档说明 `render.yaml` 用于定义服务，Docker 服务使用 `runtime: docker`，持久化磁盘使用 `disk`，密钥类环境变量可以用 `sync: false` 让 Render 在创建时提示填写。

当前正式公网服务：

- URL：`https://acai-cosmic-station.onrender.com`
- Render 部署分支：`codex/acai-cosmic-station`

注意：当前仓库的 `main` 分支保留着旧项目历史，不作为这个站点的部署分支。Render 服务请指向 `codex/acai-cosmic-station`，避免把旧项目重新部署上去。

部署步骤：

1. 把本项目推送到 GitHub。
2. 登录 Render Dashboard。
3. New > Blueprint，选择这个 GitHub 仓库。
4. 按提示填写：
   - `ADMIN_PASSWORD`：后台密码。
   - `OPENAI_API_KEY`：OpenAI API Key，没有可先留空但 AI 生成不可用。
   - `NEXT_PUBLIC_SITE_URL`：首次可先填 Render 创建后的 `https://xxx.onrender.com`，之后如绑定域名再改。
5. 创建后等待部署完成，Render 会生成一个公网 `.onrender.com` 地址。

`render.yaml` 已设置：

- Docker 部署。
- 新加坡区域。
- 1GB 持久化磁盘挂载到 `/app/data`。
- SQLite 写入 `/app/data/lenormand.sqlite`，避免重启或重新部署后数据丢失。

## 普通 Node.js 部署

```bash
npm ci
npm run build
npm run start:public
```

服务器需要开放反向代理或防火墙端口。数据库默认保存在 `./data/lenormand.sqlite`，上线后请定期备份 `data` 目录。

## 用户可互动的公开页面

- `/`：用户查看每日已发布的大众占卜。
- `/topics`：用户提交选题建议。
- `/archive`：用户查看历史内容。
- `/admin`：你自己的后台，必须设置强密码。

## 上线检查

- 后台密码不是默认值。
- `SESSION_SECRET` 不是默认值。
- `OPENAI_API_KEY` 只存在服务端环境变量里。
- `data` 目录已持久化并纳入备份。
- 域名启用 HTTPS。
- `/topics` 能提交留言，后台首页能看到留言。
