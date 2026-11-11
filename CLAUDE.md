# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 命令

```bash
npm install
npm run dev      # wrangler dev，本地 http://localhost:8787，KV 使用 .wrangler/state 本地模拟
npm run deploy   # wrangler deploy（首次需 npx wrangler login）
npx wrangler deploy --dry-run   # 只打包校验，不上传
npm run icons    # 重新生成 public/icons.js（新增图标时先改 scripts/build-icons.mjs 里的 NAMES）

cd docs && npm install && npm run dev     # 文档站本地预览（VitePress，http://localhost:5173）
cd docs && npm run build                  # 构建文档，同时检查站内死链
```

`docs/` 是独立的 npm 包（有自己的 `package.json` / `package-lock.json`），根目录构建不会安装 VitePress。`.github/workflows/docs-pages.yml` 在 `docs/**` 变更时构建并推送到 `gh-pages` 分支，由 GitHub Pages 托管在 `https://chansanya.github.io/sublink-worker/`（对应 `config.mts` 的 `base`）。它与 Cloudflare 部署完全独立，**不要把文档放进 `public/`**，否则会被 Worker 一并托管且根路径链接在 Pages 下全部失效。主页顶栏的「文档」链接指向该 Pages 地址。

没有测试和 lint。项目是 Cloudflare Workers ES module 格式，前端在 `public/` 由 Workers Static Assets 托管（静态文件优先命中，其余请求进 Worker），入口 `src/index.js`（`export default { fetch }`），KV（仅用于短链）通过 `env.SUBLINK_KV` 注入，`handleRequest(request, env)` 是唯一用到 `env` 的地方。`wrangler.jsonc` 中 KV 绑定不写 `id`，由 wrangler（≥ 4.45）部署时自动创建并回填；本地 `wrangler dev` 用模拟 KV。不要提交真实 id。此前用全零占位 id，Workers Builds 直连部署会报 `KV namespace not found [10041]`，改为不写 id 后 README 的 Deploy to Cloudflare 按钮是否仍正常尚未验证。

本项目派生自 7Sageer/sublink-worker（现已独立演进，不再同步）；`src/` 是从原项目 esbuild 打包产物反向拆出的，原始 `worker.js` 保存在 git 首个提交（`git show f78d35c:worker.js`）。js-yaml 锁定 4.1.0 以保持 Clash YAML 输出一致。

## 架构

请求流：`handleRequest`（`src/index.js`）路由 → `*ConfigBuilder` → `ProxyParser` → 输出 JSON / YAML。

**中间表示是 sing-box outbound 格式。** 所有 `*Parser`（ss / vmess / vless / hysteria2|hy2 / trojan / tuic）都产出 sing-box outbound 对象；Clash 输出靠 `ClashConfigBuilder.convertToClashProxy` 再转换一次。新增协议或字段需要同时改 Parser 和 `convertToClashProxy`。`HttpParser` 例外：它拉取远程订阅、base64 解码后返回**字符串数组**，由 `BaseConfigBuilder.parseCustomItems` 再逐行解析一层。

**Builder 模板方法**：`BaseConfigBuilder.build()` = `parseCustomItems` → `addCustomItems` → `addSelectors` → `formatConfig`。sing-box 的实现类名是 `ConfigBuilder`（不是 `SingboxConfigBuilder`）。两个 Builder 的 `addSelectors` 逻辑平行，硬编码了相同的策略组名：`🚀 节点选择`、`⚡ 自动选择`、`🐟 漏网之鱼`（兜底 final/MATCH），sing-box 额外有 `GLOBAL`；`🚀 节点选择` 首项为 `⚡ 自动选择`（即默认项）。改组名或分组逻辑必须两边同步。

