# 自定义规则指南

为了满足用户的个性化例外需求，Sublink Worker 设计了双层分流规则：

---

## 1. 快捷规则 (Quick Rules)

针对大多数日常直连或拒绝需求，快捷规则采用精炼的表单设计：

- **动作 (Action)**：`直连 (DIRECT)` 或 `拒绝 (REJECT)`。
- **匹配类型 (Type)**：
  - `域名 (domain)`：精确匹配完整域名（Clash 映射为 `DOMAIN`，sing-box 映射为 `domain`）。
  - `域名后缀 (domain_suffix)`：匹配子域名与根域名（Clash 映射为 `DOMAIN-SUFFIX`，sing-box 映射为 `domain_suffix`）。
  - `IP 段 (ip_cidr)`：无类域间路由网段（Clash 映射为 `IP-CIDR`，sing-box 映射为 `ip_cidr`）。
- **智能输入支持**：
  - 多个值支持使用逗号、空格或回车分隔；
  - 复制粘贴带协议前缀的完整链接（如 `https://sublink.works/guide/quick-start`）会自动提取纯域名 `sublink.works`；
  - 输入单个 IPv4 地址（如 `1.1.1.1`）会自动补全掩码为 `1.1.1.1/32`。

---

## 2. 高级规则 (Advanced Rules)

高级规则隐藏在默认折叠的折叠面板中，适用于深度玩家：

- **自定义策略组**：出站字段支持任意文本。输入新名称（如 `🎮 亚服游戏`），后端 Builder 会自动在 Clash/sing-box 中动态创建同名的策略组，并注入所有可用节点；若出站填入 `DIRECT` 或 `REJECT`，则直接导向内核原生出站，不新建多余组。
- **Geo-Site / Geo-IP**：填写 Geo 规则名称（如 `openai`、`google` 等），前端输入时会自动发起合法性校验，拼写错误时立即标红预警。
- **域名关键词 (domain_keyword)**：包含特定字符串即匹配（Clash 对应 `DOMAIN-KEYWORD`，sing-box 对应 `domain_keyword`）。
- **协议类型 (protocol)**：针对特定协议（如 `QUIC`、`HTTP` 等）执行动作。

---

## 3. 置顶 (Pin) 机制

在自定义规则面板右上角提供「置顶」开关（默认开启）：
- **开启置顶**：自定义规则将排列在最终配置的规则列表最顶部，先于所有 18 个常规分类规则被内核评估。任何白名单或黑名单都能获得绝对最高的优先级。
- **关闭置顶**：自定义规则排在常规分类之后，作为分类分流的补充。
