// Reads shipments out of an Amazon "Your Orders" document.
//
// Amazon serves the order cards encrypted and decrypts them in the page
// ("Siege client-side decryption"), so a plain fetch() of another page is
// useless. Extra pages are loaded in hidden same-origin iframes and read once
// their cards have decrypted.
(function () {
  const ORDER_ID_RE = /\b([A-Z0-9]{3}-\d{7}-\d{7})\b/;
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();

  function abs(href, base) {
    if (!href || href.startsWith("javascript:")) return null;
    try {
      return new URL(href, base).href;
    } catch (e) {
      return null;
    }
  }

  function readHeader(card) {
    const out = { placed: "", total: "", shipTo: "", orderId: "", detailsUrl: null, invoiceUrl: null };
    const header = card.querySelector(".order-header") || card;
    header.querySelectorAll(".order-header__header-list-item, li").forEach((li) => {
      const label = clean(li.querySelector(".a-text-caps")?.textContent).toLowerCase();
      if (!label) return;
      if (label.startsWith("ship to")) {
        out.shipTo = clean(li.querySelector(".a-popover-trigger")?.textContent || li.querySelector(".a-row.a-size-base")?.textContent);
        return;
      }
      const rows = li.querySelectorAll(".a-row");
      const value = clean(rows[rows.length - 1]?.textContent);
      if (label.startsWith("order placed")) out.placed = value;
      else if (label.startsWith("total")) out.total = value;
    });
    const idMatch = clean(header.textContent).match(ORDER_ID_RE);
    if (idMatch) out.orderId = idMatch[1];
    header.querySelectorAll("a").forEach((a) => {
      const t = clean(a.textContent).toLowerCase();
      if (t.includes("order details")) out.detailsUrl = abs(a.getAttribute("href"), card.ownerDocument.baseURI);
      if (t.includes("invoice")) out.invoiceUrl = abs(a.getAttribute("href"), card.ownerDocument.baseURI);
    });
    return out;
  }

  // Amazon has several item layouts (.item-box, .yo-enhanced-flex-card, ...), but
  // each item always has an image link and a title link to its product page, so
  // group the product links by ASIN instead of relying on a container class.
  const ASIN_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/;

  function readItems(scope, base) {
    const byAsin = new Map();
    scope.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      const asin = (href.match(ASIN_RE) || [])[1];
      if (!asin) return;
      if (!byAsin.has(asin)) byAsin.set(asin, { title: "", url: abs(href, base), image: null });
      const item = byAsin.get(asin);
      const img = a.querySelector("img");
      if (img && !item.image) item.image = img.getAttribute("data-a-hires") || img.getAttribute("src");
      const text = clean(a.textContent);
      if (text && text.length > item.title.length) item.title = text;
      if (!item.title && img) item.title = clean(img.getAttribute("alt"));
    });
    // Items without a product page (e.g. some digital or in-store orders).
    if (!byAsin.size) {
      scope.querySelectorAll(".product-image img, .item-box img").forEach((img, i) => {
        byAsin.set(`img${i}`, { title: clean(img.getAttribute("alt")), url: null, image: img.getAttribute("src") });
      });
    }
    return [...byAsin.values()];
  }

  function readLinks(scope, base) {
    const links = {};
    scope.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const t = clean(a.textContent).toLowerCase();
      if (!links.track && (href.includes("progress-tracker") || t === "track package")) links.track = abs(href, base);
      else if (!links.returns && (href.includes("/spr/returns") || t.startsWith("return"))) links.returns = abs(href, base);
    });
    return links;
  }

  function parseDocument(doc) {
    const base = doc.baseURI;
    const shipments = [];
    doc.querySelectorAll(".order-card").forEach((card, cardIdx) => {
      const header = readHeader(card);
      if (!header.orderId && !header.placed) return; // still encrypted
      const orderKey = header.orderId || `${header.placed}-${header.total}-${cardIdx}`;
      let boxes = [...card.querySelectorAll(".delivery-box")];
      if (!boxes.length) boxes = [card];
      boxes.forEach((box, i) => {
        const primary = clean(box.querySelector(".delivery-box__primary-text, .yohtmlc-shipment-status-primaryText")?.textContent);
        const secondary = clean(box.querySelector(".delivery-box__secondary-text, .yohtmlc-shipment-status-secondaryText")?.textContent);
        shipments.push({
          id: `${orderKey}#${i}`,
          ...header,
          shipmentIndex: i,
          shipmentCount: boxes.length,
          primary,
          secondary,
          items: readItems(box, base),
          links: readLinks(box, base),
        });
      });
    });
    return shipments;
  }

  // True once every order card on the page has decrypted and has status text.
  function isReady(doc) {
    const cards = doc.querySelectorAll(".order-card");
    if (!cards.length) return false;
    for (const c of cards) {
      if (!c.querySelector(".order-header")) return false;
      for (const p of c.querySelectorAll(".delivery-box__primary-text")) {
        if (!clean(p.textContent)) return false;
      }
    }
    return true;
  }

  function hasNoOrders(doc) {
    return !doc.querySelector(".order-card") && /no orders|0 orders|haven't placed/i.test(clean(doc.querySelector(".your-orders-content-container")?.textContent));
  }

  function waitForReady(doc, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const start = Date.now();
      let lastCount = -1;
      let stable = 0;
      const tick = () => {
        const count = doc.querySelectorAll(".order-card .order-header").length;
        stable = count === lastCount ? stable + 1 : 0;
        lastCount = count;
        if ((isReady(doc) && stable >= 1) || hasNoOrders(doc) || Date.now() - start > timeoutMs) return resolve(doc);
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  // Page numbers (0-based) listed in this document's pagination.
  function pageNumbers(doc) {
    const nums = new Set();
    doc.querySelectorAll(".a-pagination a[href]").forEach((a) => {
      try {
        const n = parseInt(new URL(a.getAttribute("href"), doc.baseURI).searchParams.get("page"), 10);
        if (!Number.isNaN(n)) nums.add(n);
      } catch (e) {}
    });
    return [...nums].sort((a, b) => a - b);
  }

  function loadPageInFrame(url) {
    return new Promise((resolve) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;visibility:hidden;";
      let finished = false;
      const done = (result) => {
        if (finished) return;
        finished = true;
        frame.remove();
        resolve(result);
      };
      const hardTimeout = setTimeout(() => done({ shipments: [], pages: [] }), 25000);
      frame.addEventListener("load", async () => {
        try {
          const doc = frame.contentDocument;
          await waitForReady(doc);
          const result = { shipments: parseDocument(doc), pages: pageNumbers(doc) };
          clearTimeout(hardTimeout);
          done(result);
        } catch (e) {
          clearTimeout(hardTimeout);
          done({ shipments: [], pages: [] });
        }
      });
      frame.src = url;
      document.documentElement.appendChild(frame);
    });
  }

  // Loads every page for the current time filter. Calls onProgress as pages land.
  async function loadAllPages({ timeFilter, skipPage, knownPages, maxPages = 25, concurrency = 3, onProgress }) {
    const queue = new Set(knownPages.filter((p) => p !== skipPage && p < maxPages));
    const done = new Set([skipPage]);
    const all = [];
    let active = 0;
    let loaded = 1;
    return new Promise((resolve) => {
      const pump = () => {
        if (!queue.size && !active) return resolve(all);
        while (active < concurrency && queue.size) {
          const page = queue.values().next().value;
          queue.delete(page);
          done.add(page);
          active++;
          const url = `/your-orders/orders?timeFilter=${encodeURIComponent(timeFilter)}&page=${page}`;
          loadPageInFrame(url).then(({ shipments, pages }) => {
            active--;
            loaded++;
            all.push(...shipments);
            // Pagination only shows a window of pages; queue any newly revealed ones.
            pages.forEach((p) => {
              if (!done.has(p) && p < maxPages) queue.add(p);
            });
            onProgress && onProgress({ shipments, loaded, total: done.size + queue.size });
            pump();
          });
        }
      };
      pump();
    });
  }

  Object.assign(globalThis.Amazanban, { parseDocument, waitForReady, pageNumbers, loadAllPages });
})();
