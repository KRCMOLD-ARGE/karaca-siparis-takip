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
  }

  window.groupWarehouseOrders = groupWarehouseOrders;

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      groupWarehouseOrders();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(groupWarehouseOrders, 0));
  document.querySelectorAll("[data-wh-tab]").forEach(tab =>
    tab.addEventListener("click", () => setTimeout(groupWarehouseOrders, 0))
  );
})();
