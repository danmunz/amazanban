// Renders the Kanban board over the Amazon orders page.
(function () {
  if (window.top !== window || window.__amazanbanLoaded) return;
  window.__amazanbanLoaded = true;

  const { classify, parseDocument, waitForReady, pageNumbers, loadAllPages } = globalThis.Amazanban;

  const DEFAULT_FILTERS = [
    ["last30", "Last 30 days"],
    ["months-3", "Past 3 months"],
    [`year-${new Date().getFullYear()}`, String(new Date().getFullYear())],
    [`year-${new Date().getFullYear() - 1}`, String(new Date().getFullYear() - 1)],
  ];

  const state = {
    open: false,
    shipments: new Map(),
    loading: false,
    progress: null,
    query: "",
    collapsed: new Set(),
    autoOpen: true,
    loadedOnce: false,
  };

  let host, root, boardEl, statusEl, searchEl, summaryEl, launcher;

  // ---------- helpers ----------

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const storage = {
    async get() {
      try {
        return await chrome.storage.local.get(["autoOpen", "collapsed"]);
      } catch (e) {
        return {};
      }
    },
    set(obj) {
      try {
        chrome.storage.local.set(obj);
      } catch (e) {}
    },
  };

  function currentFilter() {
    return new URL(location.href).searchParams.get("timeFilter") || "last30";
  }

  function currentPage() {
    return parseInt(new URL(location.href).searchParams.get("page") || "0", 10) || 0;
  }

  function filterOptions() {
    const sel = document.querySelector('select[name="timeFilter"]');
    if (sel) return [...sel.options].map((o) => [o.value, o.textContent.trim()]);
    return DEFAULT_FILTERS;
  }

  function shortDate(text) {
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) return text;
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  }

  function placedTime(s) {
    const t = new Date(s.placed).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  // ---------- data ----------

  function addShipments(list) {
    for (const s of list) state.shipments.set(s.id, s);
  }

  function buildLanes() {
    const today = new Date();
    const q = state.query.trim().toLowerCase();
    const lanes = new Map();
    const recipients = new Map();
    for (const s of state.shipments.values()) recipients.set(s.shipTo, (recipients.get(s.shipTo) || 0) + 1);
    const mainRecipient = [...recipients.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    for (const s of state.shipments.values()) {
      if (q) {
        const hay = [s.orderId, s.primary, s.secondary, s.shipTo, ...s.items.map((i) => i.title)].join(" ").toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const l = classify(s.primary, s.secondary, { today });
      if (!lanes.has(l.key)) lanes.set(l.key, { ...l, cards: [] });
      lanes.get(l.key).cards.push({ s, sortDate: l.sortDate, showRecipient: s.shipTo && s.shipTo !== mainRecipient });
    }

    for (const lane of lanes.values()) {
      const delivered = lane.key.startsWith("delivered");
      lane.cards.sort((a, b) => {
        if (a.sortDate && b.sortDate && +a.sortDate !== +b.sortDate) {
          return delivered ? b.sortDate - a.sortDate : a.sortDate - b.sortDate;
        }
        return placedTime(b.s) - placedTime(a.s);
      });
    }
    return [...lanes.values()].sort((a, b) => a.order - b.order);
  }

  // ---------- rendering ----------

  function renderCard({ s, showRecipient }) {
    const items = s.items;
    const first = items[0];
    const thumbs = items.slice(0, 4);
    const extra = items.length - thumbs.length;

    const itemList =
      items.length > 1
        ? h(
            "details",
            { class: "items" },
            h("summary", {}, `${items.length} items`),
            h("ul", {}, items.map((it) => h("li", {}, it.url ? h("a", { href: it.url, target: "_blank", rel: "noopener" }, it.title) : it.title)))
          )
        : null;

    const meta = [
      s.placed && `Ordered ${shortDate(s.placed)}`,
      s.total,
      showRecipient && `to ${s.shipTo}`,
      s.shipmentCount > 1 && `Shipment ${s.shipmentIndex + 1} of ${s.shipmentCount}`,
    ].filter(Boolean);

    const actions = [
      s.links.track && h("a", { class: "btn primary", href: s.links.track, target: "_blank", rel: "noopener" }, "Track"),
      s.detailsUrl && h("a", { class: "btn", href: s.detailsUrl, target: "_blank", rel: "noopener" }, "Order details"),
      s.links.returns && h("a", { class: "btn", href: s.links.returns, target: "_blank", rel: "noopener" }, "Return"),
    ].filter(Boolean);

    return h(
      "article",
      { class: "card" },
      thumbs.length
        ? h(
            "div",
            { class: `thumbs n${thumbs.length}` },
            thumbs.map((it) =>
              h(
                "a",
                { class: "thumb", href: it.url || s.detailsUrl || "#", target: "_blank", rel: "noopener", title: it.title },
                it.image ? h("img", { src: it.image, alt: "", loading: "lazy" }) : null
              )
            ),
            extra > 0 ? h("span", { class: "more-badge" }, `+${extra}`) : null
          )
        : null,
      h(
        "div",
        { class: "card-body" },
        first
          ? first.url
            ? h("a", { class: "title", href: first.url, target: "_blank", rel: "noopener", title: first.title }, first.title)
            : h("div", { class: "title" }, first.title)
          : h("div", { class: "title muted" }, s.orderId || "Order"),
        itemList,
        h("div", { class: "status" }, s.primary || "No status"),
        s.secondary ? h("div", { class: "sub" }, s.secondary) : null,
        meta.length ? h("div", { class: "meta" }, meta.join(" · ")) : null,
        actions.length ? h("div", { class: "actions" }, actions) : null
      )
    );
  }

  function renderLane(lane) {
    const collapsed = state.collapsed.has(lane.key);
    const toggle = () => {
      if (state.collapsed.has(lane.key)) state.collapsed.delete(lane.key);
      else state.collapsed.add(lane.key);
      storage.set({ collapsed: [...state.collapsed] });
      render();
    };
    return h(
      "section",
      { class: `lane tone-${lane.tone}${collapsed ? " collapsed" : ""}`, "data-key": lane.key },
      h(
        "button",
        { class: "lane-head", onclick: toggle, "aria-expanded": String(!collapsed), title: collapsed ? "Expand column" : "Collapse column" },
        h("span", { class: "dot" }),
        h("span", { class: "lane-label" }, lane.label),
        lane.hint && !collapsed ? h("span", { class: "lane-hint" }, lane.hint) : null,
        h("span", { class: "count" }, lane.cards.length)
      ),
      collapsed ? null : h("div", { class: "lane-body" }, lane.cards.map(renderCard))
    );
  }

  function renderSummary(lanes) {
    const count = (pred) => lanes.filter(pred).reduce((n, l) => n + l.cards.length, 0);
    const today = count((l) => l.key === "today");
    const tomorrow = count((l) => l.key === "tomorrow");
    const later = count((l) => l.key.startsWith("arriving-") || l.key === "transit" || l.key === "preparing");
    const late = count((l) => l.key === "late");
    const chips = [
      today && h("span", { class: "chip tone-amber" }, `${today} today`),
      tomorrow && h("span", { class: "chip tone-blue" }, `${tomorrow} tomorrow`),
      later && h("span", { class: "chip tone-indigo" }, `${later} on the way`),
      late && h("span", { class: "chip tone-red" }, `${late} need attention`),
    ].filter(Boolean);
    summaryEl.replaceChildren(...chips);
  }

  function renderStatus() {
    const n = state.shipments.size;
    if (state.loading && state.progress) {
      statusEl.replaceChildren(
        h("span", { class: "spinner" }),
        `Loading page ${Math.min(state.progress.loaded + 1, state.progress.total)} of ${state.progress.total}…`
      );
    } else if (state.loading) {
      statusEl.replaceChildren(h("span", { class: "spinner" }), "Reading your orders…");
    } else {
      statusEl.textContent = `${n} shipment${n === 1 ? "" : "s"}`;
    }
  }

  function render() {
    if (!root) return;
    const scrollLeft = boardEl.scrollLeft;
    const laneScroll = {};
    boardEl.querySelectorAll(".lane").forEach((l) => {
      const body = l.querySelector(".lane-body");
      if (body) laneScroll[l.dataset.key] = body.scrollTop;
    });

    const lanes = buildLanes();
    renderSummary(lanes);
    renderStatus();

    if (!lanes.length) {
      boardEl.replaceChildren(
        h(
          "div",
          { class: "empty" },
          state.loading ? "Reading your orders…" : state.query ? `No shipments match “${state.query}”.` : "No orders in this time range."
        )
      );
      return;
    }

    boardEl.replaceChildren(...lanes.map(renderLane));
    boardEl.scrollLeft = scrollLeft;
    boardEl.querySelectorAll(".lane").forEach((l) => {
      const body = l.querySelector(".lane-body");
      if (body && laneScroll[l.dataset.key]) body.scrollTop = laneScroll[l.dataset.key];
    });
  }

  // ---------- shell ----------

  function buildShell() {
    host = document.createElement("div");
    host.id = "amazanban-root";
    host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483000; display: none;";
    root = host.attachShadow({ mode: "open" });
    root.append(h("link", { rel: "stylesheet", href: chrome.runtime.getURL("src/board.css") }));

    const select = h(
      "select",
      {
        class: "filter",
        "aria-label": "Time range",
        onchange: (e) => {
          sessionStorage.setItem("amazanban-open", "1");
          location.href = `/your-orders/orders?timeFilter=${encodeURIComponent(e.target.value)}`;
        },
      },
      filterOptions().map(([v, label]) => h("option", { value: v, selected: v === currentFilter() }, label.charAt(0).toUpperCase() + label.slice(1)))
    );

    searchEl = h("input", {
      class: "search",
      type: "search",
      placeholder: "Search items or order #",
      "aria-label": "Search shipments",
      oninput: (e) => {
        state.query = e.target.value;
        render();
      },
    });

    const autoBox = h("input", {
      type: "checkbox",
      checked: state.autoOpen,
      onchange: (e) => {
        state.autoOpen = e.target.checked;
        storage.set({ autoOpen: state.autoOpen });
      },
    });

    statusEl = h("span", { class: "load-status", role: "status" });
    summaryEl = h("div", { class: "summary" });

    const header = h(
      "header",
      { class: "bar" },
      h("div", { class: "brand" }, h("span", { class: "logo", "aria-hidden": "true" }, h("i"), h("i"), h("i")), h("span", { class: "wordmark" }, "Amazanban")),
      select,
      searchEl,
      summaryEl,
      h("div", { class: "spacer" }),
      statusEl,
      h("button", { class: "icon-btn", title: "Reload orders", "aria-label": "Reload orders", onclick: () => refresh(true) }, "↻"),
      h("label", { class: "auto", title: "Show the board whenever you open Your Orders" }, autoBox, "Open by default"),
      h("button", { class: "close", onclick: () => setOpen(false) }, "List view")
    );

    boardEl = h("main", { class: "board" });
    root.append(h("div", { class: "app" }, header, boardEl));
    document.documentElement.appendChild(host);

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target !== searchEl) setOpen(false);
      if (e.key === "/" && e.target !== searchEl) {
        e.preventDefault();
        searchEl.focus();
      }
    });
  }

  function buildLauncher() {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.textContent = "▦ Board view";
    launcher.title = "Open Amazanban";
    launcher.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:2147482999",
      "padding:10px 16px",
      "border:0",
      "border-radius:999px",
      "background:#131921",
      "color:#fff",
      "font:600 14px/1 system-ui,-apple-system,sans-serif",
      "box-shadow:0 6px 20px rgba(0,0,0,.25)",
      "cursor:pointer",
    ].join(";");
    launcher.addEventListener("click", () => setOpen(true));
    document.body.appendChild(launcher);
  }

  function setOpen(open) {
    state.open = open;
    if (!host) buildShell();
    host.style.display = open ? "block" : "none";
    launcher.style.display = open ? "none" : "block";
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) {
      if (!state.loadedOnce) refresh(false);
      else render();
      setTimeout(() => boardEl.focus?.(), 0);
    }
  }

  async function refresh(reloadCurrent) {
    if (state.loading) return;
    state.loadedOnce = true;
    state.loading = true;
    state.progress = null;
    if (reloadCurrent) state.shipments.clear();
    render();

    // The page we're on: wait for Amazon to decrypt it, then read it directly.
    await waitForReady(document);
    addShipments(parseDocument(document));
    const pages = pageNumbers(document);
    render();

    if (pages.length > 1) {
      state.progress = { loaded: 1, total: Math.max(...pages) + 1 };
      renderStatus();
      await loadAllPages({
        timeFilter: currentFilter(),
        skipPage: currentPage(),
        knownPages: pages,
        onProgress: ({ shipments, loaded, total }) => {
          addShipments(shipments);
          state.progress = { loaded, total };
          render();
        },
      });
    }
    state.loading = false;
    state.progress = null;
    render();
  }

  // ---------- boot ----------

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "amazanban:toggle") setOpen(!state.open);
  });

  (async () => {
    const saved = await storage.get();
    state.autoOpen = saved.autoOpen !== false;
    state.collapsed = new Set(saved.collapsed || []);
    buildLauncher();
    const reopen = sessionStorage.getItem("amazanban-open") === "1";
    sessionStorage.removeItem("amazanban-open");
    if (state.autoOpen || reopen) setOpen(true);
  })();
})();
