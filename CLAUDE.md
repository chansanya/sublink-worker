# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 命令

```bash
npm install
npm run dev      # wrangler dev，本地 http://localhost:8787，KV 使用 .wrangler/state 本地模拟
npm run deploy   # wrangler deploy（首次需 npx wrangler login）
npx wrangler deploy --dry-run   # 只打包校验，不上传
npm run icons    # 重新生成 public/icons.js（新增图标时先改 scripts/build-icons.mjs 里的 NAMES）
```

没有测试和 lint。项目是 Cloudflare Workers ES module 格式，前端在 `public/` 由 Workers Static Assets 托管（静态文件优先命中，其余请求进 Worker），入口 `src/index.js`（`export default { fetch }`），KV 通过 `env.SUBLINK_KV` 注入，`handleRequest(request, env)` 是唯一用到 `env` 的地方。`wrangler.jsonc` 中 KV 绑定的 `id` 是全零占位值（README 的 Deploy to Cloudflare 按钮要求绑定带默认值，部署时会被新建的 namespace id 覆盖）；本地 `wrangler dev` 不读取它，手动 `wrangler deploy` 前必须换成真实 id，否则报 namespace 不存在。

`src/` 是从上游 esbuild 打包产物反向拆出的，原始 `worker.js` 保存在 git 首个提交（`git show f78d35c:worker.js`）。js-yaml 锁定 4.1.0 以保持 Clash YAML 输出一致。

## 架构

请求流：`handleRequest`（`src/index.js`）路由 → `*ConfigBuilder` → `ProxyParser` → 输出 JSON / YAML。

**中间表示是 sing-box outbound 格式。** 所有 `*Parser`（ss / vmess / vless / hysteria2|hy2 / trojan / tuic）都产出 sing-box outbound 对象；Clash 输出靠 `ClashConfigBuilder.convertToClashProxy` 再转换一次。新增协议或字段需要同时改 Parser 和 `convertToClashProxy`。`HttpParser` 例外：它拉取远程订阅、base64 解码后返回**字符串数组**，由 `BaseConfigBuilder.parseCustomItems` 再逐行解析一层。

**Builder 模板方法**：`BaseConfigBuilder.build()` = `parseCustomItems` → `addCustomItems` → `addSelectors` → `formatConfig`。sing-box 的实现类名是 `ConfigBuilder`（不是 `SingboxConfigBuilder`）。两个 Builder 的 `addSelectors` 逻辑平行，硬编码了相同的策略组名：`🚀 节点选择`、`⚡ 自动选择`、`🐟 漏网之鱼`（兜底 final/MATCH），sing-box 额外有 `GLOBAL`；`🚀 节点选择` 首项为 `⚡ 自动选择`（即默认项）。改组名或分组逻辑必须两边同步。

**规则系统**（`src/config.js`）：`UNIFIED_RULES` 是唯一数据源，每条规则的 `name`（英文，如 `"AI Services"`）是 `selectedRules` 参数里用的标识，`outbound`（带 emoji 的中文）是生成的策略组名，标记 `default_direct: true` 的规则（经 `DIRECT_DEFAULT_OUTBOUNDS`）生成的组首项为 `DIRECT`，即默认直连。`PREDEFINED_RULE_SETS` 定义 `minimal` / `balanced` / `comprehensive` 预设。`generateRules` 生成规则列表，`pin=true` 时自定义规则置顶，自定义规则的各字段经 `splitList` 切分（去空格、去空项）。自定义规则的 `name` 即出站：两个 Builder 会为其新建同名策略组，但 `name` 属于 `BUILTIN_OUTBOUNDS`（`DIRECT`/`REJECT`）时不建组，直接指向内置出站。sing-box 侧 `generateRuleSets` 把 site/ip 规则映射为远程 `.srs`（来源 `lyc8503/sing-box-rules`，ip 规则 tag 带 `-ip` 后缀）；Clash 侧直接输出 `GEOSITE,` / `GEOIP,` 规则。默认底板配置为 `SING_BOX_CONFIG` / `CLASH_CONFIG`，Builder 内部会 `DeepCopy`。

**路由**：
- `GET /`：静态资源 `public/index.html`，不经过 Worker
- `GET /api/rules`：前端用的规则分类与预设数据（来自 `UNIFIED_RULES` / `PREDEFINED_RULE_SETS`）
- `/singbox`、`/clash`：参数 `config`（换行分隔的节点或订阅 URL）、`selectedRules`（预设名或 JSON 数组）、`customRules`（JSON，字段 `site/ip/name/domain_suffix/domain_keyword/ip_cidr/protocol`，逗号分隔）、`pin`、`configId`
- `/xray`：拉取并合并订阅，输出 base64
- `/shorten`（旧，存完整 URL，`/s/:code` 跳转）、`/shorten-v2`（存 query string，`/b/` `/c/` `/x/` 分别跳转到 singbox / clash / xray）
- `POST /config`：保存自定义底板配置到 KV，key 为 `${type}_${8位随机}`，TTL 30 天；Clash 的 YAML 会先转成 JSON 存储。短链与配置共用同一个 KV 命名空间

## 前端（`public/`）

原生 HTML/CSS/JS，无构建步骤。`app.js` 是单个 IIFE：状态整体存于 localStorage `sublink:v2`（首次加载会迁移旧版键 `inputTextarea` 等），任何改动经 `changed()` 触发持久化、刷新链接并防抖请求 `/clash` 等接口生成实时预览——预览与真实订阅走同一份后端代码。

- **订阅链接格式必须与旧版逐字节兼容**（`buildUrls`）：`selectedRules` 为预设名字符串或规则名数组，`customRules` 为逗号拼接的字符串字段，`configId` 不编码。改动会导致已分发的链接与新生成的不一致。
- 图标是 `scripts/build-icons.mjs` 从 lucide 导出的子集（`window.ICONS`），HTML 中写 `<i data-icon="name">`，由 `hydrateIcons` 替换为 SVG；界面不使用 emoji，规则组名里的 emoji 用 `stripEmoji` 去掉后展示。
- qrcode-generator 从 jsDelivr 异步加载，二维码功能需判断全局 `qrcode` 是否就绪。