**规则系统**（`src/config.js`）：`UNIFIED_RULES` 是唯一数据源，每条规则的 `name`（英文，如 `"AI Services"`）是 `selectedRules` 参数里用的标识，`outbound`（带 emoji 的中文）是生成的策略组名，规则可声明 `default_outbound`（`DIRECT`/`REJECT`），两个 Builder 通过 `groupMembers` 把它放到组首位，即默认选中（私有网络、国内服务、苹果、微软默认直连，广告拦截默认拦截）。`REJECT` 只出现在广告拦截组和自定义出站组里：`groupMembers` 对其他分类组去掉它，`🚀 节点选择`、`🐟 漏网之鱼`、sing-box 的 `GLOBAL` 经 `withoutReject` 去掉。`UNIFIED_RULES` 的默认顺序遵循“小分类在前、包含它的大分类在后”（如 YouTube 在谷歌前、云服务在微软前），调整时用前端的冲突提示检验。`PREDEFINED_RULE_SETS` 定义 `minimal` / `balanced` / `comprehensive` 预设。`selectedRules` 一律经 `resolveSelectedRules` 解析：预设名展开为 `UNIFIED_RULES` 固定顺序，数组则**保持传入顺序**（前端拖动排序的结果），规则与策略组都按该顺序生成。`generateRules` 生成规则列表，`pin=true` 时自定义规则置顶，自定义规则的各字段经 `splitList` 切分（去空格、去空项）。自定义规则的 `name` 即出站：两个 Builder 会为其新建同名策略组，但 `name` 属于 `BUILTIN_OUTBOUNDS`（`DIRECT`/`REJECT`）时不建组，直接指向内置出站。sing-box 侧 `generateRuleSets` 把 site/ip 规则映射为远程 `.srs`（来源 `lyc8503/sing-box-rules`，ip 规则 tag 带 `-ip` 后缀）；Clash 侧直接输出 `GEOSITE,` / `GEOIP,` 规则。Builder 固定以 `SING_BOX_CONFIG` / `CLASH_CONFIG` 为模板（内部 `DeepCopy`）；原项目的自定义底板（`POST /config` + `configId`）已移除，旧链接带的 `configId` 参数会被忽略。

**路由**：
- `GET /`：静态资源 `public/index.html`，不经过 Worker
- `GET /api/rules`：前端用的规则分类与预设数据（来自 `UNIFIED_RULES` / `PREDEFINED_RULE_SETS`，含 `site_rules`、`default_outbound`）
- `GET /api/geosite/:name`：代理 MetaCubeX 已展开 include 的纯文本名单（`GEOSITE_LIST_BASE_URL`，与 Clash 的 geosite.dat 同源），边缘缓存 1 天；不存在返回 404。供前端在线分析，每次请求只产生 1 个子请求
- `/singbox`、`/clash`：参数 `config`（换行分隔的节点或订阅 URL）、`selectedRules`（预设名或 JSON 数组）、`customRules`（JSON，字段 `site/ip/name/domain_suffix/domain_keyword/ip_cidr/protocol`，可选 `domain`（完整域名，Clash `DOMAIN` / sing-box `domain`，仅有值时才输出），逗号分隔）、`pin`、可选 `name`（订阅名，经 `profileHeaders` 写入 `Content-Disposition` / `profile-title`，默认 `Sublink`；前端仅在填写时才追加，保持旧链接兼容）。参数解析失败不报错而是静默回退：`selectedRules` 非预设名且 JSON 解析失败 → `minimal`，`customRules` 解析失败 → `[]`；仅缺 `config` 返回 400
- `/xray`：拉取并合并订阅，输出 base64
- `/shorten`（旧，存完整 URL，`/s/:code` 跳转）、`/shorten-v2`（存 query string，`/b/` `/c/` `/x/` 分别跳转到 singbox / clash / xray）

## 前端（`public/`）

原生 HTML/CSS/JS，无构建步骤。`app.js` 是单个 IIFE：状态整体存于 localStorage `sublink:v2`（首次加载会迁移旧版键 `inputTextarea` 等），规则分类卡片可拖动排序（`bindRuleDrag`，pointer events + FLIP），顺序存于 `state.order`，自定义模式下 `effectiveSelected()` 按它过滤出有序数组；预设模式按固定顺序展示。任何改动经 `changed()` 触发持久化、刷新链接并防抖请求 `/clash` 等接口生成实时预览——预览与真实订阅走同一份后端代码。

