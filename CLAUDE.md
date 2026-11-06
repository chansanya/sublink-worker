# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 命令

```bash
npm install
npm run dev      # wrangler dev，本地 http://localhost:8787，KV 使用 .wrangler/state 本地模拟
npm run deploy   # wrangler deploy（首次需 npx wrangler login）
npx wrangler deploy --dry-run   # 只打包校验，不上传
```

没有测试和 lint。项目是 Cloudflare Workers ES module 格式，入口 `src/index.js`（`export default { fetch }`），KV 通过 `env.SUBLINK_KV` 注入，`handleRequest(request, env)` 是唯一用到 `env` 的地方。`wrangler.jsonc` 中 KV 绑定省略了 `id`，部署时自动创建；迁移已有短链数据需填入原 namespace id。

`src/` 是从上游 esbuild 打包产物反向拆出的，原始 `worker.js` 保存在 git 首个提交（`git show f78d35c:worker.js`）。js-yaml 锁定 4.1.0 以保持 Clash YAML 输出一致。

## 架构

请求流：`handleRequest`（`src/index.js`）路由 → `*ConfigBuilder` → `ProxyParser` → 输出 JSON / YAML。

**中间表示是 sing-box outbound 格式。** 所有 `*Parser`（ss / vmess / vless / hysteria2|hy2 / trojan / tuic）都产出 sing-box outbound 对象；Clash 输出靠 `ClashConfigBuilder.convertToClashProxy` 再转换一次。新增协议或字段需要同时改 Parser 和 `convertToClashProxy`。`HttpParser` 例外：它拉取远程订阅、base64 解码后返回**字符串数组**，由 `BaseConfigBuilder.parseCustomItems` 再逐行解析一层。

**Builder 模板方法**：`BaseConfigBuilder.build()` = `parseCustomItems` → `addCustomItems` → `addSelectors` → `formatConfig`。sing-box 的实现类名是 `ConfigBuilder`（不是 `SingboxConfigBuilder`）。两个 Builder 的 `addSelectors` 逻辑平行，硬编码了相同的策略组名：`🚀 节点选择`、`⚡ 自动选择`、`🐟 漏网之鱼`（兜底 final/MATCH），sing-box 额外有 `GLOBAL`。改组名或分组逻辑必须两边同步。

**规则系统**（`src/config.js`）：`UNIFIED_RULES` 是唯一数据源，每条规则的 `name`（英文，如 `"AI Services"`）是 `selectedRules` 参数里用的标识，`outbound`（带 emoji 的中文）是生成的策略组名。`PREDEFINED_RULE_SETS` 定义 `minimal` / `balanced` / `comprehensive` 预设。`generateRules` 生成规则列表，`pin=true` 时自定义规则置顶。sing-box 侧 `generateRuleSets` 把 site/ip 规则映射为远程 `.srs`（来源 `lyc8503/sing-box-rules`，ip 规则 tag 带 `-ip` 后缀）；Clash 侧直接输出 `GEOSITE,` / `GEOIP,` 规则。默认底板配置为 `SING_BOX_CONFIG` / `CLASH_CONFIG`，Builder 内部会 `DeepCopy`。

**路由**：
- `GET /`：返回内嵌 HTML 前端；订阅链接由前端 JS `submitForm` 在浏览器端拼出，不走后端
- `/singbox`、`/clash`：参数 `config`（换行分隔的节点或订阅 URL）、`selectedRules`（预设名或 JSON 数组）、`customRules`（JSON，字段 `site/ip/name/domain_suffix/domain_keyword/ip_cidr/protocol`，逗号分隔）、`pin`、`configId`
- `/xray`：拉取并合并订阅，输出 base64
- `/shorten`（旧，存完整 URL，`/s/:code` 跳转）、`/shorten-v2`（存 query string，`/b/` `/c/` `/x/` 分别跳转到 singbox / clash / xray）
- `POST /config`：保存自定义底板配置到 KV，key 为 `${type}_${8位随机}`，TTL 30 天；Clash 的 YAML 会先转成 JSON 存储。短链与配置共用同一个 KV 命名空间
- `POST /`：遗留的表单提交路径，前端已不使用（其 customRules 字段名为 `sites/ips/outbound`，与 `generateRules` 期望不一致，且拼接 `pin` 时缺 `&`）

## 注意事项

- 前端 HTML / CSS / 客户端 JS（`src/style.js`、`src/htmlBuilder.js`）全部是 Worker 端的**模板字符串**。在其中写客户端代码时，反引号、插值和 `</script>` 必须转义为 `` \` ``、`\${`、`<\/script>`，否则会在 Worker 端被求值或截断。`htmlBuilder.js` 里通过 `${JSON.stringify(PREDEFINED_RULE_SETS)}`、`${UNIFIED_RULES.map(...)}` 把服务端规则数据注入前端，改规则结构时要一并检查。
