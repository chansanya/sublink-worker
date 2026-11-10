import { SING_BOX_CONFIG, BUILTIN_OUTBOUNDS, groupMembers, getOutbounds, generateRules, generateRuleSets } from "./config.js";
import { DeepCopy } from "./utils.js";
import { BaseConfigBuilder } from "./BaseConfigBuilder.js";

export class ConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, pin, baseConfig) {
    if (baseConfig === void 0) {
      baseConfig = SING_BOX_CONFIG;
    }
    super(inputString, baseConfig);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    this.pin = pin;
  }
  addCustomItems(customItems) {
    const validItems = customItems.filter((item) => item != null);
    this.config.outbounds.push(...validItems);
  }
  addSelectors() {
    const outbounds = getOutbounds(this.selectedRules);
    const proxyList = this.config.outbounds.filter((outbound) => outbound?.server != void 0).map((outbound) => outbound.tag);
    this.config.outbounds.unshift({
      type: "urltest",
      tag: "⚡ 自动选择",
      outbounds: DeepCopy(proxyList)
    });
    proxyList.unshift("DIRECT", "REJECT", "⚡ 自动选择");
    outbounds.unshift("🚀 节点选择", "GLOBAL");
    outbounds.forEach((outbound) => {
      if (outbound !== "🚀 节点选择") {
        this.config.outbounds.push({
          type: "selector",
          tag: outbound,
          outbounds: groupMembers(outbound, proxyList)
        });
      } else {
        this.config.outbounds.unshift({
          type: "selector",
          tag: outbound,
          outbounds: ["⚡ 自动选择", ...proxyList.filter((p) => p !== "⚡ 自动选择")]
        });
      }
    });
    if (Array.isArray(this.customRules)) {
      this.customRules.forEach((rule) => {
        if (BUILTIN_OUTBOUNDS.includes(rule.name)) return;
        this.config.outbounds.push({
          type: "selector",
          tag: rule.name,
          outbounds: ["🚀 节点选择", ...proxyList]
        });
      });
    }
    this.config.outbounds.push({
      type: "selector",
      tag: "🐟 漏网之鱼",
      outbounds: ["🚀 节点选择", ...proxyList]
    });
  }
  formatConfig() {
    const rules = generateRules(this.selectedRules, this.customRules, this.pin);
    const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules, this.customRules);
    this.config.route.rule_set = [...site_rule_sets, ...ip_rule_sets];
    this.config.route.rules = rules.map((rule) => ({
      rule_set: [
        ...rule.site_rules.length > 0 && rule.site_rules[0] !== "" ? rule.site_rules : [],
        ...rule.ip_rules.filter((ip) => ip.trim() !== "").map((ip) => `${ip}-ip`)
      ],
      domain_suffix: rule.domain_suffix,
      domain_keyword: rule.domain_keyword,
      ip_cidr: rule.ip_cidr,
      protocol: rule.protocol,
      outbound: rule.outbound
    }));
    this.config.route.rules.unshift(
      { protocol: "dns", outbound: "dns-out" },
      { clash_mode: "direct", outbound: "DIRECT" },
      { clash_mode: "global", outbound: "GLOBAL" }
    );
    this.config.route.auto_detect_interface = true;
    this.config.route.final = "🐟 漏网之鱼";
    return this.config;
  }
}

