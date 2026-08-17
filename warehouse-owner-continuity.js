(() => {
  function ordersList() {
    return typeof orders !== "undefined" && Array.isArray(orders) ? orders : [];
  }

  function orderById(id) {
    return ordersList().find(order => String(order.id) === String(id)) || null;
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

  function hasSecondStageAssignment(order) {
    if (!order) return false;

    const history = Array.isArray(order.history) ? order.history : [];
    const returnEvents = history.filter(isReturnToWarehouseEvent);

    if (!returnEvents.length) {
      return !!String(order.warehouseOwnerId || order.warehouseOwner || "").trim();
    }

    const returnedAt = Math.max(...returnEvents.map(eventTime));
    return history.some(event =>
      isAssignmentEvent(event) && eventTime(event) >= returnedAt
    );
  }

  // Onay Sonrası Depo grubunda, Operasyondan dönüş sırasında otomatik devam eden
  // İlk Depo sorumlusunu gerçek ikinci aşama ataması olarak kabul et.
  if (typeof window.isWarehouseOrderNew === "function") {
    const baseIsWarehouseOrderNew = window.isWarehouseOrderNew;
    window.isWarehouseOrderNew = function (order, tab) {
      const targetTab = tab || (order?.phase === "warehouse2" ? "second" : "first");
      if (targetTab !== "second") return baseIsWarehouseOrderNew(order, tab);
      if (!order || order.phase !== "warehouse2") return false;
      if ((order.warehouse2Status || "Hazırlanıyor") !== "Hazırlanıyor") return false;
      return !hasSecondStageAssignment(order);
    };
  }

  function ensureSecondStageGuardDialog() {
    let dialog = document.getElementById("warehouseContinuityGuardDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "warehouseContinuityGuardDialog";
    dialog.className = "warehouse-guard-dialog";
    dialog.innerHTML = `
      <div class="warehouse-guard-card">
        <div class="warehouse-guard-icon">!</div>
        <h3>Önce Depo personelini atayın</h3>
        <p>Bu siparişi <b>Toplandı</b> yapmadan önce bir Depo sorumlusu atanmış olmalı.</p>
        <div class="warehouse-guard-actions"><button type="button" class="btn primary" data-continuity-guard-close>Tamam</button></div>
      </div>
    `;
    dialog.querySelector("[data-continuity-guard-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function showSecondStageOwnerRequired() {
    const dialog = ensureSecondStageGuardDialog();
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else if (typeof toast === "function") {
      toast("Önce Depo personelini atayın");
    }
  }

  // Operasyon onay verdiğinde İlk Depo sorumlusu warehouse_owner_id alanında zaten
  // korunur. Bu işlem geçmişine de otomatik devam bilgisini yazar; böylece ikinci
  // Depo aşaması doğrudan aynı personele atanmış kabul edilir.
  document.addEventListener("click", async event => {
    const button = event.target.closest?.("[data-approve]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const actor = typeof currentPerson === "function" ? currentPerson() : null;
    if (!actor) {
      if (typeof toast === "function") toast("Önce Operasyon personeli seçin");
      return;
    }

    const order = orderById(button.dataset.approve);
    if (!order) return;

    const ownerId = String(order.warehouseOwnerId || "").trim();
    const ownerName = ownerId && typeof personName === "function"
      ? personName(ownerId, order.warehouseOwner || "Depo personeli")
      : String(order.warehouseOwner || "").trim();

    let historyText = `${actor.name} siparişi onayladı. Sipariş tekrar Depo'ya gönderildi: Hazırlanıyor`;
    if (ownerId || ownerName) {
      historyText += `. Depo sorumlusu: ${ownerName || "Atanmış personel"} (Onay Sonrası Depo otomatik devam)`;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Gönderiliyor...";
    try {
      if (typeof updateOrder === "function") {
        await updateOrder(
          order.id,
          {
            operations_owner_id: actor.id,
            operation_status: "Onaylandı",
            phase: "warehouse2",
            warehouse2_status: "Hazırlanıyor"
          },
          historyText
        );
      }
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }, true);

  // Bu dinleyiciler warehouse-second-stage.js'ten önce yüklenir. Böylece otomatik
  // atanmış sorumlu, Toplandı ve Sevkiyata Gönder kontrollerinde de geçerli olur.
  document.addEventListener("change", async event => {
    const select = event.target.closest?.("select[data-wh2]");
    if (!select || select.value !== "Toplandı") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const order = orderById(select.dataset.wh2);
    if (!order) return;

    if (!hasSecondStageAssignment(order)) {
      select.value = order.warehouse2Status || "Hazırlanıyor";
      showSecondStageOwnerRequired();
      return;
    }

    select.disabled = true;
    try {
      if (typeof updateOrder === "function") {
        await updateOrder(
          order.id,
          { warehouse2_status: "Toplandı" },
          "Onay sonrası Depo işlemi tamamlandı. Sevkiyata gönderilmeye hazır."
        );
      }
    } finally {
      if (select.isConnected) select.disabled = false;
      if (typeof window.decorateSecondStageCompletion === "function") {
        setTimeout(window.decorateSecondStageCompletion, 0);
      }
    }
  }, true);

  document.addEventListener("click", async event => {
    const button = event.target.closest?.("[data-wh2-send]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const order = orderById(button.dataset.wh2Send);
    if (!order || order.phase !== "warehouse2" || order.warehouse2Status !== "Toplandı") return;

    if (!hasSecondStageAssignment(order)) {
      showSecondStageOwnerRequired();
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Gönderiliyor...";
    try {
      if (typeof updateOrder === "function") {
        await updateOrder(
          order.id,
          { warehouse2_status: "Toplandı", phase: "shipping", shipping_status: "Hazır" },
          "Depo ikinci aşaması tamamlandı. Sipariş Sevkiyat'a gönderildi: Hazır"
        );
      }
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }, true);
})();
