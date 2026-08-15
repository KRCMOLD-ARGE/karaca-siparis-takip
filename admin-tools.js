(() => {
  const dialog = document.createElement("dialog");
  dialog.id = "adminOrderDialog";
  dialog.innerHTML = `
    <form id="adminOrderToolForm">
      <div class="dialog-head">
        <div>
          <h2 id="adminOrderToolTitle">Siparişe Müdahale</h2>
          <p id="adminOrderToolSub">Admin gerekli durumlarda sipariş sorumlusunu değiştirebilir veya kaydı silebilir.</p>
        </div>
        <button type="button" class="icon-btn" data-admin-tool-close>×</button>
      </div>
      <div class="admin-order-tool-grid">
        <div class="admin-tool-box"><span>Sipariş</span><strong id="adminToolOrderNo">-</strong></div>
        <div class="admin-tool-box"><span>Müşteri</span><strong id="adminToolCustomer">-</strong></div>
        <div class="admin-tool-box"><span>Bölüm / Durum</span><strong id="adminToolPhase">-</strong></div>
        <div class="admin-tool-box"><span>Mevcut Depo Sorumlusu</span><strong id="adminToolCurrentWarehouse">-</strong></div>
      </div>
      <div id="adminToolError" class="admin-tool-error hidden"></div>
      <section class="admin-tool-section">
        <h3>Depo sorumlusunu değiştir</h3>
        <p>Aktif Depo personellerinden birini seçin. Değişiklik sipariş geçmişine Admin işlemi olarak eklenir.</p>
        <select id="adminToolWarehouseOwner"></select>
        <div class="admin-tool-section-actions">
          <button class="btn primary" type="submit" id="adminToolSaveOwner">Sorumluyu Güncelle</button>
        </div>
      </section>
      <section class="admin-tool-section admin-danger-zone">
        <h3>Siparişi sil</h3>
        <p>Bu işlem siparişi ve normal işlem geçmişini sistemden kaldırır. Admin silme kaydı ayrı denetim kaydında tutulur.</p>
        <div class="admin-tool-section-actions">
          <button class="btn danger" type="button" id="adminToolDelete">Siparişi Sil</button>
        </div>
      </section>
    </form>
  `;
  document.body.appendChild(dialog);

  const form = document.getElementById("adminOrderToolForm");
  const ownerSelect = document.getElementById("adminToolWarehouseOwner");
  const deleteBtn = document.getElementById("adminToolDelete");
  const saveBtn = document.getElementById("adminToolSaveOwner");
  const errorBox = document.getElementById("adminToolError");
  let currentOrderId = "";

  function currentAdminSession() {
    return window.__karacaAdminSession || null;
  }

  function setError(message = "") {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.toggle("hidden", !message);
  }

  function orderById(id) {
    return Array.isArray(orders) ? orders.find(o => o.id === id) || null : null;
  }

  function warehouseStaffOptions(order) {
    const people = typeof activeStaffFor === "function" ? activeStaffFor("warehouse") : [];
    const currentId = order?.warehouseOwnerId || "";
    return `<option value="" ${!currentId ? "selected" : ""}>Atamayı kaldır</option>` +
      people.map(person => `<option value="${person.id}" ${person.id === currentId ? "selected" : ""}>${esc(person.name)}</option>`).join("");
  }

  function phaseLabel(order) {
    const dep = typeof currentDepartment === "function" ? currentDepartment(order) : order?.phase || "-";
    const status = typeof currentStatus === "function" ? currentStatus(order) : "-";
    return `${dep} · ${status}`;
  }

  function openTool(orderId) {
    if (typeof role === "undefined" || role !== "admin") return;
    if (!currentAdminSession()) {
      if (typeof toast === "function") toast("Admin oturumu doğrulanmalı. Admin bölümüne yeniden giriş yapın.");
      return;
    }

    const order = orderById(orderId);
    if (!order) {
      if (typeof toast === "function") toast("Sipariş bulunamadı");
      return;
    }

    currentOrderId = order.id;
    setError("");
    document.getElementById("adminOrderToolTitle").textContent = `Siparişe Müdahale · ${order.orderNo}`;
    document.getElementById("adminToolOrderNo").textContent = order.orderNo || "-";
    document.getElementById("adminToolCustomer").textContent = order.customer || "-";
    document.getElementById("adminToolPhase").textContent = phaseLabel(order);
    document.getElementById("adminToolCurrentWarehouse").textContent = typeof personName === "function"
      ? personName(order.warehouseOwnerId, order.warehouseOwner || "Atanmadı")
      : (order.warehouseOwner || "Atanmadı");
    ownerSelect.innerHTML = warehouseStaffOptions(order);
    dialog.showModal();
  }

  async function adminRpc(name, payload) {
    const session = currentAdminSession();
    if (!session) throw new Error("Admin oturumu bulunamadı. Admin bölümüne yeniden giriş yapın.");
    return rpc(name, {
      p_passcode: accessCode,
      p_username: session.username,
      p_password: session.password,
      ...payload
    });
  }

  function decorateAdminRows() {
    if (typeof role === "undefined" || role !== "admin") return;
    const table = document.getElementById("allTable");
    if (!table) return;

    table.querySelectorAll("tr").forEach(row => {
      const detailBtn = row.querySelector("[data-all-detail]");
      if (!detailBtn || row.querySelector("[data-admin-intervene]")) return;

      const cell = detailBtn.closest("td");
      if (!cell) return;

      let wrap = cell.querySelector(".admin-order-actions");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "admin-order-actions";
        cell.innerHTML = "";
        wrap.appendChild(detailBtn);
        cell.appendChild(wrap);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn small admin-intervene-btn";
      button.dataset.adminIntervene = detailBtn.dataset.allDetail;
      button.textContent = "Müdahale";
      wrap.appendChild(button);
    });
  }

  document.addEventListener("click", event => {
    const intervene = event.target.closest?.("[data-admin-intervene]");
    if (intervene) {
      openTool(intervene.dataset.adminIntervene);
      return;
    }
    if (event.target.closest?.("[data-admin-tool-close]")) dialog.close();
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentOrderId) return;
    setError("");
    saveBtn.disabled = true;
    saveBtn.textContent = "Güncelleniyor...";
    try {
      await adminRpc("app_admin_reassign_warehouse", {
        p_order_id: currentOrderId,
        p_staff_id: ownerSelect.value || null
      });
      dialog.close();
      await refreshData(true);
      if (typeof toast === "function") toast(ownerSelect.value ? "Depo sorumlusu Admin tarafından güncellendi" : "Depo sorumlusu ataması kaldırıldı");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Depo sorumlusu güncellenemedi.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Sorumluyu Güncelle";
    }
  });

  deleteBtn?.addEventListener("click", async () => {
    const order = orderById(currentOrderId);
    if (!order) return;

    const ok = confirm(`${order.orderNo} numaralı sipariş kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`);
    if (!ok) return;

    setError("");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Siliniyor...";
    try {
      await adminRpc("app_admin_delete_order", { p_order_id: currentOrderId });
      dialog.close();
      currentOrderId = "";
      await refreshData(true);
      if (typeof toast === "function") toast("Sipariş Admin tarafından silindi");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Sipariş silinemedi.");
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Siparişi Sil";
    }
  });

  if (typeof renderAll === "function") {
    const baseRenderAll = renderAll;
    renderAll = function (...args) {
      const result = baseRenderAll.apply(this, args);
      decorateAdminRows();
      return result;
    };
  }

  document.getElementById("allNav")?.addEventListener("click", () => setTimeout(decorateAdminRows, 0));
  setTimeout(decorateAdminRows, 0);
})();
