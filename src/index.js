import yaml from "js-yaml";
import { PREDEFINED_RULE_SETS } from "./config.js";
import { GenerateWebPath, decodeBase64, encodeBase64 } from "./utils.js";
import { ConfigBuilder } from "./SingboxConfigBuilder.js";
import { generateHtml } from "./htmlBuilder.js";
import { ClashConfigBuilder } from "./ClashConfigBuilder.js";

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(generateHtml("", "", "", url.origin), {
        headers: { "Content-Type": "text/html" }
      });
    } else if (request.method === "POST" && url.pathname === "/") {
      const formData = await request.formData();
      const inputString = formData.get("input");
      const selectedRules = formData.getAll("selectedRules");
      const customRuleDomains = formData.getAll("customRuleSite[]");
      const customRuleIPs = formData.getAll("customRuleIP[]");
      const customRuleNames = formData.getAll("customRuleName[]");
      const customRules = customRuleDomains.map((domains, index) => ({
        sites: domains.split(",").map((site) => site.trim()),
        ips: customRuleIPs[index].split(",").map((ip) => ip.trim()),
        outbound: customRuleNames[index]
      }));
      const pin = formData.get("pin");
      if (!inputString) {
        return new Response("Missing input parameter", { status: 400 });
      }
      const rulesToUse = selectedRules.length > 0 ? selectedRules : ["广告拦截", "谷歌服务", "国外媒体", "电报消息"];
      const xrayUrl = `${url.origin}/xray?config=${encodeURIComponent(inputString)}`;
      const singboxUrl = `${url.origin}/singbox?config=${encodeURIComponent(inputString)}&selectedRules=${encodeURIComponent(JSON.stringify(rulesToUse))}&customRules=${encodeURIComponent(JSON.stringify(customRules))}pin=${pin}`;
      const clashUrl = `${url.origin}/clash?config=${encodeURIComponent(inputString)}&selectedRules=${encodeURIComponent(JSON.stringify(rulesToUse))}&customRules=${encodeURIComponent(JSON.stringify(customRules))}pin=${pin}`;
      return new Response(generateHtml(xrayUrl, singboxUrl, clashUrl), {
        headers: { "Content-Type": "text/html" }
      });
    } else if (url.pathname.startsWith("/singbox") || url.pathname.startsWith("/clash")) {
      const inputString = url.searchParams.get("config");
      let selectedRules = url.searchParams.get("selectedRules");
      let customRules = url.searchParams.get("customRules");
      let pin = url.searchParams.get("pin");
      if (!inputString) {
        return new Response("Missing config parameter", { status: 400 });
      }
      if (PREDEFINED_RULE_SETS[selectedRules]) {
        selectedRules = PREDEFINED_RULE_SETS[selectedRules];
      } else {
        try {
          selectedRules = JSON.parse(decodeURIComponent(selectedRules));
        } catch (error) {
          console.error("Error parsing selectedRules:", error);
          selectedRules = PREDEFINED_RULE_SETS.minimal;
        }
      }
      try {
        customRules = JSON.parse(decodeURIComponent(customRules));
      } catch (error) {
        console.error("Error parsing customRules:", error);
        customRules = [];
      }
      const configId = url.searchParams.get("configId");
      let baseConfig;
      if (configId) {
        const customConfig = await env.SUBLINK_KV.get(configId);
        if (customConfig) {
          baseConfig = JSON.parse(customConfig);
        }
      }
      let configBuilder;
      if (url.pathname.startsWith("/singbox")) {
        configBuilder = new ConfigBuilder(inputString, selectedRules, customRules, pin, baseConfig);
      } else {
        configBuilder = new ClashConfigBuilder(inputString, selectedRules, customRules, pin, baseConfig);
      }
      const config = await configBuilder.build();
      return new Response(
        url.pathname.startsWith("/singbox") ? JSON.stringify(config, null, 2) : config,
        {
          headers: {
            "content-type": url.pathname.startsWith("/singbox") ? "application/json; charset=utf-8" : "text/yaml; charset=utf-8"
          }
        }
      );
    } else if (url.pathname === "/shorten") {
      const originalUrl = url.searchParams.get("url");
      if (!originalUrl) {
        return new Response("Missing URL parameter", { status: 400 });
      }
      const shortCode = GenerateWebPath();
      await env.SUBLINK_KV.put(shortCode, originalUrl);
      const shortUrl = `${url.origin}/s/${shortCode}`;
      return new Response(JSON.stringify({ shortUrl }), {
        headers: { "Content-Type": "application/json" }
      });
    } else if (url.pathname === "/shorten-v2") {
      const originalUrl = url.searchParams.get("url");
      let shortCode = url.searchParams.get("shortCode");
      if (!originalUrl) {
        return new Response("Missing URL parameter", { status: 400 });
      }
      const parsedUrl = new URL(originalUrl);
      const queryString = parsedUrl.search;
      if (!shortCode) {
        shortCode = GenerateWebPath();
      }
      await env.SUBLINK_KV.put(shortCode, queryString);
      return new Response(shortCode, {
        headers: { "Content-Type": "text/plain" }
      });
    } else if (url.pathname.startsWith("/s/")) {
      const shortCode = url.pathname.split("/")[2];
      const originalUrl = await env.SUBLINK_KV.get(shortCode);
      if (originalUrl === null) {
        return new Response("Short URL not found", { status: 404 });
      }
      return Response.redirect(originalUrl, 302);
    } else if (url.pathname.startsWith("/b/") || url.pathname.startsWith("/c/") || url.pathname.startsWith("/x/")) {
      const shortCode = url.pathname.split("/")[2];
      const originalParam = await env.SUBLINK_KV.get(shortCode);
      let originalUrl;
      if (url.pathname.startsWith("/b/")) {
        originalUrl = `${url.origin}/singbox${originalParam}`;
      } else if (url.pathname.startsWith("/c/")) {
        originalUrl = `${url.origin}/clash${originalParam}`;
      } else if (url.pathname.startsWith("/x/")) {
        originalUrl = `${url.origin}/xray${originalParam}`;
      }
      if (originalUrl === null) {
        return new Response("Short URL not found", { status: 404 });
      }
      return Response.redirect(originalUrl, 302);
    } else if (url.pathname.startsWith("/xray")) {
      const inputString = url.searchParams.get("config");
      const proxylist = inputString.split("\n");
      const finalProxyList = [];
      for (const proxy of proxylist) {
        if (proxy.startsWith("http://") || proxy.startsWith("https://")) {
          try {
            const response = await fetch(proxy);
            const text = await response.text();
            let decodedText;
            decodedText = decodeBase64(text.trim());
            if (decodedText.includes("%")) {
              decodedText = decodeURIComponent(decodedText);
            }
            finalProxyList.push(...decodedText.split("\n"));
          } catch (e) {
            console.warn("Failed to fetch the proxy:", e);
          }
        } else {
          finalProxyList.push(proxy);
        }
      }
      const finalString = finalProxyList.join("\n");
      if (!finalString) {
        return new Response("Missing config parameter", { status: 400 });
      }
      return new Response(encodeBase64(finalString), {
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    } else if (url.pathname === "/favicon.ico") {
      return Response.redirect("https://cravatar.cn/avatar/9240d78bbea4cf05fb04f2b86f22b18d?s=160&d=retro&r=g", 301);
    } else if (url.pathname === "/config") {
      const { type, content } = await request.json();
      const configId = `${type}_${GenerateWebPath(8)}`;
      try {
        let configString;
        if (type === "clash") {
          if (typeof content === "string" && (content.trim().startsWith("-") || content.includes(":"))) {
            const yamlConfig = yaml.load(content);
            configString = JSON.stringify(yamlConfig);
          } else {
            configString = typeof content === "object" ? JSON.stringify(content) : content;
          }
        } else {
          configString = typeof content === "object" ? JSON.stringify(content) : content;
        }
        JSON.parse(configString);
        await env.SUBLINK_KV.put(configId, configString, {
          expirationTtl: 60 * 60 * 24 * 30
          // 30 days
        });
        return new Response(configId, {
          headers: { "Content-Type": "text/plain" }
        });
      } catch (error) {
        console.error("Config validation error:", error);
        return new Response("Invalid format: " + error.message, {
          status: 400,
          headers: { "Content-Type": "text/plain" }
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
