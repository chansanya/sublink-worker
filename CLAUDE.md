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

没有测试和 lint。项目是 Cloudflare Workers ES module 格式，前端在 `public/` 由 Workers Static Assets 托管（静态文件优先命中，其余请求进 Worker），入口 `src/index.js`（`export default { fetch }`），KV（仅用于短链）通过 `env.SUBLINK_KV` 注入，`handleRequest(request, env)` 是唯一用到 `env` 的地方。`wrangler.jsonc` 中 KV 绑定的 `id` 是全零占位值（README 的 Deploy to Cloudflare 按钮要求绑定带默认值，部署时会被新建的 namespace id 覆盖）；本地 `wrangler dev` 不读取它，手动 `wrangler deploy` 前必须换成真实 id，否则报 namespace 不存在。

`src/` 是从上游 esbuild 打包产物反向拆出的，原始 `worker.js` 保存在 git 首个提交（`git show f78d35c:worker.js`）。js-yaml 锁定 4.1.0 以保持 Clash YAML 输出一致。

## 架构

请求流：`handleRequest`（`src/index.js`）路由 → `*ConfigBuilder` → `ProxyParser` → 输出 JSON / YAML。

**中间表示是 sing-box outbound 格式。** 所有 `*Parser`（ss / vmess / vless / hysteria2|hy2 / trojan / tuic）都产出 sing-box outbound 对象；Clash 输出靠 `ClashConfigBuilder.convertToClashProxy` 再转换一次。新增协议或字段需要同时改 Parser 和 `convertToClashProxy`。`HttpParser` 例外：它拉取远程订阅、base64 解码后返回**字符串数组**，由 `BaseConfigBuilder.parseCustomItems` 再逐行解析一层。

**Builder 模板方法**：`BaseConfigBuilder.build()` = `parseCustomItems` → `addCustomItems` → `addSelectors` → `formatConfig`。sing-box 的实现类名是 `ConfigBuilder`（不是 `SingboxConfigBuilder`）。两个 Builder 的 `addSelectors` 逻辑平行，硬编码了相同的策略组名：`🚀 节点选择`、`⚡ 自动选择`、`🐟 漏网之鱼`（兜底 final/MATCH），sing-box 额外有 `GLOBAL`；`🚀 节点选择` 首项为 `⚡ 自动选择`（即默认项）。改组名或分组逻辑必须两边同步。

**规则系统**（`src/config.js`）：`UNIFIED_RULES` 是唯一数据源，每条规则的 `name`（英文，如 `"AI Services"`）是 `selectedRules` 参数里用的标识，`outbound`（带 emoji 的中文）是生成的策略组名，规则可声明 `default_outbound`（`DIRECT`/`REJECT`），两个 Builder 通过 `groupMembers` 把它放到组首位，即默认选中（私有网络、国内服务默认直连，广告拦截默认拦截）。`UNIFIED_RULES` 的默认顺序遵循“小分类在前、包含它的大分类在后”（如 YouTube 在谷歌前、云服务在微软前），调整时用前端的冲突提示检验。`PREDEFINED_RULE_SETS` 定义 `minimal` / `balanced` / `comprehensive` 预设。`selectedRules` 一律经 `resolveSelectedRules` 解析：预设名展开为 `UNIFIED_RULES` 固定顺序，数组则**保持传入顺序**（前端拖动排序的结果），规则与策略组都按该顺序生成。`generateRules` 生成规则列表，`pin=true` 时自定义规则置顶，自定义规则的各字段经 `splitList` 切分（去空格、去空项）。自定义规则的 `name` 即出站：两个 Builder 会为其新建同名策略组，但 `name` 属于 `BUILTIN_OUTBOUNDS`（`DIRECT`/`REJECT`）时不建组，直接指向内置出站。sing-box 侧 `generateRuleSets` 把 site/ip 规则映射为远程 `.srs`（来源 `lyc8503/sing-box-rules`，ip 规则 tag 带 `-ip` 后缀）；Clash 侧直接输出 `GEOSITE,` / `GEOIP,` 规则。Builder 固定以 `SING_BOX_CONFIG` / `CLASH_CONFIG` 为模板（内部 `DeepCopy`）；上游的自定义底板（`POST /config` + `configId`）已移除，旧链接带的 `configId` 参数会被忽略。

**路由**：
- `GET /`：静态资源 `public/index.html`，不经过 Worker
- `GET /api/rules`：前端用的规则分类与预设数据（来自 `UNIFIED_RULES` / `PREDEFINED_RULE_SETS`，含 `site_rules`、`default_outbound`）
- `GET /api/geosite/:name`：代理 MetaCubeX 已展开 include 的纯文本名单（`GEOSITE_LIST_BASE_URL`，与 Clash 的 geosite.dat 同源），边缘缓存 1 天；不存在返回 404。供前端在线分析，每次请求只产生 1 个子请求
- `/singbox`、`/clash`：参数 `config`（换行分隔的节点或订阅 URL）、`selectedRules`（预设名或 JSON 数组）、`customRules`（JSON，字段 `site/ip/name/domain_suffix/domain_keyword/ip_cidr/protocol`，逗号分隔）、`pin`
- `/xray`：拉取并合并订阅，输出 base64
- `/shorten`（旧，存完整 URL，`/s/:code` 跳转）、`/shorten-v2`（存 query string，`/b/` `/c/` `/x/` 分别跳转到 singbox / clash / xray）

## 前端（`public/`）

原生 HTML/CSS/JS，无构建步骤。`app.js` 是单个 IIFE：状态整体存于 localStorage `sublink:v2`（首次加载会迁移旧版键 `inputTextarea` 等），规则分类卡片可拖动排序（`bindRuleDrag`，pointer events + FLIP），顺序存于 `state.order`，自定义模式下 `effectiveSelected()` 按它过滤出有序数组；预设模式按固定顺序展示。任何改动经 `changed()` 触发持久化、刷新链接并防抖请求 `/clash` 等接口生成实时预览——预览与真实订阅走同一份后端代码。

- **订阅链接格式必须与旧版逐字节兼容**（`buildUrls`）：`selectedRules` 为预设名字符串或规则名数组，`customRules` 为逗号拼接的字符串字段。改动会导致已分发的链接与新生成的不一致。
- 图标是 `scripts/build-icons.mjs` 从 lucide 导出的子集（`window.ICONS`），HTML 中写 `<i data-icon="name">`，由 `hydrateIcons` 替换为 SVG；界面不使用 emoji，规则组名里的 emoji 用 `stripEmoji` 去掉后展示。
- qrcode-generator 从 jsDelivr 异步加载，二维码功能需判断全局 `qrcode` 是否就绪。
- 在线分析（`analyzeRules`）：启动后经 `/api/geosite` 拉取全部分类名单，在浏览器计算域名数与两两覆盖率。`ruleConflicts` 判定冲突需同时满足：A 排在 B 后、A 被 B 覆盖的比例高于反向（排除两者只是共享一块，如云服务/微软共享 Azure）、比例 ≥ `CONFLICT_RATIO` 或被截走数 ≥ `CONFLICT_HITS`（照顾广告这类横跨国内外的分类）。自定义规则的 Geo-Site 名称用同一接口校验是否存在（`validateSites`）。
- 显式点「自定义」恢复上次的勾选与顺序；在预设下直接点卡片、拖动或点修正按钮，则经 `enterCustom` 从该预设开始自定义。
