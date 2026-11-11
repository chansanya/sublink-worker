# 快速开始

Sublink Worker 运行在 Cloudflare Workers 上，只依赖一个 KV 命名空间（用于存储短链）。下面三种方式任选其一。

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chansanya/sublink-worker)

1. 点击上面的按钮，Cloudflare 会把仓库复制到你的 GitHub / GitLab 账号。
2. 在配置页确认仓库名、Worker 名称和 KV 名称，Cloudflare 会自动创建 KV 命名空间并完成绑定。
3. 部署完成后打开 Worker 的地址即可使用。之后向你的仓库推送代码，会自动重新部署。

::: tip 国内访问
`*.workers.dev` 域名在部分网络下无法访问。可以在 Cloudflare 控制台为 Worker 绑定自己的域名。
:::

## 使用 Wrangler 手动部署

```bash
git clone https://github.com/chansanya/sublink-worker.git
cd sublink-worker
npm install
npx wrangler login

# 创建 KV 命名空间，记下输出的 id
npx wrangler kv namespace create SUBLINK_KV
```

把输出的 id 填入 `wrangler.jsonc`，替换 `kv_namespaces` 里的占位值：

```jsonc
"kv_namespaces": [
  { "binding": "SUBLINK_KV", "id": "<你的 namespace id>" }
]
```

然后发布：

```bash
npm run deploy
```

::: warning 占位 id
仓库里的 KV `id` 是全零占位值，供一键部署按钮替换使用。手动部署时如果不替换，会报 namespace 不存在。
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
