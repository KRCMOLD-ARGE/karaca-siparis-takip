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
    return history.some(event => isAssignmentEvent(event) && eventTime(event) > returnedAt);
  }

  function ensureGuardDialog() {
    let dialog = document.getElementById("warehouseSecondOwnerGuardDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "warehouseSecondOwnerGuardDialog";
    dialog.className = "warehouse-guard-dialog";
    dialog.innerHTML = `
      <div class="warehouse-guard-card">
        <div class="warehouse-guard-icon">!</div>
        <h3>Önce Depo personelini atayın</h3>
        <p>Bu siparişi <b>Toplandı</b> yapmadan önce Onay Sonrası Depo kartından personeli seçin ve <b>Üzerime Al</b> butonuna basın.</p>
        <div class="warehouse-guard-actions"><button type="button" class="btn primary" data-second-owner-guard-close>Tamam</button></div>
      </div>
    `;

    dialog.querySelector("[data-second-owner-guard-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function showOwnerRequired() {
    const dialog = ensureGuardDialog();
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      alert("Önce Onay Sonrası Depo personelini seçin ve Üzerime Al butonuna basın.");
    }
  }

  function decorateSecondStageCompletion() {
    if (typeof role === "undefined" || role !== "warehouse") return;
    if (typeof whTab !== "undefined" && whTab !== "second") return;

    document.querySelectorAll("#workCards select[data-wh2]").forEach(select => {
      const order = orderById(select.dataset.wh2);
      if (!order) return;

      const ready = order.phase === "warehouse2" && order.warehouse2Status === "Toplandı";
      select.classList.toggle("warehouse-status-complete", ready);

      const card = select.closest(".order-card");
      if (!card) return;
      card.classList.toggle("warehouse-ready-to-send", ready);

      let row = card.querySelector(".warehouse-second-send-row");
      if (!ready) {
        row?.remove();
        return;
      }

      if (!row) {
        row = document.createElement("div");
        row.className = "warehouse-send-row warehouse-second-send-row";
        row.innerHTML = `
          <span class="warehouse-ready-text">Onay sonrası Depo işlemi tamamlandı. Sevkiyata göndermeye hazır.</span>
          <button type="button" class="btn small warehouse-send-btn" data-wh2-send="${order.id}">Sevkiyata Gönder</button>
        `;
        card.appendChild(row);
      }
    });
  }

  window.decorateSecondStageCompletion = decorateSecondStageCompletion;

  // Toplandı artık otomatik olarak Sevkiyata geçirmez. Önce gerçek ikinci Depo ataması gerekir.
  document.addEventListener("change", async event => {
    const select = event.target.closest?.("select[data-wh2]");
    if (!select || select.value !== "Toplandı") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const order = orderById(select.dataset.wh2);
    if (!order) return;

    if (!hasSecondStageAssignment(order)) {
      select.value = order.warehouse2Status || "Hazırlanıyor";
      showOwnerRequired();
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
      setTimeout(decorateSecondStageCompletion, 0);
    }
  }, true);

  // Sevkiyata geçiş yalnızca ayrı butonla yapılır.
  document.addEventListener("click", async event => {
    const button = event.target.closest?.("[data-wh2-send]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const order = orderById(button.dataset.wh2Send);
    if (!order || order.phase !== "warehouse2" || order.warehouse2Status !== "Toplandı") return;

    if (!hasSecondStageAssignment(order)) {
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

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      decorateSecondStageCompletion();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(decorateSecondStageCompletion, 0));
  document.querySelectorAll("[data-wh-tab]").forEach(tab =>
    tab.addEventListener("click", () => setTimeout(decorateSecondStageCompletion, 0))
  );

  setTimeout(decorateSecondStageCompletion, 0);
})();
