# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库现状

仓库只有一个文件 `worker.js`：上游 sublink-worker 的 esbuild 打包产物（IIFE，末尾引用了不存在的 `index.js.map`）。没有 `src/`、`package.json`、`wrangler.toml`、测试和 lint 配置，**所有修改都直接改 `worker.js`**。文件内用 `// src/xxx.js` 注释划分原始模块边界，可用 `grep -n '^  // ' worker.js` 快速定位。

- 语法检查：`node --check worker.js`（仓库内唯一可用的校验手段）
- 运行环境：Cloudflare Workers，**Service Worker 格式**（`addEventListener("fetch", ...)`，非 ES module `export default`）
- 依赖绑定：全局 KV 变量 `SUBLINK_KV`，不绑定则所有短链 / 自定义配置接口直接抛错
- 唯一的第三方依赖是内联的 js-yaml 4.1.0（`js_yaml_default`），不要去动这段

## 架构

请求流：`handleRequest`（`src/index.js` 段）路由 → `*ConfigBuilder` → `ProxyParser` → 输出 JSON / YAML。

**中间表示是 sing-box outbound 格式。** 所有 `*Parser`（ss / vmess / vless / hysteria2|hy2 / trojan / tuic）都产出 sing-box outbound 对象；Clash 输出靠 `ClashConfigBuilder.convertToClashProxy` 再转换一次。新增协议或字段需要同时改 Parser 和 `convertToClashProxy`。`HttpParser` 例外：它拉取远程订阅、base64 解码后返回**字符串数组**，由 `BaseConfigBuilder.parseCustomItems` 再逐行解析一层。

**Builder 模板方法**：`BaseConfigBuilder.build()` = `parseCustomItems` → `addCustomItems` → `addSelectors` → `formatConfig`。sing-box 的实现类名是 `ConfigBuilder`（不是 `SingboxConfigBuilder`）。两个 Builder 的 `addSelectors` 逻辑平行，硬编码了相同的策略组名：`🚀 节点选择`、`⚡ 自动选择`、`🐟 漏网之鱼`（兜底 final/MATCH），sing-box 额外有 `GLOBAL`。改组名或分组逻辑必须两边同步。

**规则系统**（`src/config.js` 段）：`UNIFIED_RULES` 是唯一数据源，每条规则的 `name`（英文，如 `"AI Services"`）是 `selectedRules` 参数里用的标识，`outbound`（带 emoji 的中文）是生成的策略组名。`PREDEFINED_RULE_SETS` 定义 `minimal` / `balanced` / `comprehensive` 预设。`generateRules` 生成规则列表，`pin=true` 时自定义规则置顶。sing-box 侧 `generateRuleSets` 把 site/ip 规则映射为远程 `.srs`（来源 `lyc8503/sing-box-rules`，ip 规则 tag 带 `-ip` 后缀）；Clash 侧直接输出 `GEOSITE,` / `GEOIP,` 规则。默认底板配置为 `SING_BOX_CONFIG` / `CLASH_CONFIG`，Builder 内部会 `DeepCopy`。

**路由**：
- `GET /`：返回内嵌 HTML 前端；订阅链接由前端 JS `submitForm` 在浏览器端拼出，不走后端
- `/singbox`、`/clash`：参数 `config`（换行分隔的节点或订阅 URL）、`selectedRules`（预设名或 JSON 数组）、`customRules`（JSON，字段 `site/ip/name/domain_suffix/domain_keyword/ip_cidr/protocol`，逗号分隔）、`pin`、`configId`
- `/xray`：拉取并合并订阅，输出 base64
- `/shorten`（旧，存完整 URL，`/s/:code` 跳转）、`/shorten-v2`（存 query string，`/b/` `/c/` `/x/` 分别跳转到 singbox / clash / xray）
- `POST /config`：保存自定义底板配置到 KV，key 为 `${type}_${8位随机}`，TTL 30 天；Clash 的 YAML 会先转成 JSON 存储。短链与配置共用同一个 KV 命名空间
- `POST /`：遗留的表单提交路径，前端已不使用（其 customRules 字段名为 `sites/ips/outbound`，与 `generateRules` 期望不一致，且拼接 `pin` 时缺 `&`）

## 编辑 `worker.js` 的注意事项

- 前端 HTML / CSS / 客户端 JS（`src/style.js`、`src/htmlBuilder.js` 段）全部是**模板字符串**。在其中写客户端代码时，反引号和插值必须转义为 `` \` `` 和 `\${`，否则会在 Worker 端被求值或截断字符串。
- esbuild 把非 ASCII 字符转成了 `\uXXXX` / `\u{XXXXX}` 转义，搜索中文或 emoji 时要搜转义形式（例如 `漏网之鱼` → `\u6F0F\u7F51\u4E4B\u9C7C`）。新写的代码直接用原字符也可以，保持同一处风格一致即可。
- 每个函数 / 类后面跟着 `__name(X, "X")`，新增顶层函数时沿用这个写法。
