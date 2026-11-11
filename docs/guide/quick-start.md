# 快速开始

Sublink Worker 运行在 Cloudflare Workers 上，只依赖一个 KV 命名空间（用于存储短链）。下面几种方式任选其一。

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chansanya/sublink-worker)

1. 点击上面的按钮，Cloudflare 会把仓库复制到你的 GitHub / GitLab 账号。
2. 在配置页确认仓库名、Worker 名称和 KV 名称，Cloudflare 会自动创建 KV 命名空间并完成绑定。
3. 部署完成后打开 Worker 的地址即可使用。之后向你的仓库推送代码，会自动重新部署。

::: tip 国内访问
`*.workers.dev` 域名在部分网络下无法访问。可以在 Cloudflare 控制台为 Worker 绑定自己的域名。
:::

## 在 Cloudflare 控制台连接仓库部署

已经有仓库（自己的 fork 或复制的副本）时，可以直接让 Cloudflare 从 GitHub / GitLab 拉代码构建：

1. 打开 Cloudflare 控制台，进入 **Workers & Pages**，选择创建应用并导入 Git 仓库。
2. 选择仓库和分支，构建命令留空，部署命令使用默认的 `npx wrangler deploy`（等同于 `npm run deploy`）。
3. 保存并部署。`wrangler.jsonc` 里的 KV 绑定没有写 `id`，会在首次部署时自动创建 `SUBLINK_KV` 并完成绑定。
4. 之后向该分支推送代码，会自动重新构建并部署。

::: tip Worker 名称
控制台里的 Worker 名称最好与 `wrangler.jsonc` 的 `name`（`sublink-worker`）保持一致。名称不一致时，自动创建的 KV 命名空间会按控制台里的 Worker 名称命名，改名后可能多出一个新的命名空间，原有短链不会迁移。
:::

## 使用 Wrangler 手动部署

```bash
git clone https://github.com/chansanya/sublink-worker.git
cd sublink-worker
npm install
npx wrangler login

# 首次部署会自动创建并绑定 SUBLINK_KV
npm run deploy
```

::: tip KV 自动创建
`wrangler.jsonc` 里的 KV 绑定没有写 `id`，由 wrangler（需 4.45 及以上）在部署时自动创建。想复用已有的 namespace，把它的 `id` 填到绑定里即可：

```jsonc
{ "binding": "SUBLINK_KV", "id": "<你的 namespace id>" }
```
:::

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:8787`。本地使用模拟的 KV，数据保存在 `.wrangler/state`，不需要 Cloudflare 账号，短链的生成与跳转也能完整测试。

## 生成第一份订阅

1. **输入源**：粘贴节点链接或机场订阅地址，每行一条，可以混合填写。下方会统计每种协议的数量，无法识别的行会标黄。
2. **高级选项**（可选）：
   - 选择规则预设（精简 / 均衡 / 全面），或点选分类卡片、拖动调整顺序，详见[规则分类](./rules)。
   - 需要对特定域名或 IP 直连、拒绝时，添加[自定义规则](./custom-rules)。
3. 点击 **生成订阅**，下方出现 Clash、sing-box、Xray 三条订阅链接，之后的修改会实时反映到链接上。
4. 想让多台设备使用同一个固定地址，填一个短链路径并生成短链，详见[订阅链接与短链](./links)。

点击顶栏的预览按钮，可以在右侧抽屉里查看实际生成的配置文件。
