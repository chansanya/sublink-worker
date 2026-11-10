# Sublink Worker

把节点链接或机场订阅转换成 Clash、sing-box、Xray 配置的 Cloudflare Worker，自带规则分类、自定义规则、实时预览和短链。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chansanya/sublink-worker)

## 功能

- 支持 `ss://` `vmess://` `vless://` `trojan://` `hysteria2://` `tuic://` 节点链接和 `http(s)://` 订阅地址，可混填多行
- 18 个规则分类（广告拦截、AI 服务、国内服务、非中国等），三档预设或自由勾选，可拖动调整匹配优先级
- 在线分析：显示每个分类的域名数；大分类排在它包含的小分类前面时提示被截走的比例，一键修正；自定义规则里填错的 Geo-Site 名称直接标红
- 自定义规则：Geo-Site / Geo-IP / 域名后缀 / 关键词 / IP CIDR / 协议，默认置顶（排在所有分类规则之前）；出站填 `DIRECT` / `REJECT` 时直接直连 / 拒绝
- 编辑即预览：右侧抽屉实时显示生成的配置文件，高亮变化行，按段落跳转；抽屉可随时收起
- 推荐排序：一键按包含关系与分类规模排好匹配优先级
- 订阅短链（可自定义路径，配置改动后原路径覆盖更新）、二维码

## 一键部署

点上面的按钮，Cloudflare 会把本仓库复制到你的 GitHub / GitLab 账号，自动创建所需的 KV namespace 并部署。之后向你的仓库推送即自动重新部署。

## 手动部署

```bash
npm install
npx wrangler login
npx wrangler kv namespace create SUBLINK_KV   # 记下输出的 id
```

把 id 填进 [wrangler.jsonc](wrangler.jsonc) 的 `kv_namespaces`，替换占位值，然后：

```bash
npm run deploy
```

## 本地运行

```bash
npm install
npm run dev        # http://localhost:8787
```

本地使用模拟 KV（数据在 `.wrangler/state`），不需要真实的 namespace id。

## 使用

1. 粘贴节点链接或订阅地址，每行一条。
2. 选择规则预设，或点选分类卡片自定义。
3. 需要例外时添加自定义规则，例如：出站 `DIRECT`，域名后缀 `example.com`（默认置顶，优先于分类规则）。
4. 右侧实时预览生成结果；复制订阅链接，或填一个短链路径生成固定短链，让所有客户端订阅同一个地址。

## 接口

| 路径 | 说明 |
|---|---|
| `/clash?config=…&selectedRules=…&customRules=…&pin=…` | Clash YAML |
| `/singbox?…` | sing-box JSON，参数同上 |
| `/xray?config=…` | 合并后的节点列表，base64 |
| `/c/:code` `/b/:code` `/x/:code` | 短链，分别跳转到上面三种 |
| `GET /api/rules` | 规则分类与预设 |
| `GET /api/geosite/:name` | 分类的域名名单（来自 MetaCubeX，已展开，缓存 1 天） |

## 文档

- [Clash（mihomo）配置文件详解](docs/clash-config-guide.md)：逐字段解释客户端配置，以及各部分由本项目哪段代码生成

## 致谢

基于 [7Sageer/sublink-worker](https://github.com/7Sageer/sublink-worker) 重构，沿用 [MIT 许可证](LICENSE)。
