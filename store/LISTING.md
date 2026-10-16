# Chrome Web Store listing

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), field by field, and the steps around it.

## Before the first upload (one time)

1. Turn on 2-Step Verification for the Google account you'll publish with. The dashboard requires it.
2. Register as a Chrome Web Store developer at the dashboard and pay the one-time US$5 fee.
3. In **Account**, set and verify a contact email. Consider a separate address, since it appears publicly.
4. Declare **non-trader** status (you're publishing a free hobby project, not selling). This is the EU Digital Services Act question.
5. In GitHub, confirm the privacy policy URL below loads.

## Each release

1. Bump `version` in `extension/manifest.json` and `package.json` (each upload must be higher than the last).
2. Add an entry to `CHANGELOG.md`.
3. `npm test && npm run build` → upload `dist/amazanban-<version>.zip`.
4. If the UI changed, `npm run store-assets` and replace the screenshots.

---

## Store listing tab

**Name** (from the manifest): Amazanban

**Summary** (from the manifest, max 132 characters):
> Turns your Amazon orders page into a Kanban board grouped by delivery status.

**Description:**

```
See every Amazon package at a glance.

Amazanban turns your Your Orders page on amazon.com into a Kanban board. Each shipment becomes a card, sorted into columns by where it is right now:

• Arriving on a specific date (one column per day, furthest out first)
• Arriving tomorrow
• Arriving today and out for delivery
• Late or needs attention
• Delivered today, yesterday, this week, and earlier
• Return in progress
• Returned and refunded
• Cancelled

Cards show the item pictures and names, the delivery status and note, the order date and total, and buttons to track the package, open the order, or start a return. Orders split into several shipments get one card per box.

Features
• Reads every page of orders in the time range you choose, not only the first 10
• Search by item name, order number, or recipient (press /)
• Collapse the columns you don't care about
• Light and dark themes that follow your system
• One click back to Amazon's normal list view

Privacy
Amazanban runs entirely in your browser. It reads your orders page to draw the board and sends nothing anywhere: no servers, no analytics, no ads. The only thing it saves is your display preferences.

Works on amazon.com (US).

Amazanban is an independent project and is not affiliated with, endorsed by, or sponsored by Amazon.
```

**Category:** Shopping

**Language:** English (United States)

**Store icon:** `extension/icons/icon128.png`

**Screenshots** (1280x800), in this order:
1. `store/screenshots/1-board.png`
2. `store/screenshots/2-delivered-and-returns.png`
3. `store/screenshots/3-dark-mode.png`
4. `store/screenshots/4-search.png`

**Small promo tile** (440x280): `store/promo/small-440x280.png`

**Marquee promo tile** (1400x560, optional): `store/promo/marquee-1400x560.png`

**Official URL:** leave as None (it requires a verified domain).

**Homepage URL:** https://github.com/danmunz/amazanban

**Support URL:** https://github.com/danmunz/amazanban/issues

**Mature content:** No

---

## Privacy tab

**Single purpose:**

```
Amazanban displays the user's amazon.com order history as a Kanban board, grouping each shipment into a column by its delivery status.
```

**Permission justifications:**

`storage`
```
Saves two display preferences on the user's device: whether the board opens automatically, and which columns the user has collapsed.
```

Host permission (`https://www.amazon.com/your-orders/*` and the two older order-history paths, via content scripts)
```
The extension's only function is to redraw the amazon.com order history page as a board. It needs to read that page, and the other pages of the same order list, to build the board. It runs on no other sites or Amazon pages.
```

**Are you using remote code?** No, I am not using remote code.

**Data usage.** Amazanban reads order details from the page but never transmits or stores them, so arguably nothing is "collected." To be safe with review, declare what it handles:

- [x] Personally identifiable information (recipient names on orders)
- [x] Website content (order and item details shown on the page)
- [ ] Everything else unchecked

Then check all three certifications:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/danmunz/amazanban/blob/main/PRIVACY.md

---

## Distribution tab

**Visibility:** Public (or **Unlisted** for a soft launch; anyone with the link can install it, but it won't show in search).

**Regions:** United States is enough, since the extension only supports amazon.com. All regions also works; it will simply do nothing elsewhere.

---

## Review notes

Most first reviews take a few days. Things that commonly trigger questions, and how this extension handles them:

- **Trademark.** The name plays on "Amazon" and the colors echo Amazon's, but the listing uses no Amazon logos or product photos and says it isn't affiliated. If a reviewer pushes back on the name, the fallback is a rename.
- **Hidden iframes.** The extension loads the user's own order pages in hidden frames, because Amazon decrypts them in the page and `fetch()` returns ciphertext. If a reviewer asks, that's the explanation.
- **Broad host access.** The content script matches only order-history paths, which keeps the install warning narrow ("Read and change your data on www.amazon.com").
