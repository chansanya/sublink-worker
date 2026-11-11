# Sublink Worker

把节点链接或机场订阅转换成 Clash、sing-box、Xray 配置的 Cloudflare Worker，自带规则分类、自定义规则、实时预览和短链。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chansanya/sublink-worker)

## 功能

- 支持 `ss://` `vmess://` `vless://` `trojan://` `hysteria2://` `tuic://` 节点链接和 `http(s)://` 订阅地址，可混填多行
- 18 个规则分类（广告拦截、AI 服务、国内服务、非中国等），三档预设或自由勾选，可拖动调整匹配优先级
- 在线分析：显示每个分类的域名数；大分类排在它包含的小分类前面时提示被截走的比例，一键修正；自定义规则里填错的 Geo-Site 名称直接标红
- 自定义规则：一行选「直连 / 拒绝」+「域名 / 域名后缀 / IP 段」，填多个值即可，默认置顶（排在所有分类规则之前）；需要自定义出站、Geo-Site / Geo-IP、关键词、协议时展开「高级规则」
- 实时预览：右侧抽屉显示生成的配置文件，高亮变化行，按段落跳转；抽屉默认收起，可随时打开
- 推荐排序：一键按包含关系与分类规模排好匹配优先级
- 订阅短链（可自定义路径，配置改动后原路径覆盖更新）、二维码

## 一键部署

点上面的按钮，Cloudflare 会把本仓库复制到你的 GitHub / GitLab 账号，自动创建所需的 KV namespace 并部署。之后向你的仓库推送即自动重新部署。

## 手动部署

```bash
npm install
npx wrangler login
npm run deploy     # 首次部署会自动创建并绑定 SUBLINK_KV
```

[wrangler.jsonc](wrangler.jsonc) 中的 KV 绑定没有写 `id`，由 wrangler（需 4.45 及以上）在部署时自动创建。如果你想复用已有的 namespace，把它的 `id` 填到绑定里即可。

## 本地运行

```bash
npm install
npm run dev        # http://localhost:8787
```

本地使用模拟 KV（数据在 `.wrangler/state`），不需要真实的 namespace id。

## 使用

1. 粘贴节点链接或订阅地址，每行一条。
2. 点开「高级选项」（可选），选择规则预设或点选分类卡片、拖动调整顺序。
3. 需要例外时添加自定义规则，例如：「直连」+「域名后缀」，填 `example.com`（默认置顶，优先于分类规则）。
4. 点击「生成订阅」，复制订阅链接；或填一个短链路径生成固定短链，让所有客户端订阅同一个地址。

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

在线文档：<https://chansanya.github.io/sublink-worker/>（VitePress，由 GitHub Actions 构建后发布到 `gh-pages` 分支，与 Cloudflare 部署相互独立）

- [快速开始与部署指南](docs/guide/quick-start.md)：一键部署、Wrangler 手动部署与本地运行
- [规则分类](docs/guide/rules.md)：18 个分类、预设、拖动与推荐排序、在线冲突提示
- [自定义规则](docs/guide/custom-rules.md)：快捷直连 / 拒绝与高级出站规则
- [订阅链接与短链](docs/guide/links.md)：三种订阅格式、固定短链与二维码
- [策略组](docs/guide/groups.md)：节点选择、自动选择与各组成员
- [API](docs/api.md)：`/clash`、`/singbox`、`/xray` 与短链接口
- [Clash（mihomo）配置文件详解](docs/guide/clash-config.md)：逐字段解释客户端配置及对应的项目代码
- [常见问题](docs/guide/faq.md)

本地预览文档：

```bash
cd docs
npm install
npm run dev
```

## 致谢

本项目最初派生自 [7Sageer/sublink-worker](https://github.com/7Sageer/sublink-worker)，感谢原作者的工作。目前两个项目已各自独立演进，代码、功能与文档均不再同步，沿用 [MIT 许可证](LICENSE)。
