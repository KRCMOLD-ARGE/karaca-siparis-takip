(() => {
  if (window.__karacaAdminNoteDetailLoaded) return;
  window.__karacaAdminNoteDetailLoaded = true;

  const style = document.createElement("style");
  style.textContent = `
    .admin-detail-note b{
      display:block;
      margin-bottom:5px;
      font-size:10px;
      font-weight:900;
      letter-spacing:.04em;
      text-transform:uppercase;
      color:#344054;
    }
    .admin-detail-note div{
      white-space:pre-wrap;
      line-height:1.55;
    }
  `;
  document.head.appendChild(style);

  if (typeof mapOrder === "function") {
    const baseMapOrder = mapOrder;
    mapOrder = function (raw) {
      const mapped = baseMapOrder(raw);
      mapped.adminNote = raw?.admin_note || "";
      return mapped;
    };
  }

  if (typeof rpc === "function") {
    const baseRpc = rpc;
    rpc = async function (name, args) {
      const result = await baseRpc.call(this, name, args);

      if (name === "app_admin_set_order_note" && typeof orders !== "undefined" && Array.isArray(orders)) {
        const order = orders.find(item => item.id === args?.p_order_id);
        if (order) order.adminNote = String(args?.p_note || "").trim();
      }

      return result;
    };
  }

  function decorateAdminNote(orderId) {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    const order = orders.find(item => item.id === orderId) || null;
    const content = document.getElementById("detailContent");
    if (!order || !content) return;

    content.querySelector("[data-detail-admin-note]")?.remove();
    if (!String(order.adminNote || "").trim()) return;

    const box = document.createElement("div");
    box.className = "note admin-detail-note";
    box.dataset.detailAdminNote = "1";

    const label = document.createElement("b");
    label.textContent = "Admin Notu";

    const text = document.createElement("div");
    text.textContent = order.adminNote;

    box.append(label, text);

    const timeline = content.querySelector(".timeline");
    if (timeline) content.insertBefore(box, timeline);
    else content.appendChild(box);
  }

  if (typeof openDetail === "function") {
    const baseOpenDetail = openDetail;
    openDetail = function (id) {
      const result = baseOpenDetail(id);
      decorateAdminNote(id);
      return result;
    };
  }
})();