布局为单列居中（`.pane-config` 最大宽度 880px）：hero → 输入源 → 「高级选项」`<details>`（内含规则分类与自定义规则）→ 生成订阅 / 清除 → 订阅链接。`state.generated` 控制订阅链接块（`#links`）是否显示，首次点「生成订阅」后始终显示并实时更新；「清除」只清空输入源与 `generated`，保留规则设置。`state.advancedOpen` 记住高级选项的展开状态。主题默认跟随系统（`index.html` 内联脚本按 localStorage `theme`、其次 `prefers-color-scheme` 设置 `data-theme`；未手动切换时 `bindTheme` 会实时响应系统切换，手动切换后写入 `theme` 并不再跟随；文档站 VitePress 默认即跟随系统），强调色为天蓝渐变。预览抽屉默认收起（`drawerOpen: false`）。

- **订阅链接格式必须与旧版逐字节兼容**（`buildUrls`）：`selectedRules` 为预设名字符串或规则名数组，`customRules` 为逗号拼接的字符串字段，`domain` 仅在非空时追加在末尾（`ruleParam`）。改动会导致已分发的链接与新生成的不一致。
- 图标是 `scripts/build-icons.mjs` 从 lucide 导出的子集（`window.ICONS`），HTML 中写 `<i data-icon="name">`，由 `hydrateIcons` 替换为 SVG；界面不使用 emoji，规则组名里的 emoji 用 `stripEmoji` 去掉后展示。
- qrcode-generator 从 jsDelivr 异步加载，二维码功能需判断全局 `qrcode` 是否就绪。
- 在线分析（`analyzeRules`）：启动后经 `/api/geosite` 拉取全部分类名单，在浏览器计算域名数与两两覆盖率。`ruleConflicts` 判定冲突需同时满足：A 排在 B 后、A 被 B 覆盖的比例高于反向（排除两者只是共享一块，如云服务/微软共享 Azure）、比例 ≥ `CONFLICT_RATIO` 或被截走数 ≥ `CONFLICT_HITS`（照顾广告这类横跨国内外的分类）。自定义规则的 Geo-Site 名称用同一接口校验是否存在（`validateSites`）。
- 自定义规则分两层：`state.quickRules`（快捷规则，`{ action: DIRECT|REJECT, type: domain|domain_suffix|ip_cidr, values }`，提交时经 `normalizeQuickValue` 规范化、`isValidQuickValue` 校验，非法值标红且不写入订阅）与 `state.customRules`（高级规则，完整表单，位于默认折叠的 `<details id="advancedRules">`）。`customRulesParam` 先输出快捷后输出高级；旧状态由 `migrateQuickRules` 把开头连续的、只含一种快捷匹配的 DIRECT/REJECT 规则转成快捷行（不改变匹配顺序）。标签输入的键盘行为在 `bindTokenInputs` 中两层共用。
- 推荐排序（`recommendedOrder`）：广告最前，纯 IP 分类（无域名数据）其次，其余按 `isContained` 拓扑排序、同层按域名数升序，大合集自然落到最后；与冲突检测共用 `isContained`，保证结果零冲突。需在线分析完成后才可用。
- 预览在右侧抽屉（`<html data-drawer>`，首屏由 `index.html` 内联脚本提前设置以免闪动）：大屏为 grid 列宽过渡，窄屏（≤1080px）为浮层并总是从收起开始。抽屉收起时 `runPreview` 只标记 `preview.stale`，不发请求，打开时再生成。订阅链接在配置区第 04 块，不随抽屉收起。
- 显式点「自定义」恢复上次的勾选与顺序；在预设下直接点卡片、拖动或点修正按钮，则经 `enterCustom` 从该预设开始自定义。
