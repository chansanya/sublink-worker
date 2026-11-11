import { PREDEFINED_RULE_SETS, UNIFIED_RULES, GEOSITE_LIST_BASE_URL } from "./config.js";
import { GenerateWebPath, decodeBase64, encodeBase64 } from "./utils.js";
import { ConfigBuilder } from "./SingboxConfigBuilder.js";
import { ClashConfigBuilder } from "./ClashConfigBuilder.js";

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);
    if (url.pathname === "/api/rules") {
      const rules = UNIFIED_RULES.map(({ name, outbound, site_rules, default_outbound }) => ({ name, outbound, site_rules, default_outbound: default_outbound || null }));
      return Response.json({ rules, presets: PREDEFINED_RULE_SETS });
    } else if (url.pathname.startsWith("/api/geosite/")) {
      const name = decodeURIComponent(url.pathname.slice("/api/geosite/".length));
      if (!/^[\w!@.-]+$/.test(name)) {
        return new Response("Invalid name", { status: 400 });
      }
      const upstream = await fetch(`${GEOSITE_LIST_BASE_URL}${name}.list`, { cf: { cacheTtl: 86400, cacheEverything: true } });
      if (upstream.status === 404) {
        return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
      }
      if (!upstream.ok) {
        return new Response("Upstream error", { status: 502 });
      }
      return new Response(upstream.body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
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
      let configBuilder;
      if (url.pathname.startsWith("/singbox")) {
        configBuilder = new ConfigBuilder(inputString, selectedRules, customRules, pin);
      } else {
        configBuilder = new ClashConfigBuilder(inputString, selectedRules, customRules, pin);
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
    }
    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
