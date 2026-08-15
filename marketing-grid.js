(() => {
  const style = document.createElement("style");
  style.textContent = `
    .market-scope-chip{
      display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;
      font-size:10px;font-weight:850;white-space:nowrap;border:1px solid transparent;
    }
    .market-scope-domestic{background:#eef4ff;color:#3538cd;border-color:#dbe3ff}
    .market-scope-international{background:#f1edff;color:#6941c6;border-color:#e4dcff}
    .market-scope-legacy{background:#f2f4f7;color:#667085;border-color:#e4e7ec}
    .market-scope-note{display:block;margin-top:5px;color:#667085;font-size:10px;line-height:1.4}
    .marketing-scope-admin-wrap{border:1px solid #dbe3ff;background:#f8faff;border-radius:12px;padding:12px}
    .marketing-scope-admin-wrap>span{display:block;font-size:11px;font-weight:800;margin-bottom:7px}
    .marketing-scope-admin-wrap select{width:100%;border:1px solid #d0d5dd;border-radius:9px;padding:10px 11px;background:#fff}
    .marketing-scope-tag{display:inline-flex;align-items:center;margin-left:6px;padding:3px 7px;border-radius:999px;background:#eef4ff;color:#3538cd;font-size:9px;font-weight:850}
    .market-order-error{margin:0 21px 14px;padding:10px 12px;border:1px solid #f3b7b2;border-radius:10px;background:#fff1f0;color:#b42318;font-size:12px;font-weight:750;line-height:1.45}
    .market-order-error.hidden{display:none!important}
    .market-order-scope-field select:disabled{opacity:1;background:#fff}
    .market-scope-mini{display:block;margin-top:4px;font-size:9px;font-weight:800;color:#667085}
  `;
  document.head.appendChild(style);

  const SCOPE_LABEL = {
    domestic: "Yurt İçi",
    international: "Yurt Dışı",
    both: "Her İkisi"
  };

  function scopeLabel(scope, legacy = "Belirtilmemiş") {
    return SCOPE_LABEL[scope] || legacy;
  }

  function scopeClass(scope) {
    return scope === "domestic"
      ? "market-scope-domestic"
      : scope === "international"
        ? "market-scope-international"
        : "market-scope-legacy";
  }

  if (typeof mapOrder === "function") {
    const baseMapOrder = mapOrder;
    mapOrder = function (raw) {
      const mapped = baseMapOrder(raw);
      mapped.marketScope = raw.market_scope || "";
      return mapped;
    };
  }

  if (typeof mapStaff === "function") {
    const baseMapStaff = mapStaff;
    mapStaff = function (raw) {
      const mapped = baseMapStaff(raw);
      mapped.marketingScope = raw.marketing_scope || "";
      return mapped;
    };
  }

  const orderForm = document.getElementById("orderForm");
  const orderNoInput = document.getElementById("orderNo");
  const customerInput = document.getElementById("customer");
  const staffForm = document.getElementById("staffForm");
  const staffActive = document.getElementById("staffActive");

  let orderScopeSelect = document.getElementById("orderMarketScope");
  if (!orderScopeSelect && orderForm && customerInput) {
    const field = document.createElement("label");
    field.className = "span2 market-order-scope-field";
    field.innerHTML = `
      <span>Sipariş Bölgesi *</span>
      <select id="orderMarketScope" required>
        <option value="">Yurt İçi / Yurt Dışı seçin</option>
        <option value="domestic">Yurt İçi</option>
        <option value="international">Yurt Dışı</option>
      </select>
      <small id="orderMarketScopeNote" class="market-scope-note"></small>
    `;
    customerInput.closest("label")?.insertAdjacentElement("afterend", field);
    orderScopeSelect = document.getElementById("orderMarketScope");
  }

  let staffScopeWrap = document.getElementById("staffMarketingScopeWrap");
  if (!staffScopeWrap && staffForm && staffActive) {
    staffScopeWrap = document.createElement("div");
    staffScopeWrap.id = "staffMarketingScopeWrap";
    staffScopeWrap.className = "span2 marketing-scope-admin-wrap hidden";
    staffScopeWrap.innerHTML = `
      <span>Pazarlama Sorumluluk Alanı</span>
      <select id="staffMarketingScope">
        <option value="domestic">Yurt İçi</option>
        <option value="international">Yurt Dışı</option>
        <option value="both">Her İkisi</option>
      </select>
      <small class="market-scope-note">Bu ayar yalnızca Pazarlama rolündeki personelin göreceği siparişleri belirler.</small>
    `;
    staffActive.closest("label")?.insertAdjacentElement("beforebegin", staffScopeWrap);
  }

  const staffScopeSelect = document.getElementById("staffMarketingScope");

  function currentMarketingScope() {
    if (typeof currentPerson !== "function") return "";
    const person = currentPerson();
    return person?.marketingScope || "both";
  }

  function syncOrderScopeField() {
    if (!orderScopeSelect || typeof role === "undefined" || role !== "marketing") return;
    const scope = currentMarketingScope();
    const note = document.getElementById("orderMarketScopeNote");
    const domestic = orderScopeSelect.querySelector('option[value="domestic"]');
    const international = orderScopeSelect.querySelector('option[value="international"]');

    if (scope === "domestic" || scope === "international") {
      orderScopeSelect.value = scope;
      if (domestic) domestic.disabled = scope !== "domestic";
      if (international) international.disabled = scope !== "international";
      if (note) note.textContent = `Seçili personelin alanı: ${scopeLabel(scope)}.`;
    } else {
      if (domestic) domestic.disabled = false;
      if (international) international.disabled = false;
      if (!["domestic", "international"].includes(orderScopeSelect.value)) orderScopeSelect.value = "";
      if (note) note.textContent = "Bu personel Yurt İçi ve Yurt Dışı sipariş açabilir.";
    }
  }

  function syncStaffScopeVisibility() {
    if (!staffScopeWrap) return;
    const marketingChecked = !!document.querySelector('[data-staff-role][value="marketing"]')?.checked;
    staffScopeWrap.classList.toggle("hidden", !marketingChecked);
  }

  function marketOrderErrorBox() {
    if (!orderForm) return null;
    let box = orderForm.querySelector("[data-market-order-error]");
    if (!box) {
      box = document.createElement("div");
      box.className = "market-order-error hidden";
      box.dataset.marketOrderError = "1";
      const actions = orderForm.querySelector(".dialog-actions");
      if (actions) orderForm.insertBefore(box, actions);
      else orderForm.appendChild(box);
    }
    return box;
  }

  function setOrderError(message = "") {
    const box = marketOrderErrorBox();
    if (!box) return;
    box.textContent = message;
    box.classList.toggle("hidden", !message);
  }

  if (typeof roleOrders === "function") {
    const baseRoleOrders = roleOrders;
    roleOrders = function () {
      const list = baseRoleOrders();
      if (typeof role === "undefined" || role !== "marketing") return list;
      const scope = currentMarketingScope();
      if (!scope || scope === "both") return list;
      return list.filter(order => order.marketScope === scope);
    };
  }

  if (typeof renderStats === "function") {
    const baseRenderStats = renderStats;
    renderStats = function () {
      if (typeof role === "undefined" || role !== "marketing") return baseRenderStats();
      const mine = typeof roleOrders === "function" ? roleOrders() : [];
      const data = [
        ["Toplam Girdi", mine.length, `${scopeLabel(currentMarketingScope(), "Pazarlama")} kayıtları`],
        ["Depoda", mine.filter(o => ["warehouse1", "warehouse2"].includes(o.phase)).length, "Aktif"],
        ["Operasyonda", mine.filter(o => o.phase === "operations").length, "Onayda"],
        ["Sevkiyatta", mine.filter(o => o.phase === "shipping").length, "Hazır"],
        ["Sevk Edildi", mine.filter(o => o.phase === "done").length, "Tamamlanan"]
      ];
      el("stats").innerHTML = data.map(x => `<div class="stat"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
    };
  }

  if (typeof renderPersonSelect === "function") {
    const baseRenderPersonSelect = renderPersonSelect;
    renderPersonSelect = function () {
      const result = baseRenderPersonSelect();
      if (typeof role === "undefined" || role !== "marketing") return result;
      const select = document.getElementById("personSelect");
      select?.querySelectorAll("option[value]").forEach(option => {
        if (!option.value || typeof personById !== "function") return;
        const person = personById(option.value);
        if (person) option.textContent = `${person.name} · ${scopeLabel(person.marketingScope || "both")}`;
      });
      const person = typeof currentPerson === "function" ? currentPerson() : null;
      if (person) {
        const actor = document.getElementById("actorPill");
        if (actor) actor.textContent = `${person.name} · ${scopeLabel(person.marketingScope || "both")}`;
      }
      syncOrderScopeField();
      return result;
    };
  }

  function orderForCard(card) {
    const orderNo = card.querySelector(".order-no")?.textContent?.trim();
    return Array.isArray(orders) ? orders.find(o => String(o.orderNo || "").trim() === orderNo) || null : null;
  }

  function decorateOrderCards() {
    document.querySelectorAll(".order-card").forEach(card => {
      const order = orderForCard(card);
      if (!order) return;
      const chips = card.querySelector(".chips");
      if (!chips || chips.querySelector("[data-market-scope-chip]")) return;
      const chip = document.createElement("span");
      chip.dataset.marketScopeChip = "1";
      chip.className = `market-scope-chip ${scopeClass(order.marketScope)}`;
      chip.textContent = scopeLabel(order.marketScope);
      chips.prepend(chip);
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

  function decorateAdminRows() {
    document.querySelectorAll("#allTable [data-all-detail]").forEach(button => {
      const order = Array.isArray(orders) ? orders.find(o => o.id === button.dataset.allDetail) : null;
      const row = button.closest("tr");
      const firstCell = row?.querySelector("td");
      if (!order || !firstCell || firstCell.querySelector("[data-market-scope-mini]")) return;
      const tag = document.createElement("span");
      tag.dataset.marketScopeMini = "1";
      tag.className = "market-scope-mini";
      tag.textContent = scopeLabel(order.marketScope);
      firstCell.appendChild(tag);
    });
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
      const order = Array.isArray(orders) ? orders.find(o => o.id === id) : null;
      const grid = document.querySelector("#detailContent .detail-grid");
      if (order && grid && !grid.querySelector("[data-detail-market-scope]")) {
        const box = document.createElement("div");
        box.className = "detail-box";
        box.dataset.detailMarketScope = "1";
        box.innerHTML = `<span>Sipariş Bölgesi</span><strong>${scopeLabel(order.marketScope)}</strong>`;
        grid.prepend(box);
      }
      return result;
    };
  }

  function decorateStaffTable() {
    document.querySelectorAll("[data-edit-staff]").forEach(button => {
      const person = typeof personById === "function" ? personById(button.dataset.editStaff) : null;
      if (!person?.roles?.includes("marketing")) return;
      const list = button.closest("tr")?.querySelector(".staff-role-list");
      if (!list || list.querySelector("[data-marketing-scope-tag]")) return;
      const tag = document.createElement("span");
      tag.dataset.marketingScopeTag = "1";
      tag.className = "marketing-scope-tag";
      tag.textContent = scopeLabel(person.marketingScope || "both");
      list.appendChild(tag);
    });
  }

  if (typeof renderStaffTable === "function") {
    const baseRenderStaffTable = renderStaffTable;
    renderStaffTable = function (...args) {
      const result = baseRenderStaffTable.apply(this, args);
      decorateStaffTable();
      return result;
    };
  }

  if (typeof openStaffDialog === "function") {
    const baseOpenStaffDialog = openStaffDialog;
    openStaffDialog = function (id = "") {
      const result = baseOpenStaffDialog(id);
      const person = id && typeof personById === "function" ? personById(id) : null;
      if (staffScopeSelect) staffScopeSelect.value = person?.marketingScope || "both";
      syncStaffScopeVisibility();
      return result;
    };
  }

  document.querySelectorAll("[data-staff-role]").forEach(input => {
    input.addEventListener("change", syncStaffScopeVisibility);
  });

  if (staffForm) {
    staffForm.onsubmit = async event => {
      event.preventDefault();
      if (typeof role === "undefined" || role !== "admin") {
        toast("Bu ekran yalnızca Admin içindir");
        return;
      }

      const session = window.__karacaAdminSession;
      if (!session) {
        toast("Admin oturumu doğrulanmalı. Admin bölümüne yeniden giriş yapın.");
        return;
      }

      const roles = [...document.querySelectorAll("[data-staff-role]:checked")].map(x => x.value);
      if (!roles.length) {
        toast("En az bir rol seçin");
        return;
      }

      const id = document.getElementById("staffId")?.value || "";
      const name = document.getElementById("staffName")?.value.trim() || "";
      const active = document.getElementById("staffActive")?.value === "true";
      const marketingScope = roles.includes("marketing") ? (staffScopeSelect?.value || "both") : null;
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;

      try {
        const staffId = id
          ? (await rpc("app_update_staff", { p_passcode: accessCode, p_id: id, p_name: name, p_roles: roles, p_active: active }), id)
          : await rpc("app_create_staff", { p_passcode: accessCode, p_name: name, p_roles: roles, p_active: active });

        await rpc("app_admin_set_marketing_scope", {
          p_passcode: accessCode,
          p_username: session.username,
          p_password: session.password,
          p_staff_id: staffId,
          p_scope: marketingScope
        });

        document.getElementById("staffDialog")?.close();
        await refreshData(true);
        toast(id ? "Personel ve Pazarlama alanı güncellendi" : "Personel eklendi");
      } catch (err) {
        console.error(err);
        toast(/unique|duplicate/i.test(err?.message || "") ? "Bu personel zaten var" : (err?.message || "Personel kaydedilemedi"));
      } finally {
        button.disabled = false;
      }
    };
  }

  if (orderForm) {
    orderForm.onsubmit = async event => {
      event.preventDefault();
      setOrderError("");
      if (!event.currentTarget.reportValidity()) return;

      const actor = typeof currentPerson === "function" ? currentPerson() : null;
      if (!actor || !actor.roles?.includes("marketing")) {
        setOrderError("Pazarlama personeli seçin.");
        return;
      }

      const marketScope = orderScopeSelect?.value || "";
      if (!["domestic", "international"].includes(marketScope)) {
        setOrderError("Siparişin Yurt İçi mi Yurt Dışı mı olduğunu seçin.");
        return;
      }

      const actorScope = actor.marketingScope || "both";
      if (["domestic", "international"].includes(actorScope) && actorScope !== marketScope) {
        setOrderError(`${actor.name} yalnızca ${scopeLabel(actorScope)} siparişlerden sorumlu.`);
        return;
      }

      const req = [];
      if (document.getElementById("reqKutu")?.checked) req.push("Kutu");
      if (document.getElementById("reqLazer")?.checked) req.push("Lazer");
      if (document.getElementById("reqEtiket")?.checked) req.push("Etiket");

      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;

      try {
        await rpc("app_create_order_scoped", {
          p_passcode: accessCode,
          p_order_no: orderNoInput?.value.trim() || "",
          p_customer: customerInput?.value.trim() || "",
          p_market_scope: marketScope,
          p_requirements: req,
          p_note: document.getElementById("orderNote")?.value.trim() || null,
          p_marketing_owner_id: actor.id
        });
        document.getElementById("orderDialog")?.close();
        await refreshData(true);
        toast(`${scopeLabel(marketScope)} sipariş Depo'ya gönderildi`);
      } catch (err) {
        console.error(err);
        const message = /duplicate|unique/i.test(err?.message || "")
          ? "Bu sipariş numarası zaten sistemde kayıtlı."
          : (err?.message || "Sipariş kaydedilemedi.");
        setOrderError(message);
      } finally {
        button.disabled = false;
      }
    };
  }

  document.getElementById("newOrderBtn")?.addEventListener("click", () => {
    setTimeout(() => {
      setOrderError("");
      syncOrderScopeField();
    }, 0);
  });

  orderScopeSelect?.addEventListener("change", () => setOrderError(""));

  function syncMarketingGrid() {
    const cards = document.getElementById("workCards");
    if (!cards) return;
    cards.classList.toggle(
      "marketing-three-grid",
      typeof role !== "undefined" && role === "marketing"
    );
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      syncMarketingGrid();
      decorateOrderCards();
      decorateAdminRows();
      decorateStaffTable();
      syncStaffScopeVisibility();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => {
    setTimeout(() => {
      syncMarketingGrid();
      syncOrderScopeField();
    }, 0);
  });

  document.getElementById("personSelect")?.addEventListener("change", () => {
    setTimeout(syncOrderScopeField, 0);
  });

  setTimeout(syncMarketingGrid, 0);

  // app.js boot() bu dosyadan hemen önce çalıştığı için ilk veriyi yeni alanlarla bir kez garanti tazele.
  setTimeout(function ensureScopedData() {
    if (typeof accessCode === "undefined" || !accessCode) return;
    if (typeof refreshing !== "undefined" && refreshing) {
      setTimeout(ensureScopedData, 350);
      return;
    }
    if (typeof refreshData === "function") refreshData(true);
  }, 350);
})();
