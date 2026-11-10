# 快速开始

Sublink Worker 专为个人自托管设计，零外部依赖，可以通过以下三种方式部署与运行。

---

## 1. Cloudflare Workers 一键部署（推荐）

1. 点击仓库首页的 **Deploy to Cloudflare** 按钮。
2. 授权 Cloudflare 自动将项目 Fork 到你的 GitHub / GitLab 账户。
3. 部署服务会自动创建一个专属的 `SUBLINK_KV` 命名空间并注入 Worker。
4. 部署完成后，通过 Cloudflare 提供的 `*.workers.dev` 域名即可直接访问 Web 转换工作台。
5. 之后向你的 GitHub 仓库推送代码即可实现自动持续集成部署。

---

## 2. Wrangler CLI 手动部署

如果你希望完全自主控制构建与配置，可以使用官方 Wrangler 命令行：

```bash
# 1. 克隆代码仓库
git clone https://github.com/chansanya/sublink-worker.git
cd sublink-worker

# 2. 安装本地依赖
npm install

# 3. 登录 Cloudflare
npx wrangler login

# 4. 创建 KV 命名空间（记录控制台输出的 id）
npx wrangler kv namespace create SUBLINK_KV

# 5. 修改 wrangler.jsonc
# 将输出的 id 填入 kv_namespaces 数组，替换默认的全零占位符

# 6. 发布到 Cloudflare Workers
npm run deploy
```

---

## 3. 本地开发与测试

本地运行不需要配置真实 Cloudflare 账号，会自动使用本地模拟 KV 存储：

```bash
npm install
npm run dev
```

本地服务默认运行在：
- Web 转换工作台：`http://localhost:8787/`
- 文档中心：`http://localhost:8787/docs/`
- 本地短链数据将自动持久化保存在 `.wrangler/state` 中。

---

## 4. 基本使用流程

1. **输入节点**：在「01 节点」区域粘贴你的单条或多条节点链接（`ss://`、`vmess://`、`vless://`、`trojan://`、`hysteria2://`、`tuic://`），也可以粘贴机场订阅 URL（每行一条，支持混填）。
2. **规则配置**：在「02 规则分类」中选择预设（精简 / 均衡 / 全面），或自由勾选与拖拽排序。可点击「推荐排序」获得零冲突拓扑排列。
3. **添加例外**：如有特定域名或 IP 需要直连/拦截，在「03 自定义规则」中添加（默认置顶优先匹配）。
4. **获取订阅**：在「04 订阅链接」中直接复制 Clash、sing-box 或 Xray 订阅地址；或输入自定义短链代号（如 `my-proxy`）生成固定短链。
