# Sublink Worker 文档指南

欢迎查阅 Sublink Worker 使用与技术文档。

如果你在浏览器中访问，本项目内置了仿 VitePress 风格的居中交互式文档页面：
- **Web 文档中心**：直接访问 `/docs/` 或运行本地服务查看 `http://localhost:8787/docs/`

---

## 目录索引

1. [快速开始与部署指南](quick-start.md)
   - Cloudflare Workers 一键部署
   - Wrangler CLI 手动部署
   - 本地运行与开发
2. [规则系统与分流架构](rules.md)
   - 18 类统一分流规则表
   - 精简 / 均衡 / 全面预设
   - 包含冲突检测与拓扑推荐排序
3. [自定义规则指南](custom-rules.md)
   - 快捷直连与拦截规则
   - 高级规则（自定义出站、Geo-Site / Geo-IP）
   - 置顶优先匹配机制
4. [API 接口参考](api.md)
   - `/clash`、`/singbox`、`/xray` 输出端点
   - `/c/:code`、`/b/:code`、`/x/:code` 持久化短链
   - 在线规则与域名名单接口
5. [Clash (mihomo) 配置文件详解](clash-config-guide.md)
   - 客户端核心配置逐字段解析
   - 代码映射与策略组生成流转
6. [常见问题 (FAQ)](faq.md)
   - 常见错误与排查方案
   - 短链更新与节点聚合技巧
