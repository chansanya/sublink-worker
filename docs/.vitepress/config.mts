import { defineConfig } from "vitepress";

const REPO = "https://github.com/chansanya/sublink-worker";

// 托管在 GitHub Pages 的项目页 https://chansanya.github.io/sublink-worker/，与 Cloudflare 部署相互独立
export default defineConfig({
  base: "/sublink-worker/",
  lang: "zh-CN",
  title: "Sublink Worker",
  description: "部署在 Cloudflare Workers 上的订阅转换工具：把节点链接与机场订阅转换为 Clash、sing-box、Xray 配置。",
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["README.md"],
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/sublink-worker/favicon.svg" }]],

  themeConfig: {
    logo: "/favicon.svg",
    nav: [
      { text: "指南", link: "/guide/quick-start", activeMatch: "/guide/" },
      { text: "API", link: "/api" },
      { text: "常见问题", link: "/guide/faq" }
    ],
    sidebar: [
      {
        text: "指南",
        items: [
          { text: "快速开始", link: "/guide/quick-start" },
          { text: "规则分类", link: "/guide/rules" },
          { text: "自定义规则", link: "/guide/custom-rules" },
          { text: "订阅链接与短链", link: "/guide/links" },
          { text: "策略组", link: "/guide/groups" }
        ]
      },
      {
        text: "参考",
        items: [
          { text: "API", link: "/api" },
          { text: "Clash 配置详解", link: "/guide/clash-config" },
          { text: "常见问题", link: "/guide/faq" }
        ]
      }
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: "在 GitHub 上编辑此页" },
    outline: { level: [2, 3], label: "页面导航" },
    docFooter: { prev: "上一页", next: "下一页" },
    lastUpdated: { text: "最后更新于" },
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "回到顶部",
    langMenuLabel: "语言",
    notFound: { title: "页面不存在", quote: "链接可能已失效，或页面已被移动。", linkText: "返回首页" },
    footer: { message: "基于 MIT 许可证发布", copyright: "© 2026 Sublink Worker" },
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
          modal: {
            noResultsText: "没有找到相关结果",
            resetButtonTitle: "清除查询",
            footer: { selectText: "选择", navigateText: "切换", closeText: "关闭" }
          }
        }
      }
    }
  }
});
