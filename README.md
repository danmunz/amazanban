# Amazanban

A Chrome extension that turns amazon.com **Your Orders** into a Kanban board. Each shipment gets a card, and cards are grouped into columns by delivery status: arriving on a given date, arriving tomorrow, arriving today, delivered yesterday, returned, and so on.

![Amazanban icon](extension/icons/icon128.png)

## Install

Amazanban isn't on the Chrome Web Store yet, so you load it unpacked:

1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Go to [Your Orders](https://www.amazon.com/your-orders/orders). The board opens on its own.

To update, `git pull` and click the reload icon on Amazanban's card in `chrome://extensions`.

## Using it

**Columns** run left to right in the order a package moves. Empty columns are hidden.

| Column | What lands there |
| --- | --- |
| Preparing to ship | "Preparing for Shipment", "Not yet shipped" |
| On the way | "Shipped", with no date given |
| Arriving *Thu, Oct 22* | One column per expected date, furthest out on the left |
| Arriving tomorrow | |
| Arriving today | Includes "Out for delivery" |
| Late or needs attention | Promised date has passed, "Delivery attempted", "Running late" |
| Delivered today / yesterday / this week / earlier | |
| Return in progress | "Return started", "Replacement ordered" |
| Returned & refunded | "Return complete", "Refund issued" |
| Cancelled | |
| In store & digital | Whole Foods purchases and other orders without a shipment |
| Other | Any status wording Amazanban doesn't recognize yet |

**Controls**

- **Time range** switches Amazon's filter (last 30 days, past 3 months, or a year). Amazanban reads every page in that range, not just the first 10 orders.
- **Search** (press `/`) filters by item name, order number, status, or recipient.
- Click a column header to collapse it. Your choice is remembered.
- **List view** (or `Esc`) goes back to Amazon's own page. The **▦ Board view** button in the corner, or the toolbar icon, brings the board back.
- Uncheck **Open by default** if you want the board only when you ask for it.

## Privacy

Everything runs in your browser on amazon.com. Amazanban sends no data anywhere and has no analytics. The only thing it stores is your preferences, in `chrome.storage.local`.

## Development

There are no dependencies to install. You need Node 20+ for the tests and build, and Python with Pillow only if you want to regenerate the icons.

```bash
npm test
```

```bash
npm run check
```

```bash
npm run build
```

`npm test` runs the status-classifier tests, `npm run check` syntax-checks the scripts, and `npm run build` zips `extension/` into `dist/amazanban-<version>.zip` for the Web Store. Bump `version` in both `extension/manifest.json` and `package.json` before building; the build stops if they differ.

### Layout

```
extension/
  manifest.json      Manifest V3
  background.js      Toolbar button: toggles the board, or opens Your Orders
  src/classify.js    Status text → column
  src/parse.js       Reads order cards; loads the other pages
  src/board.js       Board UI (in a shadow root, so Amazon's CSS can't leak in)
  src/board.css
  icons/
scripts/             build.js, make-icons.py
test/                node:test tests
```

### How it reads your orders

Amazon serves the order cards encrypted and decrypts them in the page with JavaScript. A plain `fetch()` of page 2 returns ciphertext. So `parse.js` loads each remaining page in a hidden same-origin iframe, waits for the cards to decrypt, and reads the DOM there, three pages at a time.

Within a page, each `.order-card` is an order and each `.delivery-box` inside it is a shipment. The status line is `.delivery-box__primary-text`. Amazon uses at least two item layouts (`.item-box` and `.yo-enhanced-flex-card`), so items are found by grouping `/dp/<ASIN>` links instead of by container class.

### When Amazon changes its wording

New status text shows up in the **Other** column. To handle it, add a pattern in `extension/src/classify.js` and a matching case in `test/classify.test.js`.

## Limitations

- amazon.com (US) only. Other Amazon domains use different URLs and languages.
- Statuses are read-only. The columns reflect what Amazon says, so you can't drag cards between them.
- Loading a full year can take a while, since each page of 10 orders loads in its own frame.

## License

[MIT](LICENSE)
