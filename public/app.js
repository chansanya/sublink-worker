(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const STORE_KEY = "sublink:v2";
  const PRESETS = ["minimal", "balanced", "comprehensive"];
  const BUILTIN = ["DIRECT", "REJECT"];
  const FIXED_GROUPS = ["🚀 节点选择", "⚡ 自动选择", "🐟 漏网之鱼", "GLOBAL"];
  const SAMPLE_NODE = "vless://00000000-0000-0000-0000-000000000000@example.com:443?security=tls&sni=example.com&type=tcp#示例节点";
  const SUPPORTED = ["ss", "vmess", "vless", "hysteria2", "hy2", "trojan", "tuic", "http", "https"];
  const LINK_TYPES = [["clash", "Clash", "c"], ["singbox", "sing-box", "b"], ["xray", "Xray", "x"]];
  const RULE_ICONS = {
    "Ad Block": "shield-ban", "AI Services": "bot", Bilibili: "tv", Youtube: "play", Google: "search",
    Private: "house", "Location:CN": "map-pin", Telegram: "send", Github: "git-branch", Microsoft: "monitor",
    Apple: "apple", "Social Media": "users", Streaming: "clapperboard", Gaming: "gamepad-2",
    Education: "graduation-cap", Financial: "wallet", "Cloud Services": "cloud", "Non-China": "globe"
  };
  const FIELDS = [
    { key: "site", label: "Geo-Site", placeholder: "google, category-ai-!cn", hint: "域名分类名，需同时存在于 v2fly 域名名单与 sing-box 规则集仓库" },
    { key: "ip", label: "Geo-IP", placeholder: "private, cn, telegram", hint: "IP 分类名，国家代码或 private、telegram 等特殊分类" },
    { key: "domain_suffix", label: "域名后缀", placeholder: "example.com", hint: "匹配该域名及其所有子域名" },
    { key: "domain_keyword", label: "域名关键词", placeholder: "openai", hint: "域名包含该关键词即匹配" },
    { key: "ip_cidr", label: "IP CIDR", placeholder: "10.0.0.0/8", hint: "IP 段" },
    { key: "protocol", label: "协议", placeholder: "bittorrent, dns", hint: "仅 sing-box 生效，且与同一条规则的其他条件为「并且」关系" }
  ];
  const ICON_ATTRS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  let meta = { rules: [], presets: {} };
  let state;
  let currentLinks = null;
  const preview = { seq: 0, ctrl: null, lines: {}, text: {}, reason: "init" };
  // 排序冲突：比例达标或绝对数量达标（照顾广告这类横跨国内外、比例不高但数量大的分类）
  const CONFLICT_RATIO = 0.2;
  const CONFLICT_HITS = 150;
  const geo = { status: new Map(), lists: new Map(), pending: new Map() };
  const analysis = { state: "idle", counts: {}, cover: {}, hits: {} };

  // ---------- utils ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const splitTokens = (raw) => raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
  const stripEmoji = (s) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const formatBytes = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

  function icon(name, cls = "") {
    const node = window.ICONS?.[name];
    if (!node) return "";
    const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
    return `<svg class="icon ${cls}" ${ICON_ATTRS}>${inner}</svg>`;
  }

  function hydrateIcons(root = document) {
    $$("i[data-icon]", root).forEach((el) => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  function toast(message, isError = false) {
    const el = $("#toast");
    el.innerHTML = icon(isError ? "circle-alert" : "check") + `<span>${esc(message)}</span>`;
    el.classList.toggle("is-error", isError);
    el.classList.add("is-on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("已复制");
  }

  // ---------- state ----------
  function newRule() {
    return { id: uid(), name: "", site: [], ip: [], domain_suffix: [], domain_keyword: [], ip_cidr: [], protocol: [], open: true };
  }

  function loadState() {
    const base = {
      input: "", preset: "minimal", selected: [], order: [], pin: false, customRules: [],
      baseType: "singbox", baseConfig: "", configId: "", shortCode: "", savedPaths: [], short: null, tab: "clash"
    };
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY));
    } catch {}
    const s = saved ? { ...base, ...saved } : migrateLegacy(base);
    const urlConfigId = new URLSearchParams(location.search).get("configId");
    if (urlConfigId) s.configId = urlConfigId;
    s.customRules = s.customRules.map((r) => ({ ...newRule(), ...r }));
    return s;
  }

  function migrateLegacy(s) {
    const ls = localStorage;
    const parse = (key, fallback) => {
      try {
        return JSON.parse(ls.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    };
    s.input = ls.getItem("inputTextarea") || "";
    s.pin = ls.getItem("crpinToggle") === "true";
    s.baseConfig = ls.getItem("configEditor") || "";
    if (ls.getItem("configType") === "clash") s.baseType = "clash";
    s.savedPaths = parse("savedCustomPaths", []);
    const legacyPreset = ls.getItem("predefinedRules");
    const legacySelected = parse("selectedRules", []);
    if (PRESETS.includes(legacyPreset)) s.preset = legacyPreset;
    else if (legacyPreset === "custom" && legacySelected.length) Object.assign(s, { preset: "custom", selected: legacySelected });
    return s;
  }

  const persist = debounce(() => localStorage.setItem(STORE_KEY, JSON.stringify(state)), 150);

  function changed({ links = true, preview: refresh = true } = {}) {
    persist();
    if (links) renderLinks();
    if (refresh) {
      preview.reason = "edit";
      schedulePreview();
    }
  }

  const ruleNames = () => meta.rules.map((r) => r.name);
  // 预设按固定顺序展示；自定义模式下按用户拖动排好的 state.order 展示，选中项的相对顺序即匹配优先级
  const displayOrder = () => (state.preset === "custom" ? state.order : ruleNames());
  const effectiveSelected = () => (state.preset === "custom" ? state.order.filter((n) => state.selected.includes(n)) : meta.presets[state.preset] || []);
  function enterCustom() {
    if (state.preset === "custom") return;
    state.selected = [...effectiveSelected()];
    state.order = ruleNames();
    state.preset = "custom";
  }

  // ---------- subscription urls (format must stay compatible with existing links) ----------
  function customRulesParam() {
    return state.customRules
      .filter((r) => r.name.trim())
      .map((r) => ({
        site: r.site.join(","),
        ip: r.ip.join(","),
        name: r.name.trim(),
        domain_suffix: r.domain_suffix.join(","),
        domain_keyword: r.domain_keyword.join(","),
        ip_cidr: r.ip_cidr.join(","),
        protocol: r.protocol.join(",")
      }));
  }

  function buildUrls(input, origin = location.origin) {
    const selectedRules = state.preset === "custom" ? effectiveSelected() : state.preset;
    const configParam = state.configId ? `&configId=${state.configId}` : "";
    const config = encodeURIComponent(input);
    const rules = `&selectedRules=${encodeURIComponent(JSON.stringify(selectedRules))}&customRules=${encodeURIComponent(JSON.stringify(customRulesParam()))}&pin=${state.pin}`;
    return {
      xray: `${origin}/xray?config=${config}${configParam}`,
      singbox: `${origin}/singbox?config=${config}${rules}${configParam}`,
      clash: `${origin}/clash?config=${config}${rules}${configParam}`
    };
  }

  // ---------- 01 nodes ----------
  function renderNodes() {
    const lines = state.input.split("\n").map((s) => s.trim()).filter(Boolean);
    const counts = new Map();
    for (const line of lines) {
      const proto = (line.match(/^([a-z0-9]+):\/\//i)?.[1] || "").toLowerCase();
      const key = !SUPPORTED.includes(proto) ? "无法识别" : proto === "http" || proto === "https" ? "订阅" : proto === "hy2" ? "hysteria2" : proto;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    $("#nodeMeta").textContent = lines.length ? `${lines.length} 行` : "";
    $("#protocolChips").innerHTML = [...counts]
      .map(([k, n]) => `<span class="chip${k === "无法识别" ? " is-warn" : ""}">${esc(k)} <b>${n}</b></span>`)
      .join("");
  }

  // ---------- 02 rule categories ----------
  const DEFAULT_BADGE = { DIRECT: ["直连", ""], REJECT: ["拦截", " is-reject"] };
  const ruleLabel = (name) => stripEmoji(meta.rules.find((r) => r.name === name)?.outbound || name);
  const formatCount = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  function renderRules() {
    const selectedList = effectiveSelected();
    const selected = new Set(selectedList);
    const conflicts = ruleConflicts();
    const byName = Object.fromEntries(meta.rules.map((r) => [r.name, r]));
    $$("#presetSwitch button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.preset === state.preset)));
    $("#ruleGrid").innerHTML = displayOrder()
      .map((name) => byName[name])
      .filter(Boolean)
      .map((r) => {
        const count = analysis.counts[r.name];
        const badge = DEFAULT_BADGE[r.default_outbound];
        return `
        <button type="button" class="rule-tile${conflicts.has(r.name) ? " has-conflict" : ""}" data-rule="${esc(r.name)}" aria-pressed="${selected.has(r.name)}">
          <span class="rule-grip" data-grip title="拖动排序">${icon("grip-vertical")}</span>
          ${selected.has(r.name) ? `<span class="rule-tile-rank" title="匹配优先级">${String(selectedList.indexOf(r.name) + 1).padStart(2, "0")}</span>` : ""}
          ${count === undefined ? "" : `<span class="rule-tile-count" title="${count} 个域名">${formatCount(count)}</span>`}
          <span class="rule-tile-icon">${icon(RULE_ICONS[r.name] || "layers")}</span>
          <span class="rule-tile-text">
            <span class="rule-tile-name"><span class="rule-tile-label">${esc(stripEmoji(r.outbound))}</span>${badge ? `<span class="rule-tile-badge${badge[1]}">${badge[0]}</span>` : ""}</span>
            <span class="rule-tile-sub">${esc(r.name)}</span>
          </span>
        </button>`;
      })
      .join("");
    $("#ruleConflicts").innerHTML = [...conflicts]
      .map(([name, c]) => `
        <div class="conflict">
          ${icon("circle-alert")}
          <span>「${esc(ruleLabel(name))}」有 <b>${Math.round(c.pct * 100)}%</b>（${c.hits} 个）的域名会先被「${esc(ruleLabel(c.by))}」截走</span>
          <button type="button" class="btn btn-sm" data-fix="${esc(name)}" data-before="${esc(c.first)}">${icon("arrow-up")}移到「${esc(ruleLabel(c.first))}」前面</button>
        </div>`)
      .join("");
    const status = analysis.state === "loading" ? " · 分析中" : analysis.state === "error" ? " · 分析失败" : "";
    $("#ruleMeta").textContent = meta.rules.length ? `${selected.size} / ${meta.rules.length}${status}` : "";
  }

  // ---------- online geosite analysis ----------
  // 名单经 /api/geosite 从 MetaCubeX 拉取（与 Clash 的 geosite.dat 同源），覆盖率在浏览器里计算
  function parseGeosite(text) {
    const suffix = new Set();
    const full = new Set();
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("+.")) suffix.add(line.slice(2));
      else if (!line.includes(":")) full.add(line);
    }
    return { suffix, full };
  }

  // geo.status: ok | missing | unknown（网络失败不下结论，允许重试）
  function loadGeosite(name) {
    if (!geo.pending.has(name)) {
      const task = fetch(`/api/geosite/${encodeURIComponent(name)}`)
        .then(async (res) => {
          if (res.status === 404) return geo.status.set(name, "missing");
          if (!res.ok) throw new Error(String(res.status));
          geo.lists.set(name, parseGeosite(await res.text()));
          geo.status.set(name, "ok");
        })
        .catch(() => {
          geo.status.set(name, "unknown");
          geo.pending.delete(name);
        });
      geo.pending.set(name, task);
    }
    return geo.pending.get(name);
  }

  async function runPool(items, fn, size = 6) {
    const queue = [...items];
    await Promise.all(Array.from({ length: size }, async () => {
      while (queue.length) await fn(queue.shift());
    }));
  }

  // domain 是否被集合的后缀条目命中（自身或任一父域）
  function hitBySuffix(domain, set) {
    for (let d = domain; ; ) {
      if (set.suffix.has(d)) return true;
      const dot = d.indexOf(".");
      if (dot < 0) return false;
      d = d.slice(dot + 1);
    }
  }

  async function analyzeRules() {
    analysis.state = "loading";
    renderRules();
    const withSites = meta.rules.filter((r) => r.site_rules?.length);
    await runPool([...new Set(withSites.flatMap((r) => r.site_rules))], loadGeosite);
    const sets = {};
    for (const r of withSites) {
      if (r.site_rules.some((n) => geo.status.get(n) === "unknown")) continue;
      const suffix = new Set();
      const full = new Set();
      r.site_rules.forEach((n) => {
        geo.lists.get(n)?.suffix.forEach((d) => suffix.add(d));
        geo.lists.get(n)?.full.forEach((d) => full.add(d));
      });
      sets[r.name] = { suffix, full };
      analysis.counts[r.name] = suffix.size + full.size;
    }
    const names = Object.keys(sets);
    for (const a of names) {
      const A = sets[a];
      const total = A.suffix.size + A.full.size;
      analysis.cover[a] = {};
      analysis.hits[a] = {};
      if (!total) continue;
      for (const b of names) {
        if (a === b) continue;
        const B = sets[b];
        let hit = 0;
        A.suffix.forEach((d) => hitBySuffix(d, B) && hit++);
        A.full.forEach((d) => (B.full.has(d) || hitBySuffix(d, B)) && hit++);
        analysis.cover[a][b] = hit / total;
        analysis.hits[a][b] = hit;
      }
      await new Promise((resolve) => setTimeout(resolve));
    }
    analysis.state = names.length === withSites.length ? "ready" : "error";
    renderRules();
  }

  // A 排在 B 之后，且 B 是"包含方"（A 被 B 覆盖的比例高于反向，排除两者只是共享一块的情况），
  // 覆盖达到比例或数量阈值时，A 的这部分流量会被 B 截走
  function ruleConflicts() {
    const out = new Map();
    if (analysis.state !== "ready" && analysis.state !== "error") return out;
    const order = effectiveSelected();
    order.forEach((a, j) => {
      for (let i = 0; i < j; i++) {
        const b = order[i];
        const pct = analysis.cover[a]?.[b] || 0;
        const hits = analysis.hits[a]?.[b] || 0;
        if (pct <= (analysis.cover[b]?.[a] || 0)) continue;
        if (pct < CONFLICT_RATIO && hits < CONFLICT_HITS) continue;
        const prev = out.get(a);
        const worse = !prev || pct > prev.pct;
        out.set(a, { first: prev?.first ?? b, by: worse ? b : prev.by, pct: worse ? pct : prev.pct, hits: worse ? hits : prev.hits });
      }
    });
    return out;
  }

  function bindRules() {
    $("#presetSwitch").addEventListener("click", (e) => {
      const preset = e.target.closest("button")?.dataset.preset;
      if (!preset || preset === state.preset) return;
      if (preset === "custom") {
        // 显式切回自定义：完整恢复上次的勾选与顺序；从没自定义过则从当前预设开始
        if (state.selected.length) state.preset = "custom";
        else enterCustom();
      } else state.preset = preset;
      renderRules();
      refreshRuleFeet();
      changed();
    });
    $("#ruleGrid").addEventListener("click", (e) => {
      const name = e.target.closest(".rule-tile")?.dataset.rule;
      if (!name || e.target.closest("[data-grip]")) return;
      enterCustom();
      state.selected = state.selected.includes(name) ? state.selected.filter((n) => n !== name) : [...state.selected, name];
      renderRules();
      refreshRuleFeet();
      changed();
    });
    bindRuleDrag($("#ruleGrid"));
    $("#ruleConflicts").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fix]");
      if (!btn) return;
      enterCustom();
      const order = state.order.filter((n) => n !== btn.dataset.fix);
      order.splice(order.indexOf(btn.dataset.before), 0, btn.dataset.fix);
      state.order = order;
      renderRules();
      refreshRuleFeet();
      changed();
    });
  }

  function bindRuleDrag(grid) {
    let drag = null;
    const tiles = () => $$(".rule-tile", grid);

    const flip = (mutate) => {
      const before = new Map(tiles().map((t) => [t, t.getBoundingClientRect()]));
      mutate();
      before.forEach((b, t) => {
        if (t === drag.tile) return;
        const a = t.getBoundingClientRect();
        const dx = b.left - a.left;
        const dy = b.top - a.top;
        if (!dx && !dy) return;
        t.style.transition = "none";
        t.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          t.style.transition = "transform 0.2s var(--ease)";
          t.style.transform = "";
        });
      });
    };

    grid.addEventListener("pointerdown", (e) => {
      const grip = e.target.closest("[data-grip]");
      if (!grip || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      enterCustom();
      $$("#presetSwitch button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.preset === "custom")));
      const tile = grip.closest(".rule-tile");
      const rect = tile.getBoundingClientRect();
      drag = { tile, grip, id: e.pointerId, x0: e.clientX, y0: e.clientY, rect, moved: false, ghost: null };
      grip.setPointerCapture(e.pointerId);
    });

    grid.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        const ghost = drag.tile.cloneNode(true);
        ghost.classList.add("rule-tile-ghost");
        Object.assign(ghost.style, { left: `${drag.rect.left}px`, top: `${drag.rect.top}px`, width: `${drag.rect.width}px`, height: `${drag.rect.height}px` });
        document.body.appendChild(ghost);
        drag.ghost = ghost;
        drag.tile.classList.add("is-dragging");
      }
      drag.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
      // 用布局坐标找目标，避开 FLIP 动画中 transform 造成的命中抖动
      const g = grid.getBoundingClientRect();
      const px = e.clientX - g.left;
      const py = e.clientY - g.top;
      const over = tiles().find((t) => px >= t.offsetLeft && px <= t.offsetLeft + t.offsetWidth && py >= t.offsetTop && py <= t.offsetTop + t.offsetHeight);
      if (!over || over === drag.tile) return;
      const list = tiles();
      const from = list.indexOf(drag.tile);
      const to = list.indexOf(over);
      flip(() => over.insertAdjacentElement(to > from ? "afterend" : "beforebegin", drag.tile));
    });

    const finish = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { tile, ghost, moved } = drag;
      drag = null;
      tile.classList.remove("is-dragging");
      if (!moved) return;
      const to = tile.getBoundingClientRect();
      ghost.style.transition = "transform 0.18s var(--ease), opacity 0.18s";
      ghost.style.transform = `translate(${to.left - parseFloat(ghost.style.left)}px, ${to.top - parseFloat(ghost.style.top)}px)`;
      ghost.style.opacity = "0";
      setTimeout(() => ghost.remove(), 200);
      state.order = tiles().map((t) => t.dataset.rule);
      tiles().forEach((t) => (t.style.transition = t.style.transform = ""));
      renderRules();
      refreshRuleFeet();
      changed();
    };
    grid.addEventListener("pointerup", finish);
    grid.addEventListener("pointercancel", finish);
  }

  // ---------- 03 custom rules ----------
  function nameIssues() {
    const count = new Map();
    state.customRules.forEach((r) => {
      const n = r.name.trim();
      if (n && !BUILTIN.includes(n)) count.set(n, (count.get(n) || 0) + 1);
    });
    const outbounds = new Set(meta.rules.filter((r) => effectiveSelected().includes(r.name)).map((r) => r.outbound));
    FIXED_GROUPS.forEach((g) => outbounds.add(g));
    return {
      dup: new Set([...count].filter(([, n]) => n > 1).map(([name]) => name)),
      conflict: outbounds
    };
  }

  const isMissingSite = (field, v) => field === "site" && geo.status.get(v) === "missing";
  const tokensHtml = (values, newFrom = Infinity, field = "") =>
    values.map((v, i) => `<span class="token${i >= newFrom ? " is-new" : ""}${isMissingSite(field, v) ? " is-bad" : ""}"${isMissingSite(field, v) ? ' title="名单不存在"' : ""}>${esc(v)}<button type="button" data-act="untoken" data-index="${i}" aria-label="移除 ${esc(v)}">${icon("x")}</button></span>`).join("");

  function ruleCardHtml(r, i, total) {
    return `
      <article class="rule-card${r.open ? "" : " is-collapsed"}" data-id="${r.id}">
        <header class="rule-card-head">
          <span class="rule-order">${String(i + 1).padStart(2, "0")}</span>
          <div class="outbound">
            <input class="outbound-input" data-role="name" value="${esc(r.name)}" placeholder="出站：DIRECT / REJECT / 新策略组名" aria-label="出站名称" autocomplete="off" spellcheck="false">
            ${BUILTIN.map((b) => `<button type="button" class="quick" data-act="name" data-value="${b}" aria-pressed="${r.name.trim() === b}">${b}</button>`).join("")}
          </div>
          <div class="rule-card-actions">
            <button type="button" class="icon-btn" data-act="up" aria-label="上移" ${i === 0 ? "disabled" : ""}>${icon("arrow-up")}</button>
            <button type="button" class="icon-btn" data-act="down" aria-label="下移" ${i === total - 1 ? "disabled" : ""}>${icon("arrow-down")}</button>
            <button type="button" class="icon-btn" data-act="remove" aria-label="删除">${icon("trash-2")}</button>
            <button type="button" class="icon-btn" data-act="toggle" aria-label="折叠" aria-expanded="${r.open}">${icon("chevron-down")}</button>
          </div>
        </header>
        <div class="rule-card-body">
          ${FIELDS.map((f) => `
            <div class="field">
              <span class="field-label">${f.label}<span title="${esc(f.hint)}">${icon("circle-help")}</span></span>
              <div class="tokens" data-field="${f.key}">${tokensHtml(r[f.key], Infinity, f.key)}<input type="text" data-role="token" placeholder="${esc(f.placeholder)}" aria-label="${f.label}" autocomplete="off" spellcheck="false"></div>
            </div>`).join("")}
        </div>
        <footer class="rule-card-foot" data-role="foot"></footer>
      </article>`;
  }

  function renderCustomRules() {
    const total = state.customRules.length;
    $("#customList").innerHTML = state.customRules.map((r, i) => ruleCardHtml(r, i, total)).join("");
    refreshRuleFeet();
    validateSites(state.customRules.flatMap((r) => r.site));
  }

  // 在线检查 Geo-Site 名称是否存在，结果回来后刷新标签与卡片提示
  async function validateSites(names) {
    const unchecked = [...new Set(names)].filter((n) => !geo.status.has(n) || geo.status.get(n) === "unknown");
    if (!unchecked.length) return;
    await Promise.all(unchecked.map(loadGeosite));
    $$('.tokens[data-field="site"]', $("#customList")).forEach((container) => renderTokens(container, ruleOf(container)));
    refreshRuleFeet();
  }

  function refreshRuleFeet() {
    const issues = nameIssues();
    state.customRules.forEach((r) => {
      const card = $(`.rule-card[data-id="${r.id}"]`);
      if (!card) return;
      const name = r.name.trim();
      const clashCount = r.site.length + r.ip.length + r.domain_suffix.length + r.domain_keyword.length + r.ip_cidr.length;
      let warn = "";
      if (!name) warn = "填写出站后才会生成规则";
      else if (issues.dup.has(name)) warn = `出站「${name}」重复，同名策略组会导致配置加载失败`;
      else if (!BUILTIN.includes(name) && issues.conflict.has(name)) warn = `出站「${name}」与已有策略组重名`;
      else if (r.site.some((n) => isMissingSite("site", n))) warn = `Geo-Site「${r.site.filter((n) => isMissingSite("site", n)).join("、")}」不存在，sing-box 会因下载规则集失败而无法加载配置`;
      else if (!clashCount && !r.protocol.length) warn = "还没有添加匹配条件";
      const foot = $('[data-role="foot"]', card);
      foot.classList.toggle("is-warn", !!warn);
      if (warn) {
        foot.innerHTML = icon("circle-alert") + `<span>${esc(warn)}</span>`;
      } else {
        const target = BUILTIN.includes(name) ? `${name}，不新建策略组` : `新策略组「${name}」`;
        const proto = r.protocol.length ? "；协议条件仅 sing-box 生效" : "";
        foot.innerHTML = icon("corner-down-right") + `<span>生成 <b>${clashCount}</b> 条 Clash 规则 → ${esc(target)}${proto}</span>`;
      }
      $$(".quick", card).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === name)));
    });
  }

  function renderTokens(container, rule, newFrom) {
    const field = container.dataset.field;
    $$(".token", container).forEach((t) => t.remove());
    $('[data-role="token"]', container).insertAdjacentHTML("beforebegin", tokensHtml(rule[field], newFrom, field));
  }

  function commitTokens(input, raw) {
    const container = input.closest(".tokens");
    const rule = ruleOf(input);
    const list = rule[container.dataset.field];
    const fresh = splitTokens(raw).filter((v) => !list.includes(v));
    if (!fresh.length) return;
    const newFrom = list.length;
    list.push(...fresh);
    renderTokens(container, rule, newFrom);
    refreshRuleFeet();
    changed();
    if (container.dataset.field === "site") validateSites(fresh);
  }

  const ruleOf = (el) => state.customRules.find((r) => r.id === el.closest(".rule-card").dataset.id);

  function bindCustomRules() {
    const list = $("#customList");

    $("#addRule").addEventListener("click", () => {
      state.customRules.push(newRule());
      renderCustomRules();
      $$(".outbound-input", list).at(-1)?.focus();
      persist();
    });

    $("#pinToggle").addEventListener("change", (e) => {
      state.pin = e.target.checked;
      changed();
    });

    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) {
        const tokens = e.target.closest(".tokens");
        if (tokens && e.target === tokens) $('[data-role="token"]', tokens).focus();
        return;
      }
      const rule = ruleOf(btn);
      const index = state.customRules.indexOf(rule);
      const card = btn.closest(".rule-card");
      switch (btn.dataset.act) {
        case "name":
          rule.name = rule.name.trim() === btn.dataset.value ? "" : btn.dataset.value;
          $(".outbound-input", card).value = rule.name;
          refreshRuleFeet();
          changed();
          break;
        case "up":
        case "down": {
          const to = index + (btn.dataset.act === "up" ? -1 : 1);
          [state.customRules[index], state.customRules[to]] = [state.customRules[to], state.customRules[index]];
          renderCustomRules();
          $(`.rule-card[data-id="${rule.id}"] [data-act="${btn.dataset.act}"]`)?.focus();
          changed();
          break;
        }
        case "remove":
          card.classList.add("is-leaving");
          card.addEventListener("animationend", function done(ev) {
            if (ev.target !== card) return;
            card.removeEventListener("animationend", done);
            state.customRules.splice(state.customRules.indexOf(rule), 1);
            renderCustomRules();
            changed();
          });
          break;
        case "toggle":
          rule.open = !rule.open;
          card.classList.toggle("is-collapsed", !rule.open);
          btn.setAttribute("aria-expanded", String(rule.open));
          persist();
          break;
        case "untoken": {
          const container = btn.closest(".tokens");
          rule[container.dataset.field].splice(Number(btn.dataset.index), 1);
          renderTokens(container, rule);
          $('[data-role="token"]', container).focus();
          refreshRuleFeet();
          changed();
          break;
        }
      }
    });

    list.addEventListener("input", (e) => {
      const el = e.target;
      if (el.dataset.role === "name") {
        ruleOf(el).name = el.value;
        refreshRuleFeet();
        changed();
      } else if (el.dataset.role === "token" && /[,，\s]/.test(el.value)) {
        const parts = el.value.split(/[,，\s]+/);
        const rest = parts.pop();
        el.value = rest;
        commitTokens(el, parts.join(","));
      }
    });

    list.addEventListener("keydown", (e) => {
      const el = e.target;
      if (el.dataset.role !== "token" || e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const value = el.value;
        el.value = "";
        commitTokens(el, value);
      } else if (e.key === "Backspace" && !el.value) {
        const rule = ruleOf(el);
        const container = el.closest(".tokens");
        if (rule[container.dataset.field].pop() !== undefined) {
          renderTokens(container, rule);
          refreshRuleFeet();
          changed();
        }
      }
    });

    list.addEventListener("paste", (e) => {
      const el = e.target;
      if (el.dataset.role !== "token") return;
      e.preventDefault();
      commitTokens(el, el.value + (e.clipboardData?.getData("text") || ""));
      el.value = "";
    });

    list.addEventListener("focusout", (e) => {
      const el = e.target;
      if (el.dataset.role === "token" && el.value.trim()) {
        const value = el.value;
        el.value = "";
        commitTokens(el, value);
      }
    });
  }

  // ---------- 04 base config ----------
  function renderBase() {
    $$("#baseTypeSwitch button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === state.baseType)));
    $("#baseMeta").textContent = state.configId ? `已启用 · ${state.configId}` : "未启用";
  }

  function setUrlConfigId(id) {
    const url = new URL(location.href);
    id ? url.searchParams.set("configId", id) : url.searchParams.delete("configId");
    history.pushState({}, "", url);
  }

  function bindBase() {
    if (state.configId) $("#baseBlock").open = true;
    $("#baseTypeSwitch").addEventListener("click", (e) => {
      const type = e.target.closest("button")?.dataset.type;
      if (!type) return;
      state.baseType = type;
      renderBase();
      persist();
    });
    $("#baseConfig").addEventListener("input", (e) => {
      state.baseConfig = e.target.value;
      persist();
    });
    $("#saveBase").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (!state.baseConfig.trim()) return toast("底板配置为空", true);
      btn.disabled = true;
      try {
        const res = await fetch(`/config?type=${state.baseType}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: state.baseType, content: state.baseConfig })
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text);
        state.configId = text;
        setUrlConfigId(text);
        renderBase();
        changed();
        toast("底板已保存并启用");
      } catch (err) {
        toast(err.message || "保存失败", true);
      } finally {
        btn.disabled = false;
      }
    });
    $("#clearBase").addEventListener("click", () => {
      state.configId = "";
      state.baseConfig = "";
      $("#baseConfig").value = "";
      setUrlConfigId("");
      renderBase();
      changed();
    });
  }

  // ---------- preview ----------
  const RULE_RE = /^(DOMAIN-SUFFIX|DOMAIN-KEYWORD|DOMAIN-REGEX|DOMAIN|GEOSITE|GEOIP|IP-CIDR6?|IP-ASN|SRC-IP-CIDR|DST-PORT|SRC-PORT|PROCESS-NAME|RULE-SET|MATCH)(,.*)?$/;
  const span = (cls, s) => `<span class="${cls}">${escText(s)}</span>`;

  function hlYamlValue(v) {
    if (!v) return "";
    const rule = v.match(RULE_RE);
    if (rule) {
      const rest = rule[2] || "";
      const cut = rest.lastIndexOf(",");
      return span("t-type", rule[1]) + escText(rest.slice(0, cut)) + span("t-punc", ",") + span("t-target", rest.slice(cut + 1));
    }
    if (/^(true|false|null|~)$/.test(v)) return span("t-kw", v);
    if (/^-?\d+(\.\d+)?$/.test(v)) return span("t-num", v);
    if (v === "[]" || v === "{}") return span("t-punc", v);
    return span("t-str", v);
  }

  function hlYaml(line) {
    const [, indent, dash, rest] = line.match(/^(\s*)(- )?(.*)$/);
    const head = indent + (dash ? span("t-punc", "-") + " " : "");
    if (rest.startsWith("#")) return head + span("t-punc", rest);
    const kv = rest.match(/^('[^']*'|"[^"]*"|[^\s'"][^]*?):(?=\s|$)\s?(.*)$/);
    if (kv) return head + span("t-key", kv[1]) + span("t-punc", ":") + (kv[2] ? " " + hlYamlValue(kv[2]) : "");
    return head + hlYamlValue(rest);
  }

  const hlJson = (line) =>
    escText(line).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g, (m, str, colon, kw, num) => {
      if (str) return colon ? `<span class="t-key">${str}</span><span class="t-punc">${colon}</span>` : `<span class="t-str">${str}</span>`;
      return kw ? `<span class="t-kw">${kw}</span>` : `<span class="t-num">${num}</span>`;
    });

  function hlXray(line) {
    const m = line.match(/^([a-z0-9]+)(:\/\/)(.*)$/i);
    return m ? span("t-proto", m[1]) + span("t-punc", m[2]) + escText(m[3]) : escText(line);
  }

  const HIGHLIGHT = { clash: hlYaml, singbox: hlJson, xray: hlXray };
  const SECTION_RE = { clash: /^([A-Za-z][\w-]*):/, singbox: /^ {2}"([\w-]+)":/ };

  function decodeBase64Utf8(b64) {
    const bin = atob(b64.trim());
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function setStatus(kind, text) {
    const el = $("#status");
    el.dataset.state = kind;
    $(".status-text", el).textContent = text;
  }

  function renderPreviewNote() {
    const note = $("#previewNote");
    const hasSub = /^https?:\/\//im.test(state.input);
    const text = !state.input.trim() ? "未填写节点，当前使用示例节点预览" : hasSub ? "包含订阅地址，预览时由服务端实时拉取，可能稍慢" : "";
    note.hidden = !text;
    $("span", note).textContent = text;
  }

  function renderCode(text, tab) {
    const lines = text.replace(/\n$/, "").split("\n");
    const prev = preview.lines[tab];
    const remaining = new Map();
    prev?.forEach((l) => remaining.set(l, (remaining.get(l) || 0) + 1));
    let firstNew = -1;
    const highlight = HIGHLIGHT[tab];
    const html = lines
      .map((line, i) => {
        let isNew = false;
        if (prev) {
          const n = remaining.get(line);
          if (n) remaining.set(line, n - 1);
          else {
            isNew = true;
            if (firstNew < 0) firstNew = i;
          }
        }
        return `<div class="ln${isNew ? " is-new" : ""}">${highlight(line) || " "}</div>`;
      })
      .join("");
    const code = $("#code");
    code.innerHTML = html;
    preview.lines[tab] = lines;
    preview.text[tab] = text;

    const re = SECTION_RE[tab];
    $("#sectionChips").innerHTML = re
      ? lines.map((l, i) => [l.match(re)?.[1], i]).filter(([name]) => name).map(([name, i]) => `<button type="button" data-line="${i}">${esc(name)}</button>`).join("")
      : "";
    $("#previewMeta").textContent = `${lines.length} 行 · ${formatBytes(new Blob([text]).size)}`;

    if (preview.reason === "edit" && firstNew >= 0) scrollToLine(firstNew, true);
  }

  function scrollToLine(index, onlyIfHidden = false) {
    const view = $("#codeView");
    const el = $("#code").children[index];
    if (!el) return;
    const top = el.offsetTop;
    if (onlyIfHidden && top > view.scrollTop + 24 && top < view.scrollTop + view.clientHeight - 48) return;
    view.scrollTo({ top: Math.max(0, top - (onlyIfHidden ? view.clientHeight / 3 : 2)), behavior: "smooth" });
  }

  async function runPreview() {
    const tab = state.tab;
    const url = buildUrls(state.input.trim() ? state.input : SAMPLE_NODE, "")[tab];
    preview.ctrl?.abort();
    preview.ctrl = new AbortController();
    const seq = ++preview.seq;
    const code = $("#code");
    const dim = setTimeout(() => code.classList.add("is-dim"), 200);
    setStatus("loading", "生成中");
    renderPreviewNote();
    const started = performance.now();
    try {
      const res = await fetch(url, { signal: preview.ctrl.signal });
      let text = await res.text();
      if (seq !== preview.seq) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}\n${text}`);
      if (tab === "xray") text = decodeBase64Utf8(text);
      renderCode(text, tab);
      setStatus("ok", `已更新 · ${Math.round(performance.now() - started)}ms`);
    } catch (err) {
      if (err.name === "AbortError" || seq !== preview.seq) return;
      code.innerHTML = `<div class="code-error">${esc(err.message)}</div>`;
      $("#sectionChips").innerHTML = "";
      $("#previewMeta").textContent = "";
      preview.lines[tab] = null;
      setStatus("error", "生成失败");
    } finally {
      clearTimeout(dim);
      if (seq === preview.seq) code.classList.remove("is-dim");
    }
  }

  const schedulePreview = debounce(runPreview, 400);

  function bindPreview() {
    $("#tabs").addEventListener("click", (e) => {
      const tab = e.target.closest("button")?.dataset.tab;
      if (!tab || tab === state.tab) return;
      state.tab = tab;
      renderTabs();
      persist();
      preview.reason = "tab";
      $("#codeView").scrollTop = 0;
      runPreview();
    });
    $("#sectionChips").addEventListener("click", (e) => {
      const line = e.target.closest("button")?.dataset.line;
      if (line !== undefined) scrollToLine(Number(line));
    });
    $("#copyPreview").addEventListener("click", () => {
      const text = preview.text[state.tab];
      if (text) copyText(text);
    });
  }

  function renderTabs() {
    $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === state.tab)));
  }

  // ---------- links ----------
  function renderLinks() {
    const rows = $("#linkRows");
    const notice = $("#shortNotice");
    const btn = $("#shortenBtn");
    if (!state.input.trim()) {
      currentLinks = null;
      rows.innerHTML = '<p class="link-empty">填入节点后生成订阅链接</p>';
      $("#linksMeta").textContent = "";
      notice.hidden = true;
      btn.disabled = true;
      return;
    }
    const urls = buildUrls(state.input);
    const code = state.short && state.short.for === urls.singbox ? state.short.code : null;
    currentLinks = Object.fromEntries(LINK_TYPES.map(([key, , p]) => [key, code ? `${location.origin}/${p}/${code}` : urls[key]]));
    rows.innerHTML = LINK_TYPES.map(([key, label]) => `
      <div class="link-row">
        <span class="link-name">${label}</span>
        <span class="link-url${code ? " is-short" : ""}" title="${esc(currentLinks[key])}">${esc(currentLinks[key])}</span>
        <span class="link-actions">
          <button type="button" class="icon-btn" data-copy="${key}" aria-label="复制 ${label} 链接">${icon("copy")}</button>
          <button type="button" class="icon-btn" data-qr="${key}" aria-label="${label} 二维码">${icon("qr-code")}</button>
        </span>
      </div>`).join("");
    $("#linksMeta").textContent = code ? `短链 · ${code}` : "长链接";
    const stale = state.short && !code;
    notice.hidden = !stale;
    if (stale) notice.textContent = `配置已改动，短链「${state.short.code}」仍指向旧配置。点「更新短链」用同一路径覆盖，客户端更新订阅即可生效。`;
    btn.disabled = false;
    btn.innerHTML = icon("scissors") + (stale ? "更新短链" : "生成短链");
  }

  function renderSavedPaths() {
    $("#savedPaths").innerHTML = state.savedPaths
      .map((p) => `<span class="saved-path"><button type="button" data-use="${esc(p)}">${icon("history")}${esc(p)}</button><button type="button" data-del="${esc(p)}" aria-label="删除 ${esc(p)}">${icon("x")}</button></span>`)
      .join("");
  }

  function openQr(key) {
    const text = currentLinks?.[key];
    if (!text) return;
    if (typeof qrcode !== "function") return toast("二维码组件未加载，请检查网络后重试", true);
    try {
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      $("#qrCode").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      $("#qrCaption").textContent = `${LINK_TYPES.find(([k]) => k === key)[1]} · ${state.short?.for === buildUrls(state.input).singbox ? "短链" : "长链接"}`;
      $("#qrDialog").showModal();
    } catch {
      toast("链接太长无法生成二维码，请先生成短链", true);
    }
  }

  function bindLinks() {
    $("#shortPrefix").textContent = `${location.host}/`;
    $("#shortCode").value = state.shortCode;
    $("#linkRows").addEventListener("click", (e) => {
      const copy = e.target.closest("[data-copy]")?.dataset.copy;
      const qr = e.target.closest("[data-qr]")?.dataset.qr;
      if (copy && currentLinks) copyText(currentLinks[copy]);
      if (qr) openQr(qr);
    });
    $("#shortCode").addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^\w-]/g, "");
      state.shortCode = e.target.value;
      persist();
    });
    $("#savedPaths").addEventListener("click", (e) => {
      const use = e.target.closest("[data-use]")?.dataset.use;
      const del = e.target.closest("[data-del]")?.dataset.del;
      if (use) {
        state.shortCode = $("#shortCode").value = use;
        persist();
      }
      if (del) {
        state.savedPaths = state.savedPaths.filter((p) => p !== del);
        renderSavedPaths();
        persist();
      }
    });
    $("#shortenBtn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const urls = buildUrls(state.input);
      const custom = state.shortCode.trim() || (state.short?.for !== urls.singbox ? state.short?.code || "" : "");
      btn.disabled = true;
      btn.innerHTML = icon("loader-circle", "icon-spin") + "生成中";
      try {
        const res = await fetch(`/shorten-v2?url=${encodeURIComponent(urls.singbox)}&shortCode=${encodeURIComponent(custom)}`);
        if (!res.ok) throw new Error();
        state.short = { code: await res.text(), for: urls.singbox };
        if (state.shortCode && !state.savedPaths.includes(state.shortCode)) state.savedPaths.push(state.shortCode);
        renderSavedPaths();
        persist();
        toast("短链已生成");
      } catch {
        toast("生成短链失败，请重试", true);
      } finally {
        renderLinks();
      }
    });
    $("#qrClose").addEventListener("click", () => $("#qrDialog").close());
    $("#qrDialog").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) e.currentTarget.close();
    });
  }

  // ---------- theme ----------
  function bindTheme() {
    const btn = $("#themeToggle");
    const paint = () => (btn.innerHTML = icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon"));
    paint();
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
      paint();
    });
  }

  // ---------- boot ----------
  async function boot() {
    state = loadState();
    hydrateIcons();
    $("#input").value = state.input;
    $("#pinToggle").checked = state.pin;
    $("#baseConfig").value = state.baseConfig;
    $("#input").addEventListener("input", (e) => {
      state.input = e.target.value;
      renderNodes();
      changed();
    });
    bindTheme();
    bindRules();
    bindCustomRules();
    bindBase();
    bindPreview();
    bindLinks();
    renderNodes();
    renderBase();
    renderTabs();
    renderSavedPaths();
    renderCustomRules();
    renderLinks();
    try {
      meta = await (await fetch("/api/rules")).json();
    } catch {
      setStatus("error", "规则数据加载失败");
    }
    const names = ruleNames();
    state.order = [...state.order.filter((n) => names.includes(n)), ...names.filter((n) => !state.order.includes(n))];
    renderRules();
    refreshRuleFeet();
    preview.reason = "init";
    runPreview();
    if (meta.rules.length) analyzeRules();
  }

  boot();
})();
