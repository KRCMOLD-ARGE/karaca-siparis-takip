(() => {
  // İlk Depo akışında "Toplandı" ile "Tamamlandı" aynı sonuca yakın iki ayrı adım
  // oluşturuyordu. Kartta artık yalnızca Tamamlandı kullanılıyor.
  if (typeof mapOrder === "function") {
    const baseMapOrder = mapOrder;
    mapOrder = function (raw) {
      const mapped = baseMapOrder(raw);
      // Eski kayıtlarda Toplandı varsa kartta tekrar göstermeyip Toplanıyor olarak ele al.
      if (mapped?.phase === "warehouse1" && mapped?.warehouse1Status === "Toplandı") {
        mapped.warehouse1Status = "Toplanıyor";
      }
      return mapped;
    };
  }

  if (typeof warehouse1Options === "function") {
    const baseWarehouse1Options = warehouse1Options;
    warehouse1Options = function (order) {
      return baseWarehouse1Options(order).filter(status => status !== "Toplandı");
    };
  }

  function hasWarehouseOwner(order) {
    return !!String(order?.warehouseOwnerId || order?.warehouseOwner || "").trim();
  }

  function orderById(id) {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return null;
    return orders.find(order => String(order.id) === String(id)) || null;
  }

  function eventTime(event) {
    const value = new Date(event?.at || 0).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function isAssignmentEvent(event) {
    const text = String(event?.text || "");
    return /Depo sorumlusu:|siparişi üzerine aldı/i.test(text);
  }

  function isReturnToWarehouseEvent(event) {
    const text = String(event?.text || "");
    return /tekrar Depo|Depo'ya gönderildi: Hazırlanıyor|Depoya gönderildi: Hazırlanıyor/i.test(text);
  }

  function isWarehouse2New(order) {
    if (order?.phase !== "warehouse2") return false;
    if ((order?.warehouse2Status || "Hazırlanıyor") !== "Hazırlanıyor") return false;

    const history = Array.isArray(order?.history) ? order.history : [];
    const returnEvent = history.find(isReturnToWarehouseEvent);

    // Eski kayıtlar için güvenli geri dönüş: sorumlu yoksa yeni kabul et.
    if (!returnEvent) return !hasWarehouseOwner(order);

    const returnedAt = eventTime(returnEvent);
    const assignedAfterReturn = history.some(event =>
      isAssignmentEvent(event) && eventTime(event) > returnedAt
    );

    return !assignedAfterReturn;
  }

  window.isWarehouseOrderNew = function isWarehouseOrderNew(order, tab) {
    if (!order) return false;

    const targetTab = tab || (order.phase === "warehouse2" ? "second" : "first");
    if (targetTab === "second") return isWarehouse2New(order);

    return order.phase === "warehouse1" &&
      !hasWarehouseOwner(order) &&
      (order.warehouse1Status || "Bekleniyor") === "Bekleniyor";
  };

  function ensureCompletionStyles() {
    if (document.getElementById("warehouseCompletionStyles")) return;
    const style = document.createElement("style");
    style.id = "warehouseCompletionStyles";
    style.textContent = `
      #workCards .order-card.warehouse-ready-to-send{
        border-color:#86efac!important;
        background:linear-gradient(180deg,#f7fff9 0%,#ffffff 46%);
        box-shadow:0 0 0 1px rgba(22,163,74,.08),0 8px 20px rgba(22,163,74,.08);
      }
      #workCards select.warehouse-status-complete{
        border-color:#16a34a!important;
        background:#f0fdf4!important;
        color:#166534!important;
        font-weight:800;
      }
      .warehouse-send-row{
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:10px;
        padding-top:10px;
        border-top:1px solid #dcfce7;
      }
      .warehouse-ready-text{
        flex:1;
        min-width:0;
        color:#166534;
        font-size:11px;
        font-weight:800;
        line-height:1.3;
      }
      .btn.warehouse-send-btn{
        background:#15803d;
        border-color:#15803d;
        color:#fff;
        font-weight:850;
        white-space:nowrap;
      }
      .btn.warehouse-send-btn:hover{background:#166534;border-color:#166534}
      .warehouse-guard-dialog{
        width:min(430px,calc(100vw - 32px));
        border:0;
        border-radius:18px;
        padding:0;
        box-shadow:0 24px 70px rgba(16,24,40,.24);
      }
      .warehouse-guard-dialog::backdrop{background:rgba(16,24,40,.45)}
      .warehouse-guard-card{padding:22px}
      .warehouse-guard-icon{
        width:42px;height:42px;border-radius:12px;
        display:flex;align-items:center;justify-content:center;
        background:#fff4e5;color:#b54708;font-size:22px;margin-bottom:12px;
      }
      .warehouse-guard-card h3{margin:0 0 7px;font-size:17px;color:#101828}
      .warehouse-guard-card p{margin:0;color:#667085;font-size:13px;line-height:1.55}
      .warehouse-guard-actions{display:flex;justify-content:flex-end;margin-top:18px}
    `;
    document.head.appendChild(style);
  }

  function ensureOwnerGuardDialog() {
    ensureCompletionStyles();
    let dialog = document.getElementById("warehouseOwnerGuardDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "warehouseOwnerGuardDialog";
    dialog.className = "warehouse-guard-dialog";
    dialog.innerHTML = `
      <div class="warehouse-guard-card">
        <div class="warehouse-guard-icon">!</div>
        <h3>Önce Depo personelini atayın</h3>
        <p>Bu siparişi <b>Tamamlandı</b> yapmadan önce karttan Depo personelini seçin ve <b>Üzerime Al</b> butonuna basın.</p>
        <div class="warehouse-guard-actions"><button type="button" class="btn primary" data-owner-guard-close>Tamam</button></div>
      </div>
    `;
    dialog.querySelector("[data-owner-guard-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function showOwnerRequired() {
    const dialog = ensureOwnerGuardDialog();
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      alert("Önce Depo personelini seçin ve Üzerime Al butonuna basın.");
    }
  }

  function decorateWarehouseCompletion() {
    ensureCompletionStyles();
    if (typeof role === "undefined" || role !== "warehouse") return;
    if (typeof whTab !== "undefined" && whTab !== "first") return;

    document.querySelectorAll("#workCards select[data-wh1]").forEach(select => {
      const order = orderById(select.dataset.wh1);
      if (!order) return;

      const ready = order.phase === "warehouse1" && order.warehouse1Status === "Tamamlandı";
      select.classList.toggle("warehouse-status-complete", ready);

      const card = select.closest(".order-card");
      if (!card) return;
      card.classList.toggle("warehouse-ready-to-send", ready);

      let row = card.querySelector(".warehouse-send-row");
      if (!ready) {
        row?.remove();
        return;
      }

      if (!row) {
        row = document.createElement("div");
        row.className = "warehouse-send-row";
        row.innerHTML = `
          <span class="warehouse-ready-text">Depo işlemi tamamlandı. Operasyona göndermeye hazır.</span>
          <button type="button" class="btn small warehouse-send-btn" data-wh1-send="${order.id}">Operasyona Gönder</button>
        `;
        card.appendChild(row);
      }
    });
  }

  function orderForCard(card) {
    const orderNo = card.querySelector(".order-no")?.textContent?.trim();
    if (!orderNo || !Array.isArray(window.orders || (typeof orders !== "undefined" ? orders : null))) return null;
    const list = typeof orders !== "undefined" ? orders : window.orders;
    return list.find(order => String(order.orderNo || "").trim() === orderNo) || null;
  }

  function makeSection(title, count, cards, type) {
    const section = document.createElement("section");
    section.className = `warehouse-order-section warehouse-order-section-${type}`;

    const header = document.createElement("div");
    header.className = "warehouse-order-section-head";
    header.innerHTML = `
      <div class="warehouse-order-section-title">
        <span>${title}</span>
        <b class="warehouse-order-count warehouse-order-count-${type}">${count}</b>
      </div>
      <small>${type === "new" ? "Henüz işleme alınmamış siparişler" : "Sorumlusu atanmış veya işlem başlamış siparişler"}</small>
    `;

    const grid = document.createElement("div");
    grid.className = "warehouse-order-grid";

    if (cards.length) {
      cards.forEach(card => grid.appendChild(card));
    } else {
      const empty = document.createElement("div");
      empty.className = "warehouse-order-empty";
      empty.textContent = type === "new" ? "Yeni sipariş yok." : "Yürüyen sipariş yok.";
      grid.appendChild(empty);
    }

    section.append(header, grid);
    return section;
  }

  function groupWarehouseOrders() {
    const container = document.getElementById("workCards");
    if (!container) return;

    // Depo dışına çıkıldığında Depo'ya özel display:block sınıfını mutlaka temizle.
    // Aksi halde Operasyon/Pazarlama/Sevkiyat kartları grid yerine alt alta kalıyordu.
    if (typeof role === "undefined" || role !== "warehouse") {
      container.classList.remove("warehouse-grouped");
      return;
    }
    if (typeof view !== "undefined" && view !== "work") {
      container.classList.remove("warehouse-grouped");
      return;
    }

    const cards = [...container.children].filter(node => node.classList?.contains("order-card"));
    if (!cards.length) {
      container.classList.remove("warehouse-grouped");
      return;
    }

    const tab = typeof whTab !== "undefined" ? whTab : "first";
    const newCards = [];
    const activeCards = [];

    cards.forEach(card => {
      const order = orderForCard(card);
      if (order && window.isWarehouseOrderNew(order, tab)) newCards.push(card);
      else activeCards.push(card);
    });

    container.classList.add("warehouse-grouped");
    container.innerHTML = "";

    const newTitle = tab === "second" ? "Yeni Onaylı Siparişler" : "Yeni Gelen Siparişler";
    container.append(
      makeSection(newTitle, newCards.length, newCards, "new"),
      makeSection("Yürüyen Siparişler", activeCards.length, activeCards, "active")
    );

    decorateWarehouseCompletion();
  }

  window.groupWarehouseOrders = groupWarehouseOrders;
  window.decorateWarehouseCompletion = decorateWarehouseCompletion;

  // Tamamlandı seçimi önce gerçek bir Depo ataması ister ve siparişi burada tutar.
  document.addEventListener("change", async event => {
    const select = event.target.closest?.("select[data-wh1]");
    if (!select || select.value !== "Tamamlandı") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const order = orderById(select.dataset.wh1);
    if (!order) return;

    if (!hasWarehouseOwner(order)) {
      select.value = order.warehouse1Status || "Bekleniyor";
      showOwnerRequired();
      return;
    }

    select.disabled = true;
    try {
      if (typeof updateOrder === "function") {
        await updateOrder(
          order.id,
          { warehouse1_status: "Tamamlandı" },
          "Depo ilk aşaması tamamlandı. Operasyona gönderilmeye hazır."
        );
      }
    } finally {
      if (select.isConnected) select.disabled = false;
      setTimeout(decorateWarehouseCompletion, 0);
    }
  }, true);

  // Bölüm değişikliği yalnızca ayrı "Operasyona Gönder" butonuna basıldığında yapılır.
  document.addEventListener("click", async event => {
    const button = event.target.closest?.("[data-wh1-send]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const order = orderById(button.dataset.wh1Send);
    if (!order || order.phase !== "warehouse1" || order.warehouse1Status !== "Tamamlandı") return;

    if (!hasWarehouseOwner(order)) {
      showOwnerRequired();
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Gönderiliyor...";
    try {
      if (typeof updateOrder === "function") {
        await updateOrder(
          order.id,
          { warehouse1_status: "Tamamlandı", phase: "operations", operation_status: "Onay Bekliyor" },
          "Depo ilk aşaması tamamlandı. Sipariş Operasyona gönderildi: Onay Bekliyor"
        );
      }
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }, true);

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      groupWarehouseOrders();
      decorateWarehouseCompletion();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(() => {
    groupWarehouseOrders();
    decorateWarehouseCompletion();
  }, 0));
  document.querySelectorAll("[data-wh-tab]").forEach(tab =>
    tab.addEventListener("click", () => setTimeout(() => {
      groupWarehouseOrders();
      decorateWarehouseCompletion();
    }, 0))
  );

  ensureCompletionStyles();
})();
