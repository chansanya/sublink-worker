# 常见问题

## 客户端更新订阅失败

先把订阅链接（或短链）直接粘贴到浏览器打开，看 Worker 返回了什么：

| 返回 | 原因 |
|---|---|
| `Missing config parameter` | 链接里没有节点，或节点内容为空 |
| `Internal Server Error` | 生成过程中出错，常见于节点链接格式异常 |
| `Short URL not found` | 旧版 `/s/` 短链不存在 |
| 跳转到 `…/clashnull`、`…/singboxnull` 一类地址 | `/c/` `/b/` `/x/` 短链的路径不存在。这是从原项目沿用的行为，此时不会返回 404 |

另外检查：

- 机场是否限制了 Cloudflare 的出口 IP。如果 Worker 拉取订阅超时，可以直接粘贴节点链接，而不是订阅地址。

## `*.workers.dev` 打不开

部分网络无法访问 `workers.dev` 域名，在 Cloudflare 控制台为 Worker 绑定自己的域名即可。

## 为什么有些分组默认直连

哔哩哔哩、私有网络、国内服务、苹果、微软五个分组默认选中 `DIRECT`：局域网设备、国内网站（含哔哩哔哩），以及苹果、微软在国内有节点的服务，直连通常更快也更稳定。组内仍然保留节点选项，可以在客户端里随时切换。

广告拦截默认选中 `REJECT`。它使用的 `category-ads-all` 名单也包含 Sentry、Segment 等统计服务的完整域名，如果你需要访问其中某个服务，添加一条置顶的快捷规则（直连 + 域名后缀，例如 `sentry.io`）即可放行。

## 改了规则后要更换订阅地址吗

不需要。用之前的短链路径再生成一次短链，内容会被覆盖，客户端下次更新订阅即可拿到新配置。见[订阅链接与短链](./links#用同一路径更新)。

## 客户端里手动选的节点，重启后变回去了

Clash 系客户端需要开启 `profile.store-selected`（在客户端设置中通常叫"记住选择"之类的选项）。sing-box 的配置已开启 `cache_file`，会记住选择。见[策略组](./groups#手动选择会被记住吗)。

## Geo-Site 名称怎么查

可用的分类名就是 [v2fly/domain-list-community](https://github.com/v2fly/domain-list-community/tree/master/data) 中 `data/` 目录下的文件名。在高级规则里填写后，页面会在线检查名称是否存在；不存在的名称会标红，因为 sing-box 下载对应规则集失败会导致整份配置无法加载。

## 为什么去掉了原项目的"底板配置"

原项目（[7Sageer/sublink-worker](https://github.com/7Sageer/sublink-worker)，本项目由它派生，现已各自独立演进）允许保存一份自定义的 Clash / sing-box 模板（`POST /config` + `configId`），实际使用中问题较多：

- `configId` 同时拼进所有订阅链接，但服务端不检查类型，保存 Clash 模板后 sing-box 链接会报 500，反之亦然；
- 模板缺少必需字段时同样报 500；
- 模板 30 天后过期，过期后订阅悄悄退回默认模板，客户端没有任何提示；
- 端口、TUN 等设置大多会被客户端自身的设置覆盖。

旧链接里的 `configId` 参数现在会被忽略，链接照常可用。
