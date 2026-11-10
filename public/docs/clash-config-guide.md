# Clash（mihomo）配置文件详解

以 FlClash 运行时导出的完整配置为样本，逐段说明各字段的作用、来源，以及与本项目（sublink-worker）的对应关系。

> 字段语义以 mihomo 官方文档为准：https://wiki.metacubex.one/config/ 。下文样本中的节点凭据（UUID、服务器 IP、公钥）已替换为占位符。

---

## 目录

1. [整体结构与流量走向](#1-整体结构与流量走向)
2. [字段来源：订阅 vs 客户端](#2-字段来源订阅-vs-客户端)
3. [入站：流量从哪里进来](#3-入站流量从哪里进来)
4. [全局行为](#4-全局行为)
5. [外部控制与面板](#5-外部控制与面板)
6. [GEO 数据库](#6-geo-数据库)
7. [proxies：节点](#7-proxies节点)
8. [proxy-groups：策略组](#8-proxy-groups策略组)
9. [rules：分流规则](#9-rules分流规则)
10. [dns：域名解析](#10-dns域名解析)
11. [tun：虚拟网卡](#11-tun虚拟网卡)
12. [sniffer：域名嗅探](#12-sniffer域名嗅探)
13. [其余字段](#13-其余字段)
14. [与 sublink-worker 的对应关系](#14-与-sublink-worker-的对应关系)
15. [问题与建议](#15-问题与建议)

---

## 1. 整体结构与流量走向

一份 Clash 配置本质上回答三个问题：**流量从哪进来、怎么解析域名、最终走哪条路**。

```
应用程序发起连接
  │
  ├─ 系统代理 / 浏览器插件 ──→ mixed-port 7890
  └─ 不认代理的程序 ─────────→ TUN 虚拟网卡（接管全部流量）
  │
  ▼
DNS（fake-ip）：先返回 198.18.x.x 假 IP，记住"假 IP ↔ 域名"映射
  │
  ▼
rules 自上而下匹配，命中第一条即停止
  │
  ▼
proxy-groups 策略组（如 🔒 国内服务）
  │
  ▼
最终出口：某个节点（proxies） / DIRECT 直连 / REJECT 拒绝
```

顶层字段大致分为：

| 分类 | 字段 |
|---|---|
| 入站 | `port` `socks-port` `mixed-port` `redir-port` `tproxy-port` `allow-lan` `tun` `listeners` 等 |
| 全局行为 | `mode` `log-level` `ipv6` `unified-delay` `tcp-concurrent` 等 |
| 出站与分流 | `proxies` `proxy-groups` `rules` `proxy-providers` `rule-providers` `sub-rules` |
| 解析 | `dns` `hosts` |
| 辅助功能 | `sniffer` `ntp` `geox-url` `profile` `experimental` 等 |

---

## 2. 字段来源：订阅 vs 客户端

FlClash 的工作方式：**下载订阅文件 → 用客户端自身设置覆盖/补全 → 交给 mihomo 内核运行**。导出的配置是合并后的结果，所以比订阅原文多得多。

| 来源 | 字段 |
|---|---|
| **订阅（本项目生成）** | `proxies`、`proxy-groups`、`rules`，以及 `dns` 中的 `nameserver`、`proxy-server-nameserver`、`nameserver-policy`、`enhanced-mode`、`respect-rules` |
| **订阅提供、但被 FlClash 覆盖** | 端口（订阅给的是 `port: 7890` + `socks-port: 7891`）、`allow-lan`、`log-level`、`mode` |
| **FlClash 补充** | `tun`、`global-ua`、`unified-delay`、`tcp-concurrent`、`geox-url`、`sniffer`、`ntp`、DNS 中其余字段，以及所有值为 0 / 空 / null 的默认项 |
| **用户手动覆写** | `rules` 顶部的两条 `DOMAIN-SUFFIX,...,DIRECT` |

结论：**写进订阅能对所有客户端生效的，主要是节点、策略组和规则**。端口、TUN、局域网这类本机设置由客户端决定，写进订阅也会被覆盖。

---

## 3. 入站：流量从哪里进来

```yaml
port: 0
socks-port: 0
redir-port: 0
tproxy-port: 0
mixed-port: 7890
```

| 字段 | 说明 |
|---|---|
| `mixed-port` | HTTP + SOCKS5 混合端口。系统代理、浏览器插件、命令行 `http_proxy` 都连这里 |
| `port` | 纯 HTTP 代理端口，0 = 关闭 |
| `socks-port` | 纯 SOCKS5 端口，0 = 关闭 |
| `redir-port` | 透明代理（Linux iptables REDIRECT / macOS pf），0 = 关闭 |
| `tproxy-port` | 透明代理（Linux TPROXY，支持 UDP），0 = 关闭 |
| `ss-config` / `vmess-config` | 内置 Shadowsocks / VMess 入站，空 = 关闭 |
| `inbound-tfo` / `inbound-mptcp` | 入站启用 TCP Fast Open / Multipath TCP |

### 局域网访问与认证

```yaml
allow-lan: true
bind-address: "*"
lan-allowed-ips: ["0.0.0.0/0", "::/0"]
lan-disallowed-ips: null
authentication: []
skip-auth-prefixes: []
```

| 字段 | 说明 |
|---|---|
| `allow-lan` | 是否允许其他设备连接本机代理端口 |
| `bind-address` | 监听地址，`*` = 所有网卡 |
| `lan-allowed-ips` | 允许连接的来源 IP 段，当前为全部放行 |
| `lan-disallowed-ips` | 禁止连接的来源 IP 段 |
| `authentication` | 代理账号，格式 `"user:pass"`，空 = 无需认证 |
| `skip-auth-prefixes` | 免认证的来源 IP 段 |

---

## 4. 全局行为

```yaml
mode: "rule"
log-level: "error"
ipv6: false
unified-delay: true
tcp-concurrent: true
find-process-mode: "off"
global-client-fingerprint: ""
global-ua: "FlClash/v0.8.97 clash-verge Platform/windows"
etag-support: true
keep-alive-idle: 0
keep-alive-interval: 30
disable-keep-alive: false
interface-name: ""
routing-mark: 0
tunnels: null
```

| 字段 | 说明 |
|---|---|
| `mode` | `rule` 按规则分流；`global` 全部走 GLOBAL 组；`direct` 全部直连 |
| `log-level` | `silent` / `error` / `warning` / `info` / `debug` |
| `ipv6` | 全局 IPv6 开关。false 时不会建立 IPv6 连接 |
| `unified-delay` | 测延迟时扣除握手耗时，让不同协议的节点延迟可比 |
| `tcp-concurrent` | 域名解析出多个 IP 时并发连接，用最先成功的那个 |
| `find-process-mode` | 进程匹配：`always` / `strict` / `off`。off 时 `PROCESS-NAME` 类规则无效 |
| `global-client-fingerprint` | 所有节点默认的 uTLS 指纹，空 = 由节点自己指定 |
| `global-ua` | 下载订阅、provider、GEO 文件时使用的 User-Agent |
| `etag-support` | 下载远程资源时使用 ETag，未变化则不重复下载 |
| `keep-alive-interval` | TCP Keep-Alive 间隔（秒），移动端调大可省电 |
| `keep-alive-idle` / `disable-keep-alive` | Keep-Alive 空闲时间 / 总开关 |
| `interface-name` | 出站绑定的网卡，空 = 自动 |
| `routing-mark` | Linux 出站 fwmark，配合策略路由使用 |
| `tunnels` | 端口转发（本地端口 → 经代理 → 远端地址） |

---

## 5. 外部控制与面板

```yaml
external-controller: ""
external-controller-tls: ""
external-controller-unix: ""
external-controller-pipe: ""
external-controller-cors:
  allow-origins: ["*"]
  allow-private-network: true
external-ui: ""
external-ui-url: ""
external-ui-name: ""
external-doh-server: ""
secret: ""
```

mihomo 提供 RESTful API，Web 面板（如 metacubexd、yacd）通过它切换节点、查看连接。

| 字段 | 说明 |
|---|---|
| `external-controller` | API 监听地址，如 `127.0.0.1:9090`。空 = 关闭（FlClash 用内部通道控制内核） |
| `external-controller-tls` / `-unix` / `-pipe` | 以 HTTPS / Unix socket / Windows 命名管道方式提供 API |
| `external-controller-cors` | 跨域策略 |
| `external-ui` / `-url` / `-name` | 本地面板目录 / 自动下载地址 / 目录名 |
| `external-doh-server` | 在 API 上暴露 DoH 服务的路径 |
| `secret` | API 访问密钥。开启 API 时务必设置 |

---

## 6. GEO 数据库

```yaml
geodata-mode: false
geodata-loader: "memconservative"
geosite-matcher: ""
geo-auto-update: false
geo-update-interval: 24
geox-url:
  mmdb: ".../geoip.metadb"
  asn: ".../GeoLite2-ASN.mmdb"
  geoip: ".../geoip.dat"
  geosite: ".../geosite.dat"
```

`GEOSITE` / `GEOIP` 规则依赖这些数据库判断"某域名 / IP 属于哪一类"。

| 字段 | 说明 |
|---|---|
| `geodata-mode` | false = GEOIP 使用 `mmdb` 格式；true = 使用 `geoip.dat` |
| `geodata-loader` | `standard` 或 `memconservative`（省内存，适合低配设备） |
| `geosite-matcher` | GEOSITE 匹配器实现，空 = 内核默认 |
| `geo-auto-update` / `geo-update-interval` | 是否定时更新 / 间隔（小时）。当前关闭，数据库不会自动更新 |
| `geox-url` | 各数据库下载地址（MetaCubeX meta-rules-dat） |

---

## 7. proxies：节点

```yaml
proxies:
  - name: "NET"
    type: "vless"
    server: "<服务器IP>"
    port: 30001
    uuid: "<UUID>"
    network: "tcp"
    tls: true
    servername: "yahoo.com"
    client-fingerprint: "chrome"
    reality-opts:
      public-key: "<公钥>"
      short-id: "e2"
    skip-cert-verify: false
    tfo: false
```

| 字段 | 说明 |
|---|---|
| `name` | 节点名，策略组和规则通过它引用，必须唯一 |
| `type` | 协议：`ss` / `vmess` / `vless` / `trojan` / `hysteria2` / `tuic` 等 |
| `server` / `port` | 服务器地址与端口 |
| `uuid` | VLESS 用户 ID，相当于密码 |
| `network` | 传输层：`tcp` / `ws` / `grpc` / `h2` 等 |
| `tls` | 是否启用 TLS（REALITY 也要求为 true） |
| `servername` | TLS SNI。REALITY 下是伪装目标站点，流量看起来像在访问 `yahoo.com` |
| `client-fingerprint` | uTLS 指纹，模拟 Chrome 的 TLS 握手特征，REALITY 必填 |
| `reality-opts.public-key` | 服务端 REALITY 公钥 |
| `reality-opts.short-id` | 服务端配置的 short ID 之一 |
| `skip-cert-verify` | 跳过证书校验。REALITY 不走常规证书验证，此项无实际影响 |
| `tfo` | 出站 TCP Fast Open |

**REALITY 原理简述**：客户端以 `servername` 指定的真实网站身份发起 TLS 握手，服务端用私钥识别出合法客户端后转为代理通道；非法探测则被转发到真实网站，因此很难被识别。

---

## 8. proxy-groups：策略组

策略组是客户端界面上"可以点选"的分组，**规则指向策略组，策略组再指向节点或其他策略组**。

```yaml
proxy-groups:
  - name: "🚀 节点选择"
    type: "select"
    proxies: ["DIRECT", "REJECT", "⚡ 自动选择", "NET"]

  - name: "⚡ 自动选择"
    type: "url-test"
    proxies: ["NET"]
    url: "https://www.gstatic.com/generate_204"
    interval: 300
    lazy: false

  - name: "🔒 国内服务"
    type: "select"
    proxies: ["🚀 节点选择", "DIRECT", "REJECT", "⚡ 自动选择", "NET"]
  # 🏠 私有网络 / 🌐 非中国 / 🐟 漏网之鱼 结构相同
```

### 类型

| type | 行为 |
|---|---|
| `select` | 手动选择，默认选列表第一项 |
| `url-test` | 定时测速，自动选延迟最低的 |
| `fallback` | 按顺序选第一个可用的 |
| `load-balance` | 负载均衡 |

### url-test 参数

| 字段 | 说明 |
|---|---|
| `url` | 测速地址，返回 HTTP 204 的轻量接口 |
| `interval` | 测速间隔（秒） |
| `lazy` | true = 该组未被使用时不测速；false = 始终测速 |

### 嵌套关系

```
🌐 非中国 ─┬─ 🚀 节点选择 ─┬─ DIRECT
           │               ├─ REJECT
           │               ├─ ⚡ 自动选择 ── NET（自动测速）
           │               └─ NET
           ├─ DIRECT
           └─ ...
```

`select` 组默认选中列表第一项。业务组默认跟随 `🚀 节点选择`，所以只切换总开关就能控制大部分流量；需要例外时再单独切换业务组。

> 样本中 `🏠 私有网络`、`🔒 国内服务` 首项为 `🚀 节点选择`。本项目现已调整为这两个组首项为 `DIRECT`（默认直连），其余成员不变，仍可手动切回代理。
>
> 样本中 `🚀 节点选择` 首项为 `DIRECT`，导致新客户端开箱全部直连。本项目现已调整为首项 `⚡ 自动选择`，订阅后默认走代理。
>
> 本项目生成的策略组中，`REJECT` 只出现在 `🛑 广告拦截` 和自定义出站组里，其余分类组、`🚀 节点选择`、`🐟 漏网之鱼` 都不提供拒绝选项。

`DIRECT`、`REJECT` 是内核内置出站，无需在 `proxies` 中定义，**也不能被策略组重名占用**。

---

## 9. rules：分流规则

```yaml
rules:
  - "DOMAIN-SUFFIX,haveways.com,DIRECT"
  - "DOMAIN-SUFFIX,10085.fun,DIRECT"
  - "GEOIP,private,🏠 私有网络"
  - "GEOSITE,geolocation-cn,🔒 国内服务"
  - "GEOIP,cn,🔒 国内服务"
  - "GEOSITE,geolocation-!cn,🌐 非中国"
  - "MATCH,🐟 漏网之鱼"
```

### 语法

```
类型,匹配内容,出站[,附加参数]
```

出站可以是策略组名、节点名、`DIRECT` 或 `REJECT`。

### 匹配顺序

**自上而下，命中第一条立即停止**。因此：

- 越具体的规则越靠前（如单个域名直连）；
- 越宽泛的规则越靠后；
- `MATCH` 必须放最后，兜底所有未命中的流量。

### 样本规则逐条解读

| 规则 | 含义 |
|---|---|
| `DOMAIN-SUFFIX,haveways.com,DIRECT` | `haveways.com` 及其所有子域名直连 |
| `GEOIP,private,🏠 私有网络` | 目标为内网 IP（192.168.0.0/16、10.0.0.0/8 等） |
| `GEOSITE,geolocation-cn,🔒 国内服务` | 域名在"国内网站"列表中 |
| `GEOIP,cn,🔒 国内服务` | 目标 IP 属于中国大陆 |
| `GEOSITE,geolocation-!cn,🌐 非中国` | 域名在"境外网站"列表中 |
| `MATCH,🐟 漏网之鱼` | 以上都未命中 |

### 常用规则类型

| 类型 | 示例 | 说明 |
|---|---|---|
| `DOMAIN` | `DOMAIN,www.google.com,X` | 完整域名精确匹配 |
| `DOMAIN-SUFFIX` | `DOMAIN-SUFFIX,google.com,X` | 域名后缀（含自身及子域名） |
| `DOMAIN-KEYWORD` | `DOMAIN-KEYWORD,google,X` | 域名包含关键字 |
| `GEOSITE` | `GEOSITE,youtube,X` | 域名属于某分类 |
| `IP-CIDR` / `IP-CIDR6` | `IP-CIDR,10.0.0.0/8,X,no-resolve` | IP 段 |
| `GEOIP` | `GEOIP,cn,X` | IP 所属国家 / 分类 |
| `PROCESS-NAME` | `PROCESS-NAME,chrome.exe,X` | 按进程名（需开启 `find-process-mode`） |
| `DST-PORT` | `DST-PORT,22,X` | 目标端口 |
| `RULE-SET` | `RULE-SET,my-set,X` | 引用 `rule-providers` 远程规则集 |
| `MATCH` | `MATCH,X` | 兜底 |

**`no-resolve`**：IP 类规则遇到域名时，默认会先解析出 IP 再匹配；加上 `no-resolve` 则跳过，避免不必要的 DNS 查询。

---

## 10. dns：域名解析

```yaml
dns:
  enable: true
  enhanced-mode: "fake-ip"
  fake-ip-range: "198.18.0.1/16"
  fake-ip-filter-mode: "blacklist"
  fake-ip-filter: ["dns.msftnsci.com", "www.msftnsci.com", "www.msftconnecttest.com"]
  fake-ip-ttl: 1
  ipv6: true
  ipv6-timeout: 100
  prefer-h3: false
  use-hosts: true
  use-system-hosts: true
  respect-rules: true
  default-nameserver: ["114.114.114.114", "223.5.5.5", "8.8.8.8", "1.0.0.1"]
  nameserver: ["https://120.53.53.53/dns-query", "https://223.5.5.5/dns-query"]
  nameserver-policy:
    geosite:cn,private: ["https://120.53.53.53/dns-query", "https://223.5.5.5/dns-query"]
    geosite:geolocation-!cn: ["https://dns.cloudflare.com/dns-query", "https://dns.google/dns-query"]
  proxy-server-nameserver: ["https://120.53.53.53/dns-query", "https://223.5.5.5/dns-query"]
  fallback: null
  direct-nameserver: null
  # 其余略
```

### fake-ip 模式

| 模式 | 行为 |
|---|---|
| `fake-ip` | 立即返回 `198.18.x.x` 假地址，连接发起时按域名匹配规则；真实解析交给代理服务器或按需进行 |
| `redir-host` | 先真实解析再返回，速度慢但兼容性好 |

fake-ip 的优点是**快**（无需等待真实解析）且**分流精准**（基于域名而非 IP）。缺点是部分依赖真实 IP 的程序会异常，需要加入 `fake-ip-filter`。

| 字段 | 说明 |
|---|---|
| `fake-ip-range` / `fake-ip-range6` | 假地址池 |
| `fake-ip-filter-mode` | `blacklist` = 列表内的域名返回真实 IP；`whitelist` = 只有列表内的域名使用 fake-ip |
| `fake-ip-filter` | 样本中是 Windows 联网检测域名，不加会导致任务栏显示"无网络" |
| `fake-ip-ttl` | 假地址响应的 TTL（秒） |

### 上游服务器分工

| 字段 | 用途 |
|---|---|
| `default-nameserver` | 解析 DoH/DoT 服务器自身的域名，**必须是纯 IP** |
| `nameserver` | 默认上游 |
| `nameserver-policy` | 按域名分类指定上游：国内域名用国内 DNS，境外域名用境外 DNS，避免污染 |
| `proxy-server-nameserver` | 只用于解析节点服务器的域名 |
| `direct-nameserver` | 只用于直连出站的解析，空 = 遵循上面的配置 |
| `fallback` / `fallback-filter` | 旧式"国内 + 国外"双组解析方案，`fallback` 为空时不生效 |

### 其他

| 字段 | 说明 |
|---|---|
| `respect-rules` | DNS 查询连接本身也遵守分流规则（需配合 `proxy-server-nameserver`） |
| `ipv6` | 是否返回 AAAA 记录 |
| `ipv6-timeout` | 双栈解析时等待 AAAA 结果的时间（毫秒） |
| `prefer-h3` | DoH 优先尝试 HTTP/3 |
| `use-hosts` / `use-system-hosts` | 是否使用配置内 `hosts` / 系统 hosts 文件 |
| `listen` | 对外提供 DNS 服务的地址，空 = 不提供 |
| `cache-algorithm` / `cache-max-size` | 缓存算法（`lru` / `arc`）/ 容量 |

---

## 11. tun：虚拟网卡

```yaml
tun:
  enable: true
  device: "FlClash"
  stack: "mixed"
  dns-hijack: ["any:53"]
  auto-route: true
  auto-detect-interface: true
  inet6-address: ["fdfe:dcba:9876::1/126"]
  route-address: []
  file-descriptor: 0
  recvmsgx: true
```

系统代理只对"愿意读取代理设置"的程序有效；TUN 创建一块虚拟网卡并修改路由表，**接管整台机器的所有流量**（游戏、命令行、UWP 应用等）。

| 字段 | 说明 |
|---|---|
| `device` | 虚拟网卡名称 |
| `stack` | 网络栈：`system`（性能好）/ `gvisor`（兼容好）/ `mixed`（TCP 用 system、UDP 用 gvisor） |
| `dns-hijack` | 劫持发往任意地址 53 端口的 DNS 请求，交给 Clash 处理 |
| `auto-route` | 自动添加路由，让流量进入 TUN |
| `auto-detect-interface` | 自动识别真实出口网卡，防止流量回环 |
| `inet6-address` | TUN 网卡的 IPv6 地址 |
| `route-address` | 只接管指定网段，空 = 全部接管 |
| `file-descriptor` | Android 由 VpnService 传入的 fd，桌面端为 0 |
| `recvmsgx` | 平台相关的收包优化开关（客户端内置字段） |

---

## 12. sniffer：域名嗅探

```yaml
sniffer:
  enable: false
  override-destination: true
  force-dns-mapping: true
  parse-pure-ip: true
  sniff: {}
  force-domain: []
  skip-domain: []
  port-whitelist: []
```

当连接只有 IP 没有域名时（如程序自带 DNS、硬编码 IP），从 TLS SNI / HTTP Host / QUIC 中"嗅探"出域名，从而让域名规则生效。当前**未启用**。

| 字段 | 说明 |
|---|---|
| `override-destination` | 用嗅探到的域名替换连接目标 |
| `force-dns-mapping` | 对 redir-host 映射的连接也进行嗅探 |
| `parse-pure-ip` | 对纯 IP 连接也进行嗅探 |
| `sniff` | 按协议指定嗅探端口，如 `TLS: {ports: [443]}` |
| `force-domain` / `skip-domain` | 强制嗅探 / 跳过嗅探的域名 |

---

## 13. 其余字段

| 字段 | 说明 | 当前状态 |
|---|---|---|
| `hosts` | 自定义静态解析，如 `router.lan: 192.168.1.1` | 空 |
| `proxy-providers` | 远程节点集合，可合并多个订阅 | 未使用 |
| `rule-providers` | 远程规则集，配合 `RULE-SET` 规则 | 未使用 |
| `sub-rules` | 子规则集，配合 `SUB-RULE` 实现规则嵌套 | 未使用 |
| `listeners` | 自定义多个入站（不同端口走不同策略） | 未使用 |
| `ntp` | 内置时间同步，`write-to-system` 可写入系统时间 | 关闭 |
| `tuic-server` | 把本机作为 TUIC 服务端 | 关闭 |
| `iptables` | Linux 下自动配置透明代理 | 关闭 |
| `tls` | 入站 / API 的 TLS 证书，`ech-key` 为 ECH 密钥 | 空 |
| `tls.custom-certifactes` | 自定义信任证书。拼写错误源自内核字段名本身，配置中必须照写 | 空 |
| `experimental` | quic-go 的 GSO / ECN 开关、IP4P 地址转换等实验特性 | 默认 |
| `profile.store-selected` | 重启后记住策略组的选择 | **关闭** |
| `profile.store-fake-ip` | 重启后保留 fake-ip 映射表 | 关闭 |
| `clash-for-android` | CFA 兼容字段 | 默认 |

---

## 14. 与 sublink-worker 的对应关系

| 配置内容 | 项目代码位置 | 说明 |
|---|---|---|
| 顶层默认值、DNS | [src/config.js](../src/config.js) `CLASH_CONFIG` | 端口、`allow-lan`、`mode`、`log-level`、DNS 基础配置 |
| `proxies` | [src/ProxyParsers.js](../src/ProxyParsers.js) → [src/ClashConfigBuilder.js](../src/ClashConfigBuilder.js) `convertToClashProxy` | 先解析为 sing-box 格式，再转换为 Clash 格式 |
| `proxy-groups` | `ClashConfigBuilder.addSelectors` | 固定生成 `🚀 节点选择`、`⚡ 自动选择`、`🐟 漏网之鱼`，其余按所选规则生成；`UNIFIED_RULES` 中声明了 `default_outbound` 的类别首项为该出站：私有网络、国内服务、苹果、微软为 `DIRECT`，广告拦截为 `REJECT`；`REJECT` 仅保留在广告拦截与自定义出站组 |
| `rules` | [src/config.js](../src/config.js) `generateRules` + `ClashConfigBuilder.formatConfig` | 规则来源于 `UNIFIED_RULES`；`MATCH,🐟 漏网之鱼` 固定追加在末尾 |
| 规则预设 | `PREDEFINED_RULE_SETS` | 样本对应 `minimal` = `Location:CN` + `Private` + `Non-China` |

### 样本规则的生成过程

```
minimal 预设
  ├─ Private      → ip_rules: [private]         → GEOIP,private,🏠 私有网络
  ├─ Location:CN  → site_rules: [geolocation-cn] → GEOSITE,geolocation-cn,🔒 国内服务
  │                 ip_rules: [cn]               → GEOIP,cn,🔒 国内服务
  └─ Non-China    → site_rules: [geolocation-!cn]→ GEOSITE,geolocation-!cn,🌐 非中国
末尾追加                                         → MATCH,🐟 漏网之鱼
```

### 项目中能自定义的部分

| 需求 | 方式 |
|---|---|
| 选择分流类别 | 页面点选分类或选择预设（`selectedRules`） |
| 调整分类优先级 | 自定义模式下拖动卡片，规则按卡片顺序生成（预设为固定顺序） |
| 域名 / 后缀 / IP 段直连或拒绝 | 自定义规则（快捷）：选「直连 / 拒绝」和匹配方式，填值即可，不建策略组 |
| 自定义出站、Geo-Site / Geo-IP 等 | 自定义规则 → 高级规则：出站填新名称会新建同名策略组，填 `DIRECT` / `REJECT` 则直接指向内置出站 |
| 自定义规则置顶 | 置顶开关（`pin=true`），默认打开 |

---

## 15. 问题与建议

1. **局域网完全开放**：`allow-lan: true` + 全网段放行 + 无认证，同一网络内任何人都能使用你的代理。公共网络下建议在 FlClash 中关闭"允许局域网"，或设置 `authentication`。
2. **IPv6 设置矛盾**：顶层 `ipv6: false` 而 `dns.ipv6: true`，DNS 会返回 IPv6 地址但连接层不使用。建议两者保持一致。
3. **策略组选择不会保存**：`profile.store-selected: false`，重启后手动选择的节点会恢复默认。如需保留，在 FlClash 设置中开启。
4. **GEO 数据库不自动更新**：`geo-auto-update: false`，域名分类列表会逐渐过时，建议开启或定期手动更新。
5. **`fake-ip-filter` 较少**：只包含 Windows 联网检测域名。如遇局域网设备名（`*.lan`）、部分游戏或 NTP 异常，可补充相应域名。
6. **覆写规则依赖客户端**：顶部两条 `DIRECT` 规则是在 FlClash 中手动添加的，换设备需要重新配置。改为写入订阅：在项目页面添加一条自定义规则，选「直连」+「域名后缀」，填 `haveways.com,10085.fun`（置顶默认打开），生成后用固定短码缩短，所有客户端订阅该短链即可。
