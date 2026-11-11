# 规则分类

客户端按顺序从上往下匹配规则，**命中第一条就停止**。所以规则分类不仅决定"哪些流量单独分组"，它们的先后顺序也决定了优先级。

## 18 个分类

每个分类会生成一组规则和一个同名策略组。Clash 用 `GEOSITE` / `GEOIP` 规则引用分类名，sing-box 下载对应的远程规则集。

| 策略组 | 标识 | 域名分类（Geo-Site） | IP 分类（Geo-IP） | 默认 |
|---|---|---|---|---|
| `🛑 广告拦截` | `Ad Block` | `category-ads-all` | — | 拦截 |
| `💬 AI 服务` | `AI Services` | `openai` `anthropic` `jetbrains-ai` `perplexity` | — | |
| `📺 哔哩哔哩` | `Bilibili` | `bilibili` | — | |
| `📹 油管视频` | `Youtube` | `youtube` | — | |
| `🔍 谷歌服务` | `Google` | `google` | `google` | |
| `🏠 私有网络` | `Private` | — | `private` | 直连 |
| `🔒 国内服务` | `Location:CN` | `geolocation-cn` | `cn` | 直连 |
| `📲 电报消息` | `Telegram` | — | `telegram` | |
| `🐱 Github` | `Github` | `github` `gitlab` | — | |
| `☁️ 云服务` | `Cloud Services` | `aws` `azure` `digitalocean` `heroku` `dropbox` | — | |
| `Ⓜ️ 微软服务` | `Microsoft` | `microsoft` | — | 直连 |
| `🍏 苹果服务` | `Apple` | `apple` | — | 直连 |
| `🌐 社交媒体` | `Social Media` | `facebook` `instagram` `twitter` `tiktok` `linkedin` | — | |
| `🎬 流媒体` | `Streaming` | `netflix` `hulu` `disney` `hbo` `amazon` `bahamut` | — | |
| `🎮 游戏平台` | `Gaming` | `steam` `epicgames` `ea` `ubisoft` `blizzard` | — | |
| `📚 教育资源` | `Education` | `coursera` `edx` `udemy` `khanacademy` `category-scholar-!cn` | — | |
| `💰 金融服务` | `Financial` | `paypal` `visa` `mastercard` `stripe` `wise` | — | |
| `🌐 非中国` | `Non-China` | `geolocation-!cn` | — | |

- 表格按默认顺序排列。"标识"是订阅链接参数 `selectedRules` 中使用的名称。
- **默认**一列是该策略组导入客户端后默认选中的出站：直连即 `DIRECT`，拦截即 `REJECT`；空白表示默认跟随 `🚀 节点选择`（走代理）。默认项只是首选，组内其他选项仍可在客户端里手动切换，见[策略组](./groups)。
- 所有未命中的流量最后进入 `🐟 漏网之鱼`。

## 预设

| 预设 | 包含的分类 |
|---|---|
| 精简 | 私有网络、国内服务、非中国 |
| 均衡 | 精简 + AI 服务、油管视频、谷歌服务、电报消息 |
| 全面 | 全部 18 个分类 |

预设按表格中的固定顺序生成。在预设下点选卡片、拖动或使用推荐排序，会切换到"自定义"，并以当前预设为起点。显式点击"自定义"则恢复你上一次的自定义勾选与顺序。

## 排序原则

如果一个大分类排在它包含的小分类前面，小分类的流量会被大分类先截走，小分类的策略组就形同虚设。例如 `油管视频` 的域名几乎都在 `谷歌服务` 里，`谷歌服务` 一旦排在前面，YouTube 的流量就进不了 `📹 油管视频`。

所以：**越具体的分类越靠前，国内服务、非中国这类大合集放在最后。**

- 拖动卡片左侧的手柄调整顺序，卡片左上角的序号就是当前优先级。
- 卡片右上角显示该分类的域名数量，可以直观判断大小。

### 推荐排序

点击"推荐排序"，按以下规则重排：

1. 广告拦截放在最前，它横跨国内外，需要最先匹配；
2. 私有网络、电报消息这类只有 IP 规则的分类紧随其后，它们与域名分类互不冲突；
3. 其余分类按包含关系排序，被包含的排在前面；同一层按域名数从小到大，因此大合集自然落到最后。

推荐排序只调整顺序，不改变勾选。它与下面的冲突检测使用同一套判断，结果不会产生冲突。

## 在线分析与冲突提示

打开页面后，前端通过 `/api/geosite/:name` 获取每个分类的域名名单，在浏览器中计算每个分类的域名数，以及两两之间的覆盖比例。名单来自 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)，与 Clash（mihomo）使用的 `geosite.dat` 同源。

当已选分类 A 排在 B 后面，且同时满足以下条件时，会提示"A 有 N%（M 个）的域名会先被 B 截走"，并提供"移到 B 前面"的按钮：

- A 被 B 覆盖的比例**高于** B 被 A 覆盖的比例，也就是 B 才是包含的一方。云服务与微软这类只是共享一部分域名（Azure）的情况不会提示；
- 覆盖比例达到 **20%**，或者被截走的域名达到 **150 个**。后一个条件用于广告拦截这类横跨国内外、比例不高但数量很大的分类。

只有 IP 规则的分类（私有网络、电报消息）没有域名数据，不参与分析。
