# API 接口参考

Sublink Worker 提供了基于标准 HTTP GET 的开放 API 接口，兼容任意订阅管理客户端或自动化脚本。

---

## 1. 订阅配置生成端点

### `GET /clash`
将传入的节点与规则生成标准 Clash (mihomo) YAML 格式。

**返回头**：`content-type: text/yaml; charset=utf-8`

**查询参数**：
- `config`（必须）：换行分隔的节点链接或机场订阅 URL。
- `selectedRules`：预设名（`minimal` / `balanced` / `comprehensive`）或 JSON 序列化的分类英文名数组。
- `customRules`：JSON 序列化的自定义规则对象数组。
- `pin`：`true` 或 `false`，控制自定义规则是否置顶。

**示例**：
```http
GET /clash?config=vless%3A%2F%2F...&selectedRules=balanced&pin=true
```

---

### `GET /singbox`
将传入的节点与规则生成 sing-box 1.8+ 标准 JSON 配置。

**返回头**：`content-type: application/json; charset=utf-8`

**查询参数**：与 `/clash` 完全一致。

---

### `GET /xray`
抓取并合并所有给定的订阅链接与节点，输出标准的 base64 聚合节点列表。

**返回头**：`content-type: application/json; charset=utf-8`

**查询参数**：
- `config`（必须）：换行分隔的节点链接或订阅地址。

---

## 2. 短链服务端点

### `GET /shorten-v2`
将长链接提取参数并写入 KV 存储。

**查询参数**：
- `url`（必须）：待压缩的完整订阅 URL。
- `shortCode`（可选）：自定义短链路径。若不提供则随机生成 8 位英数短码。

**返回值**：纯文本短码（HTTP 200）。

---

### 短链跳转路由
根据短码自动跳转到对应客户端的完整输出端点（HTTP 302）：
- `GET /c/:code`：重定向至 `/clash?{params}`
- `GET /b/:code`：重定向至 `/singbox?{params}`
- `GET /x/:code`：重定向至 `/xray?{params}`
- `GET /s/:code`：（旧版兼容）跳转至保存的原始长 URL

---

## 3. 元数据辅助接口

- `GET /api/rules`：获取当前 Worker 支持的所有 18 个规则分类的元数据，包含其名称、映射出站、Site 规则定义及默认出站动作。
- `GET /api/geosite/:name`：代理并缓存 MetaCubeX 的展开纯文本域名列表，用于前端实时计算分类包含度与规模。
