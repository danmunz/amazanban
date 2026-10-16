// Fake orders rendered with the same markup amazon.com uses on "Your Orders",
// so the real parser and classifier run against them unchanged. Every date is
// relative to today, so the demo always looks current.
(function () {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const today = new Date();
  const day = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const md = (offset) => {
    const d = day(offset);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };
  const full = (offset) => `${md(offset)}, ${day(offset).getFullYear()}`;

  const PALETTE = ["#fde7c8", "#dbeafe", "#dcfce7", "#fce7f3", "#ede9fe", "#fef9c3", "#e0f2fe", "#ffe4e6", "#ecfccb", "#f1f5f9"];
  let imgCount = 0;
  function art(emoji) {
    const bg = PALETTE[imgCount++ % PALETTE.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="284" height="284" viewBox="0 0 284 284"><rect width="284" height="284" rx="28" fill="${bg}"/><text x="142" y="150" font-size="150" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  let asinCount = 0;
  const item = (emoji, title) => ({ emoji, title, asin: `B0DEMO${String(++asinCount).padStart(4, "0")}` });

  // [placed offset, total, recipient, shipments: [primary, secondary, items, links]]
  const T = { track: true };
  const R = { returns: true };
  const TR = { track: true, returns: true };
  const ORDERS = [
    [-1, "$24.99", null, [["Preparing for Shipment", "", [item("🕯️", "Soy Wax Scented Candle, Cedar & Smoke, 8 oz")], {}]]],
    [-3, "$89.00", null, [[`Arriving ${md(8)} - ${md(10)}`, "", [item("🎒", "Waterproof Hiking Backpack, 28L, Forest Green")], TR]]],
    [-2, "$31.48", null, [[`Arriving ${md(5)}`, "", [item("🧩", "1000 Piece Jigsaw Puzzle, Mountain Lake at Dawn"), item("🎲", "Island Explorers Family Board Game")], TR]]],
    [-2, "$15.99", null, [[`Arriving ${md(3)}`, "", [item("📓", "Hardcover Dotted Notebook, 240 Pages, A5")], TR]]],
    [-3, "$42.50", null, [[`Arriving ${md(3)}`, "", [item("🍳", "Pre-Seasoned Cast Iron Skillet, 10 Inch")], TR]]],
    [-1, "$18.97", null, [["Arriving tomorrow", "", [item("🧦", "Merino Wool Hiking Socks, 3 Pack")], TR]]],
    [-2, "$129.00", null, [
      ["Arriving tomorrow", "", [item("🎧", "Wireless Over-Ear Headphones, Noise Cancelling, Navy")], TR],
      [`Delivered ${md(-1)}`, "Your package was left near the front door or porch.", [item("📱", "Clear Phone Case with MagSafe")], TR],
    ]],
    [-1, "$12.49", "Sam Rivera", [["Arriving tomorrow", "", [item("🎃", "Pumpkin Carving Kit, 12 Piece")], TR]]],
    [-1, "$34.99", null, [["Arriving today 5 PM – 10 PM", "", [item("💡", "LED Desk Lamp with USB-C Charging Port, Dimmable")], TR]]],
    [-2, "$22.00", null, [["Out for delivery", "", [item("☕", "Ceramic Pour-Over Coffee Dripper, Matte White"), item("🫘", "Whole Bean Coffee, Medium Roast, 2 lb")], TR]]],
    [-3, "$27.95", null, [["Arriving today", "", [item("🪴", "Terracotta Plant Pot with Drainage, 6 Inch, Set of 2")], TR]]],
    [-6, "$19.99", null, [[`Now arriving ${md(2)}`, "Running late", [item("☂️", "Compact Travel Umbrella, Windproof")], T]]],
    [-2, "$64.00", null, [[`Delivered ${md(0)}`, "Your package was left near the front door or porch.", [item("👟", "Trail Running Shoes, Men's Size 10")], TR]]],
    [-4, "$9.99", null, [[`Delivered ${md(0)}`, "Package was left inside the residence's mailbox", [item("🕶️", "Polarized Sunglasses, Tortoise")], TR]]],
    [-4, "$38.20", null, [[`Delivered ${md(-1)}`, "Package was left in a secure location", [item("🧶", "Chunky Knit Throw Blanket, Oatmeal"), item("🛋️", "Linen Throw Pillow Cover, 18 x 18")], TR]]],
    [-5, "$45.99", null, [[`Delivered ${md(-3)}`, "Your package was left near the front door or porch.", [item("🔊", "Portable Bluetooth Speaker, Waterproof")], TR]]],
    [-6, "$29.95", "Sam Rivera", [[`Delivered ${md(-4)}`, "Your package was left near the front door or porch.", [item("🥾", "Kids' Rain Boots, Yellow, Size 11")], TR]]],
    [-8, "$54.00", null, [[`Delivered ${md(-5)}`, "Package was left in a secure location", [item("🧘", "Non-Slip Yoga Mat, 6mm, Sage Green"), item("🧱", "Cork Yoga Block, Set of 2"), item("🎀", "Cotton Yoga Strap, 8 ft")], TR]]],
    [-12, "$16.99", null, [[`Delivered ${md(-9)}`, "Your package was left near the front door or porch.", [item("⌚", "Silicone Watch Band, 41mm, Midnight")], TR]]],
    [-15, "$74.99", null, [[`Delivered ${md(-12)}`, "", [item("🧰", "Home Tool Kit, 65 Piece")], TR]]],
    [-20, "$21.49", null, [[`Delivered ${md(-17)}`, "Your package was left near the front door or porch.", [item("⚖️", "Digital Kitchen Scale, Stainless Steel")], TR]]],
    [-9, "$33.00", null, [["Return started", "Your refund will be processed when we receive your item.", [item("🥤", "Insulated Water Bottle, 24 oz, Sky Blue")], R]]],
    [-11, "$58.00", null, [["Replacement ordered", "Your replacement has been ordered.", [item("🎾", "Pressurized Tennis Balls, 12 Pack")], R]]],
    [-18, "$26.99", null, [["Return complete", "Your return is complete. Your refund has been issued.", [item("🧢", "Cotton Baseball Cap, Washed Black")], {}]]],
    [-21, "$49.95", null, [["Refund issued", "A refund will appear on your original payment method in 3-5 business days.", [item("🫖", "Glass Teapot with Infuser, 32 oz")], {}]]],
    [-7, "$11.99", null, [["Cancelled", "Your order was cancelled. You have not been charged for this order.", [item("🖍️", "Washable Crayons, 24 Count")], {}]]],
    [-10, "$38.62", null, [["Purchased at Whole Foods Market", "", [
      item("🍌", "Organic Bananas, 1 Bunch"), item("🥑", "Hass Avocados, 4 Count"), item("🍞", "Sourdough Bread Loaf"),
      item("🧀", "Aged White Cheddar, 8 oz"), item("🍓", "Strawberries, 1 lb"), item("🥛", "Whole Milk, Half Gallon"),
    ], {}]]],
  ];

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let orderNum = 0;

  function headerItem(label, value) {
    return `<li class="order-header__header-list-item"><div class="a-row a-size-mini"><span class="a-text-caps">${label}</span></div><div class="a-row"><span>${esc(value)}</span></div></li>`;
  }

  function cardHTML([placed, total, recipient, shipments]) {
    const id = `112-${String(1000000 + ++orderNum * 7919).slice(-7)}-${String(4000000 + orderNum * 104729).slice(-7)}`;
    const shipTo = recipient || "Alex Rivera";
    const boxes = shipments
      .map(([primary, secondary, items, links]) => {
        const itemsHTML = items
          .map(
            (it) => `<div class="item-box"><div class="product-image"><a href="https://www.amazon.com/dp/${it.asin}"><img alt="${esc(it.title)}" src="${art(it.emoji)}"></a></div>
            <div class="yohtmlc-product-title"><a href="https://www.amazon.com/dp/${it.asin}">${esc(it.title)}</a></div></div>`
          )
          .join("");
        return `<div class="a-box delivery-box">
          <span class="delivery-box__primary-text">${esc(primary)}</span>
          ${secondary ? `<div class="delivery-box__secondary-text">${esc(secondary)}</div>` : ""}
          ${itemsHTML}
          ${links.track ? `<a href="https://www.amazon.com/progress-tracker/package?orderId=${id}">Track package</a>` : ""}
          ${links.returns ? `<a href="https://www.amazon.com/spr/returns/cart?orderId=${id}">Return or replace items</a>` : ""}
        </div>`;
      })
      .join("");
    return `<div class="order-card">
      <div class="order-header"><ul>
        ${headerItem("Order placed", full(placed))}
        ${headerItem("Total", total)}
        <li class="order-header__header-list-item"><div class="a-row a-size-mini"><span class="a-text-caps">Ship to</span></div><div class="a-row a-size-base"><a class="a-popover-trigger">${esc(shipTo)}</a></div></li>
        <li>ORDER # ${id} <a href="https://www.amazon.com/gp/your-account/order-details?orderID=${id}">View order details</a></li>
      </ul></div>
      ${boxes}
    </div>`;
  }

  document.getElementById("orders").innerHTML = ORDERS.map(cardHTML).join("");
})();
