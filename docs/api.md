# API

所有接口都是 `GET` 请求，参数放在查询字符串里，需要 URL 编码。

## 生成配置

### `/clash` 与 `/singbox`

| 接口 | 返回 | Content-Type |
|---|---|---|
| `/clash` | Clash（mihomo）YAML 配置 | `text/yaml; charset=utf-8` |
| `/singbox` | sing-box JSON 配置 | `application/json; charset=utf-8` |

| 参数 | 必填 | 说明 |
|---|---|---|
| `config` | 是 | 节点链接或 `http(s)://` 订阅地址，多个用换行分隔 |
| `selectedRules` | 否 | 预设名（`minimal` / `balanced` / `comprehensive`），或 JSON 数组形式的分类标识，例如 `["Google","Location:CN"]`。数组按给出的顺序生成规则；缺省或无法解析时使用 `minimal` |
| `customRules` | 否 | JSON 数组形式的自定义规则，见下文 |
| `pin` | 否 | `true` 时自定义规则排在分类规则之前 |
| `name` | 否 | 订阅名，客户端导入时显示的配置名，默认 `Sublink`，最长 64 个字符。通过响应头 `Content-Disposition` 与 `profile-title` 返回，非 ASCII 名称分别用 `filename*=UTF-8''` 和 `base64:` 前缀编码 |

分类标识见[规则分类](./guide/rules#_18-个分类)。缺少 `config` 时返回 `400 Missing config parameter`。

#### customRules

每条规则是一个对象，所有字段都是字符串，多个值用逗号分隔：

| 字段 | 对应规则 |
|---|---|
| `name` | 出站。`DIRECT` / `REJECT` 直接指向内置出站；其他名称会新建同名策略组 |
| `domain` | 完整域名（Clash `DOMAIN`，sing-box `domain`），可省略 |
| `domain_suffix` | 域名后缀 |
| `domain_keyword` | 域名关键词 |
| `ip_cidr` | IP 段 |
| `site` | Geo-Site 分类名 |
| `ip` | Geo-IP 分类名 |
| `protocol` | 协议，仅 sing-box 生效 |

```json
[
  { "site": "", "ip": "", "name": "DIRECT", "domain_suffix": "example.com", "domain_keyword": "", "ip_cidr": "10.0.0.0/8", "protocol": "" }
]
```

### `/xray`

| 参数 | 必填 | 说明 |
|---|---|---|
| `config` | 是 | 同上 |

拉取其中的订阅并与节点链接合并，返回 Base64 编码的节点列表（每行一个节点）。响应的 Content-Type 为 `application/json; charset=utf-8`，这是沿用上游的行为，内容本身是纯文本 Base64。

## 短链

| 接口 | 说明 |
|---|---|
| `/shorten-v2?url=<订阅链接>&shortCode=<路径>` | 保存 `url` 的查询参数，返回纯文本路径。`shortCode` 省略时随机生成 7 位；已存在的路径会被覆盖 |
| `/c/:code` | 302 跳转到 `/clash?<保存的参数>` |
| `/b/:code` | 302 跳转到 `/singbox?<保存的参数>` |
| `/x/:code` | 302 跳转到 `/xray?<保存的参数>` |
| `/shorten?url=<完整链接>` | 旧版接口：保存完整链接，返回 `{"shortUrl": ".../s/<code>"}` |
| `/s/:code` | 旧版接口：302 跳转到保存的完整链接，不存在时返回 `404 Short URL not found` |

短链存储在 KV 中，不设过期时间。

## 前端辅助接口

| 接口 | 说明 |
|---|---|
| `/api/rules` | 返回 `{ rules, presets }`：每个分类的 `name`、`outbound`、`site_rules`、`default_outbound`，以及三个预设包含的分类 |
| `/api/geosite/:name` | 返回 MetaCubeX 中该分类已展开的纯文本域名名单（`+.` 开头为后缀，其余为完整域名），边缘缓存 1 天；分类不存在返回 404，名称不合法返回 400 |
