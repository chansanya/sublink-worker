import yaml from "js-yaml";
import { CLASH_CONFIG, BUILTIN_OUTBOUNDS, groupMembers, withoutReject, getOutbounds, generateRules } from "./config.js";
import { DeepCopy } from "./utils.js";
import { BaseConfigBuilder } from "./BaseConfigBuilder.js";

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, pin) {
    super(inputString, CLASH_CONFIG);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    this.pin = pin;
  }
  addCustomItems(customItems) {
    const names = new Set(this.config.proxies.map((p) => p.name));
    customItems.forEach((item) => {
      if (!item) return;
      const base = item.tag || `${item.server}:${item.server_port}`;
      let name = base;
      for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
      names.add(name);
      this.config.proxies.push(this.convertToClashProxy({ ...item, tag: name }));
    });
  }
  addSelectors() {
    const outbounds = getOutbounds(this.selectedRules);
    const proxyList = this.config.proxies.map((proxy) => proxy.name);
    this.config["proxy-groups"].push({
      name: "⚡ 自动选择",
      type: "url-test",
      proxies: DeepCopy(proxyList),
      url: "https://www.gstatic.com/generate_204",
      interval: 300,
      lazy: false
    });
    proxyList.unshift("DIRECT", "REJECT", "⚡ 自动选择");
    outbounds.unshift("🚀 节点选择");
    outbounds.forEach((outbound) => {
      if (outbound !== "🚀 节点选择") {
        this.config["proxy-groups"].push({
          type: "select",
          name: outbound,
          proxies: groupMembers(outbound, proxyList)
        });
      } else {
        this.config["proxy-groups"].unshift({
          type: "select",
          name: outbound,
          proxies: ["⚡ 自动选择", ...withoutReject(proxyList).filter((p) => p !== "⚡ 自动选择")]
        });
      }
    });
    if (Array.isArray(this.customRules)) {
      this.customRules.forEach((rule) => {
        if (BUILTIN_OUTBOUNDS.includes(rule.name)) return;
        this.config["proxy-groups"].push({
          type: "select",
          name: rule.name,
          proxies: ["🚀 节点选择", ...proxyList]
        });
      });
    }
    this.config["proxy-groups"].push({
      type: "select",
      name: "🐟 漏网之鱼",
      proxies: ["🚀 节点选择", ...withoutReject(proxyList)]
    });
  }
  formatConfig() {
    const rules = generateRules(this.selectedRules, this.customRules, this.pin);
    this.config.rules = rules.flatMap((rule) => {
      const domainRules = rule.domain ? rule.domain.map((domain) => `DOMAIN,${domain},${rule.outbound}`) : [];
      const siteRules = rule.site_rules[0] !== "" ? rule.site_rules.map((site) => `GEOSITE,${site},${rule.outbound}`) : [];
      const ipRules = rule.ip_rules[0] !== "" ? rule.ip_rules.map((ip) => `GEOIP,${ip},${rule.outbound}`) : [];
      const domainSuffixRules = rule.domain_suffix ? rule.domain_suffix.map((suffix) => `DOMAIN-SUFFIX,${suffix},${rule.outbound}`) : [];
      const domainKeywordRules = rule.domain_keyword ? rule.domain_keyword.map((keyword) => `DOMAIN-KEYWORD,${keyword},${rule.outbound}`) : [];
      const ipCidrRules = rule.ip_cidr ? rule.ip_cidr.map((cidr) => `IP-CIDR,${cidr},${rule.outbound}`) : [];
      return [...domainRules, ...siteRules, ...ipRules, ...domainSuffixRules, ...domainKeywordRules, ...ipCidrRules];
    });
    this.config.rules.push("MATCH,🐟 漏网之鱼");
    return yaml.dump(this.config);
  }
  convertToClashProxy(proxy) {
    switch (proxy.type) {
      case "shadowsocks":
        return {
          name: proxy.tag,
          type: "ss",
          server: proxy.server,
          port: proxy.server_port,
          cipher: proxy.method,
          password: proxy.password
        };
      case "vmess":
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          alterId: proxy.alter_id,
          cipher: proxy.security,
          tls: proxy.tls?.enabled || false,
          servername: proxy.tls?.server_name || "",
          network: proxy.transport?.type === "http" ? "h2" : proxy.transport?.type || "tcp",
          "ws-opts": proxy.transport?.type === "ws" ? {
            path: proxy.transport.path,
            headers: proxy.transport.headers
          } : void 0,
          "grpc-opts": proxy.transport?.type === "grpc" ? {
            "grpc-service-name": proxy.transport.service_name
          } : void 0,
          "h2-opts": proxy.transport?.type === "http" ? {
            host: proxy.transport.host,
            path: proxy.transport.path
          } : void 0
        };
      case "vless":
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          cipher: proxy.security,
          tls: proxy.tls?.enabled || false,
          "client-fingerprint": proxy.tls.utls?.fingerprint,
          servername: proxy.tls?.server_name || "",
          network: proxy.transport?.type || "tcp",
          "ws-opts": proxy.transport?.type === "ws" ? {
            path: proxy.transport.path,
            headers: proxy.transport.headers
          } : void 0,
          "reality-opts": proxy.tls.reality?.enabled ? {
            "public-key": proxy.tls.reality.public_key,
            "short-id": proxy.tls.reality.short_id
          } : void 0,
          "grpc-opts": proxy.transport?.type === "grpc" ? {
            "grpc-mode": "gun",
            "grpc-service-name": proxy.transport.service_name
          } : void 0,
          tfo: proxy.tcp_fast_open,
          "skip-cert-verify": proxy.tls.insecure,
          "flow": proxy.flow ?? void 0
        };
      case "hysteria2":
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          obfs: proxy.obfs.type,
          "obfs-password": proxy.obfs.password,
          password: proxy.password,
          auth: proxy.password,
          "skip-cert-verify": proxy.tls.insecure
        };
      case "trojan":
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          password: proxy.password,
          cipher: proxy.security,
          tls: proxy.tls?.enabled || false,
          "client-fingerprint": proxy.tls.utls?.fingerprint,
          servername: proxy.tls?.server_name || "",
          network: proxy.transport?.type || "tcp",
          "ws-opts": proxy.transport?.type === "ws" ? {
            path: proxy.transport.path,
            headers: proxy.transport.headers
          } : void 0,
          "reality-opts": proxy.tls.reality?.enabled ? {
            "public-key": proxy.tls.reality.public_key,
            "short-id": proxy.tls.reality.short_id
          } : void 0,
          "grpc-opts": proxy.transport?.type === "grpc" ? {
            "grpc-mode": "gun",
            "grpc-service-name": proxy.transport.service_name
          } : void 0,
          tfo: proxy.tcp_fast_open,
          "skip-cert-verify": proxy.tls.insecure,
          "flow": proxy.flow ?? void 0
        };
      case "tuic":
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          password: proxy.password,
          "congestion-controller": proxy.congestion_control,
          "skip-cert-verify": proxy.tls.insecure,
          "disable-sni": true,
          "alpn": proxy.tls.alpn,
          "sni": proxy.tls.server_name,
          "udp-relay-mode": "native"
        };
      default:
        return proxy;
    }
  }
}

