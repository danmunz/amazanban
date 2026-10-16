// Maps Amazon's shipment status text ("Arriving tomorrow", "Delivered October 15",
// "Return started", ...) to a board column.
(function () {
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/gi;
  const DAY = 86400000;

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  }

  // Amazon omits the year; pick the one that lands closest to the expected side of today.
  function resolveYear(month, day, today, mode) {
    const y = today.getFullYear();
    const candidates = [y - 1, y, y + 1].map((yy) => new Date(yy, month, day));
    let best = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      const diff = daysBetween(today, c);
      let score = Math.abs(diff);
      if (mode === "past" && diff > 1) score += 400;
      if (mode === "future" && diff < -45) score += 400;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  function findDates(text, today, mode) {
    const out = [];
    MONTH_RE.lastIndex = 0;
    let m;
    while ((m = MONTH_RE.exec(text))) {
      const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      const day = parseInt(m[2], 10);
      if (month < 0 || day < 1 || day > 31) continue;
      out.push(m[3] ? new Date(parseInt(m[3], 10), month, day) : resolveYear(month, day, today, mode));
    }
    if (!out.length) {
      const t = text.toLowerCase();
      if (/\btoday\b/.test(t)) out.push(startOfDay(today));
      else if (/\btomorrow\b/.test(t)) out.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
      else if (/\byesterday\b/.test(t)) out.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
      else {
        const wd = WEEKDAYS.findIndex((w) => t.includes(w));
        if (wd >= 0) {
          let delta = wd - today.getDay();
          if (mode === "past") {
            if (delta > 0) delta -= 7;
          } else if (delta < 0) {
            delta += 7;
          }
          out.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta));
        }
      }
    }
    return out;
  }

  const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const fmtShort = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Column order, left to right, follows a package's life: ordered → on the way
  // (furthest dates first) → today → delivered (newest first) → returns.
  const LANES = {
    preparing: { order: 100, label: "Preparing to ship", tone: "slate" },
    transit: { order: 150, label: "On the way", tone: "indigo" },
    // arriving-YYYY-MM-DD lanes are created on the fly with order 200..399
    tomorrow: { order: 400, label: "Arriving tomorrow", tone: "blue" },
    today: { order: 500, label: "Arriving today", tone: "amber" },
    late: { order: 550, label: "Late or needs attention", tone: "red" },
    deliveredToday: { order: 600, label: "Delivered today", tone: "green" },
    deliveredYesterday: { order: 610, label: "Delivered yesterday", tone: "green" },
    deliveredWeek: { order: 620, label: "Delivered this week", tone: "sage" },
    deliveredEarlier: { order: 630, label: "Delivered earlier", tone: "sage" },
    returning: { order: 700, label: "Return in progress", tone: "violet" },
    returned: { order: 800, label: "Returned & refunded", tone: "teal" },
    cancelled: { order: 900, label: "Cancelled", tone: "gray" },
    instore: { order: 950, label: "In store & digital", tone: "gray" },
    other: { order: 990, label: "Other", tone: "gray" },
  };

  function lane(key, extra) {
    return Object.assign({ key }, LANES[key], extra || {});
  }

  function arrivingLane(date, dates, today) {
    const days = daysBetween(today, date);
    if (days <= 0) return lane("today", { sortDate: date });
    if (days === 1) return lane("tomorrow", { sortDate: date });
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const label = days < 7 ? `Arriving ${fmtDay(date)}` : `Arriving ${fmtShort(date)}`;
    // Further-out dates sit further left.
    return {
      key: `arriving-${iso}`,
      order: 399 - Math.min(days, 199),
      label,
      tone: "indigo",
      sortDate: date,
      hint: days === 2 ? "In 2 days" : `In ${days} days`,
    };
  }

  function classify(primary, secondary, opts) {
    const today = (opts && opts.today) || new Date();
    const p = (primary || "").replace(/\s+/g, " ").trim();
    const s = (secondary || "").replace(/\s+/g, " ").trim();
    const pl = p.toLowerCase();
    const both = `${pl} ${s.toLowerCase()}`;

    if (!p) return lane("other");
    if (/cancel/.test(pl)) return lane("cancelled");
    if (/return complete|refund issued|^refunded|refund (has been )?processed|return received|item returned/.test(pl)) {
      return lane("returned");
    }
    if (/return|replacement|refund/.test(pl)) return lane("returning");

    if (/delivered|picked up/.test(pl)) {
      const [d] = findDates(p, today, "past");
      if (!d) return lane("deliveredEarlier");
      const ago = daysBetween(d, today);
      const extra = { sortDate: d };
      if (ago <= 0) return lane("deliveredToday", extra);
      if (ago === 1) return lane("deliveredYesterday", extra);
      if (ago < 7) return lane("deliveredWeek", extra);
      return lane("deliveredEarlier", extra);
    }

    if (/undeliverable|attempted|delay|running late|lost|unable|problem|returning to sender|return to sender|exception|held|action required|not delivered/.test(both)) {
      return lane("late");
    }

    if (/out for delivery/.test(pl)) return lane("today");

    if (/arriving|expected|now (arriving|expected)|delivery (by|estimate)|estimated|shipped|on the way|in transit|guaranteed/.test(pl)) {
      const dates = findDates(p, today, "future");
      if (!dates.length) return lane("transit");
      const d = dates[0];
      if (daysBetween(today, d) < 0) {
        // The promised date has passed and it isn't delivered.
        const last = dates[dates.length - 1];
        if (daysBetween(today, last) < 0) return lane("late", { sortDate: d });
        return lane("today", { sortDate: d });
      }
      return arrivingLane(d, dates, today);
    }

    if (/preparing|not yet shipped|ordered|order placed|shipping soon|payment|processing|pending/.test(pl)) {
      return lane("preparing");
    }

    if (/purchased at|whole foods|in-store|in store|digital|subscription|kindle|audible|gift card/.test(pl)) {
      return lane("instore");
    }

    return lane("other");
  }

  globalThis.Amazanban = globalThis.Amazanban || {};
  Object.assign(globalThis.Amazanban, { classify, findDates, daysBetween, LANES });
})();
