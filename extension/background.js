// Toolbar button: toggle the board on an orders page, or open the orders page.
const ORDERS_URL = "https://www.amazon.com/your-orders/orders?timeFilter=last30";
const ORDERS_RE = /^https:\/\/www\.amazon\.com\/(your-orders\/|gp\/your-account\/order-history|gp\/css\/order-history)/;

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && ORDERS_RE.test(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "amazanban:toggle" });
      return;
    } catch (e) {
      // Content script not ready (e.g. tab opened before install); reload.
      chrome.tabs.reload(tab.id);
      return;
    }
  }
  chrome.tabs.create({ url: ORDERS_URL });
});
