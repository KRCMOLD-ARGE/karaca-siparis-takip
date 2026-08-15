(() => {
  if (window.__karacaUrgentOrdersLoaded) return;
  window.__karacaUrgentOrdersLoaded = true;

  const orderForm = document.getElementById("orderForm");
  const orderNote = document.getElementById("orderNote");

  function ensureUrgentField() {
    if (!orderForm || document.getElementById("orderUrgent")) return;

    const wrap = document.createElement("div");
    wrap.className = "span2 urgent-order-field";
    wrap.innerHTML = `
      <span class="urgent-order-field-title">Öncelik</span>
      <label class="urgent-order-check">
        <input id="orderUrgent" type="checkbox">
        <span>
          <strong>ACİL Sipariş</strong>
          <small>Öncelikli işlenmesi gereken siparişlerde işaretleyin.</small>
        </span>
      </label>
    `;

    const noteLabel = orderNote?.closest("label");
    if (noteLabel) noteLabel.insertAdjacentElement("beforebegin", wrap);
    else orderForm.querySelector(".form-grid")?.appendChild(wrap);
  }

  ensureUrgentField();

  if (typeof mapOrder === "function") {
    const baseMapOrder = mapOrder;
    mapOrder = function (raw) {
      const mapped = baseMapOrder(raw);
      mapped.urgent = raw?.urgent === true;
      return mapped;
    };
  }

  if (typeof rpc === "function") {
    const baseRpc = rpc;
    rpc = async function (name, args) {
      let nextArgs = args;
      if (name === "app_create_order_scoped") {
        nextArgs = {
          ...(args || {}),
          p_urgent: !!document.getElementById("orderUrgent")?.checked
        };
      }
      return baseRpc.call(this, name, nextArgs);
    };
  }

  function urgentPriority(order) {
    return order?.urgent && order?.phase !== "done" ? 1 : 0;
  }

  if (typeof roleOrders === "function") {
    const baseRoleOrders = roleOrders;
    roleOrders = function () {
      const list = baseRoleOrders();
      if (!Array.isArray(list)) return list;
      return [...list].sort((a, b) => urgentPriority(b) - urgentPriority(a));
    };
  }

  function orderForCard(card) {
    const orderNo = card.querySelector(".order-no")?.textContent?.trim();
    if (!orderNo || typeof orders === "undefined" || !Array.isArray(orders)) return null;
    return orders.find(order => String(order.orderNo || "").trim() === orderNo) || null;
  }

  function decorateOrderCards() {
    document.querySelectorAll(".order-card").forEach(card => {
      const order = orderForCard(card);
      if (!order) return;

      card.classList.toggle("urgent-order-card", !!order.urgent);
      const existing = card.querySelector("[data-urgent-order-badge]");

      if (!order.urgent) {
        existing?.remove();
        return;
      }

      if (existing) return;
      const chips = card.querySelector(".chips");
      if (!chips) return;

      const badge = document.createElement("span");
      badge.className = "urgent-order-badge";
      badge.dataset.urgentOrderBadge = "1";
      badge.textContent = "ACİL";
      chips.prepend(badge);
    });
  }

  function decorateAdminRows() {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    document.querySelectorAll("#allTable [data-all-detail]").forEach(button => {
      const order = orders.find(item => item.id === button.dataset.allDetail) || null;
      const row = button.closest("tr");
      const firstCell = row?.querySelector("td");
      if (!order || !row || !firstCell) return;

      row.classList.toggle("urgent-admin-row", !!order.urgent);
      const existing = firstCell.querySelector("[data-urgent-order-mini]");

      if (!order.urgent) {
        existing?.remove();
        return;
      }

      if (existing) return;
      const tag = document.createElement("span");
      tag.className = "urgent-order-mini";
      tag.dataset.urgentOrderMini = "1";
      tag.textContent = "ACİL";
      firstCell.appendChild(tag);
    });
  }

  if (typeof renderWork === "function") {
    const baseRenderWork = renderWork;
    renderWork = function (...args) {
      const result = baseRenderWork.apply(this, args);
      decorateOrderCards();
      return result;
    };
  }

  if (typeof renderAll === "function") {
    const baseRenderAll = renderAll;
    renderAll = function (...args) {
      const result = baseRenderAll.apply(this, args);
      decorateAdminRows();
      return result;
    };
  }

  if (typeof openDetail === "function") {
    const baseOpenDetail = openDetail;
    openDetail = function (id) {
      const result = baseOpenDetail(id);
      const order = typeof orders !== "undefined" && Array.isArray(orders)
        ? orders.find(item => item.id === id) || null
        : null;
      const grid = document.querySelector("#detailContent .detail-grid");

      if (order?.urgent && grid && !grid.querySelector("[data-detail-urgent]")) {
        const box = document.createElement("div");
        box.className = "detail-box urgent-detail-box";
        box.dataset.detailUrgent = "1";
        box.innerHTML = "<span>Öncelik</span><strong>ACİL</strong>";
        grid.prepend(box);
      }
      return result;
    };
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      decorateOrderCards();
      decorateAdminRows();
      return result;
    };
  }

  document.getElementById("newOrderBtn")?.addEventListener("click", () => {
    setTimeout(() => {
      ensureUrgentField();
      const checkbox = document.getElementById("orderUrgent");
      if (checkbox) checkbox.checked = false;
    }, 0);
  });

  // İlk veri isteği bu eklenti yüklenmeden tamamlandıysa urgent alanını garanti tazele.
  setTimeout(function ensureUrgentData() {
    if (typeof accessCode === "undefined" || !accessCode) return;
    if (typeof refreshing !== "undefined" && refreshing) {
      setTimeout(ensureUrgentData, 350);
      return;
    }
    if (typeof refreshData === "function") refreshData(true);
  }, 450);
})();
