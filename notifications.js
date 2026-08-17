(() => {
  // Kullanıcı işlemlerinden sonra ekran yenilemesinin kaybolmaması için tüm yenilemeleri
  // sıraya al. Sipariş güncellemelerinde personel listesini tekrar çekmeyip yalnızca
  // siparişleri yenileyerek İlk Depo ekranını daha hızlı tepki verir hale getir.
  function waitForLegacyRefresh() {
    if (typeof refreshing === "undefined" || !refreshing) return Promise.resolve();
    return new Promise(resolve => {
      const check = () => {
        if (!refreshing) resolve();
        else setTimeout(check, 20);
      };
      check();
    });
  }

  let refreshQueue = waitForLegacyRefresh();

  async function performQueuedRefresh(mode = "full", silent = false) {
    if (typeof accessCode === "undefined" || !accessCode) return;

    refreshing = true;
    try {
      if (mode === "orders") {
        const orderData = await rpc("app_list_orders", { p_passcode: accessCode });
        orders = (Array.isArray(orderData) ? orderData : []).map(mapOrder);
      } else {
        const [orderData, staffData] = await Promise.all([
          rpc("app_list_orders", { p_passcode: accessCode }),
          rpc("app_list_staff", { p_passcode: accessCode })
        ]);
        orders = (Array.isArray(orderData) ? orderData : []).map(mapOrder);
        staff = (Array.isArray(staffData) ? staffData : []).map(mapStaff);
      }

      render();
      if (!silent && typeof toast === "function") toast("Veriler yenilendi");
    } catch (err) {
      console.error(err);
      if (typeof isAuthError === "function" && isAuthError(err)) {
        if (typeof lockApp === "function") lockApp("Erişim kodu geçersiz veya değiştirildi.");
      } else if (!silent && typeof toast === "function") {
        toast("Supabase bağlantısı kurulamadı");
      }
    } finally {
      refreshing = false;
    }
  }

  function enqueueRefresh(mode = "full", silent = false) {
    const run = () => performQueuedRefresh(mode, silent);
    const next = refreshQueue.then(run, run);
    refreshQueue = next.catch(() => {});
    return next;
  }

  refreshData = function (silent = false) {
    return enqueueRefresh("full", silent);
  };

  async function refreshOrdersOnly(silent = true) {
    return enqueueRefresh("orders", silent);
  }

  updateOrder = async function (id, patch, eventText) {
    try {
      await rpc("app_update_order", {
        p_passcode: accessCode,
        p_id: id,
        p_patch: patch,
        p_event_text: eventText
      });
      await refreshOrdersOnly(true);
      if (typeof toast === "function") toast(eventText);
    } catch (err) {
      console.error(err);
      if (typeof toast === "function") toast(err.message || "Güncelleme yapılamadı");
    }
  };

  const lastCounts = { work: -1, first: -1, second: -1 };

  function badgeText(count) {
    return count > 99 ? "99+" : String(count);
  }

  function animateIfIncreased(badge, key, count) {
    if (lastCounts[key] >= 0 && count > lastCounts[key]) {
      badge.classList.remove("badge-pop");
      void badge.offsetWidth;
      badge.classList.add("badge-pop");
    }
    lastCounts[key] = count;
  }

  function isWarehouseUnassigned(order) {
    const ownerId = String(order?.warehouseOwnerId || "").trim();
    const legacyOwner = String(order?.warehouseOwner || "").trim();
    return !ownerId && !legacyOwner;
  }

  function isWarehouseNew(order, tab) {
    if (typeof window.isWarehouseOrderNew === "function") {
      return window.isWarehouseOrderNew(order, tab);
    }
    return isWarehouseUnassigned(order);
  }

  function activeCountForRole() {
    if (typeof orders === "undefined" || !Array.isArray(orders) || typeof role === "undefined") return 0;

    switch (role) {
      case "warehouse":
        return orders.filter(o =>
          (o.phase === "warehouse1" && isWarehouseNew(o, "first")) ||
          (o.phase === "warehouse2" && isWarehouseNew(o, "second"))
        ).length;
      case "operations":
        return orders.filter(o => o.phase === "operations").length;
      case "shipping":
        return orders.filter(o => o.phase === "shipping").length;
      case "marketing": {
        const visible = typeof roleOrders === "function" ? roleOrders() : orders;
        return visible.filter(o => o.phase !== "done").length;
      }
      case "admin":
        return orders.filter(o => o.phase !== "done").length;
      default:
        return 0;
    }
  }

  function renderWorkBadge() {
    const badge = document.getElementById("workBadge");
    if (!badge) return;

    const count = activeCountForRole();
    badge.textContent = badgeText(count);
    badge.classList.toggle("hidden", count === 0);
    const label = role === "warehouse" ? `${count} yeni depo işi` : `${count} aktif iş`;
    badge.setAttribute("aria-label", label);
    badge.title = label;
    animateIfIncreased(badge, "work", count);
  }

  function getOrCreateTabBadge(tab, key) {
    if (!tab) return null;
    let badge = tab.querySelector(`.tab-badge[data-badge="${key}"]`);
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "tab-badge hidden";
      badge.dataset.badge = key;
      badge.setAttribute("aria-hidden", "true");
      tab.appendChild(badge);
    }
    return badge;
  }

  function renderWarehouseTabBadges() {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    const firstTab = document.querySelector('[data-wh-tab="first"]');
    const secondTab = document.querySelector('[data-wh-tab="second"]');
    const firstBadge = getOrCreateTabBadge(firstTab, "first");
    const secondBadge = getOrCreateTabBadge(secondTab, "second");

    if (!firstBadge || !secondBadge) return;

    const firstCount = orders.filter(o => o.phase === "warehouse1" && isWarehouseNew(o, "first")).length;
    const secondCount = orders.filter(o => o.phase === "warehouse2" && isWarehouseNew(o, "second")).length;

    firstBadge.textContent = badgeText(firstCount);
    firstBadge.classList.toggle("hidden", firstCount === 0);
    firstBadge.title = `${firstCount} yeni sipariş İlk Depo Akışında`;
    animateIfIncreased(firstBadge, "first", firstCount);

    secondBadge.textContent = badgeText(secondCount);
    secondBadge.classList.toggle("hidden", secondCount === 0);
    secondBadge.title = `${secondCount} yeni sipariş Onay Sonrası Depoda`;
    animateIfIncreased(secondBadge, "second", secondCount);
  }

  function elapsedText(order) {
    if (!order?.createdAt) return "-";
    const start = new Date(order.createdAt).getTime();
    if (!Number.isFinite(start)) return "-";

    const finishedAt = order.phase === "done" && order.updatedAt
      ? new Date(order.updatedAt).getTime()
      : Date.now();
    const diffMs = Math.max(0, finishedAt - start);
    const hours = Math.floor(diffMs / 3600000);

    if (hours < 24) return `${hours} saat`;
    return `${Math.floor(hours / 24)} gün`;
  }

  function renderOrderAges() {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    document.querySelectorAll(".order-card").forEach(card => {
      const orderNo = card.querySelector(".order-no")?.textContent?.trim();
      if (!orderNo) return;
      const order = orders.find(o => String(o.orderNo).trim() === orderNo);
      if (!order) return;

      const cardTop = card.querySelector(".card-top");
      const status = cardTop?.querySelector(".status-pill");
      if (!cardTop || !status) return;

      let stack = cardTop.querySelector(".card-status-stack");
      if (!stack) {
        stack = document.createElement("div");
        stack.className = "card-status-stack";
        status.replaceWith(stack);
        stack.appendChild(status);
      }

      let age = stack.querySelector(".order-age");
      if (!age) {
        age = document.createElement("span");
        age.className = "order-age";
        stack.appendChild(age);
      }

      const text = elapsedText(order);
      age.textContent = `◷ ${text}`;
      age.title = order.phase === "done"
        ? `Toplam sipariş süresi: ${text}`
        : `Sipariş açılalı: ${text}`;
      age.classList.toggle("order-age-done", order.phase === "done");
    });
  }

  // Depo kartındaki personel listesi artık sadece seçim yapar.
  // Gerçek atama ve Yeni Gelen -> Yürüyen geçişi yalnızca "Üzerime Al" tıklanınca yapılır.
  function prepareWarehouseClaimControls() {
    if (typeof role === "undefined" || role !== "warehouse") return;

    document.querySelectorAll("#workCards select[data-owner]").forEach(select => {
      select.onchange = event => {
        event.stopPropagation();
      };
      select.title = "Personeli seçin; atama Üzerime Al butonuna basınca yapılır.";
    });
  }

  function renderNotificationBadges() {
    renderWorkBadge();
    renderWarehouseTabBadges();
    renderOrderAges();
    prepareWarehouseClaimControls();
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      renderNotificationBadges();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(renderNotificationBadges, 0));
  document.getElementById("personSelect")?.addEventListener("change", () => setTimeout(renderNotificationBadges, 0));

  document.addEventListener("click", async event => {
    const button = event.target.closest?.("[data-claim]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const row = button.closest(".inline-form");
    const ownerSelect = row?.querySelector("[data-owner]");
    const sidebarSelect = document.getElementById("personSelect");

    // Kartta personel seçimi varsa sadece onu kullan. Boşsa otomatik olarak üstteki
    // personeli atama; kullanıcı önce karttan kimi atayacağını seçsin.
    const selectedId = ownerSelect ? ownerSelect.value : (sidebarSelect?.value || "");
    const actor = typeof personById === "function" ? personById(selectedId) : null;

    if (!actor || !actor.roles?.includes("warehouse")) {
      if (typeof toast === "function") toast("Önce karttan Depo personelini seçin");
      return;
    }

    if (typeof selectedPeople === "object" && selectedPeople) {
      selectedPeople.warehouse = actor.id;
      if (typeof saveSelectedPeople === "function") saveSelectedPeople();
    }
    if (sidebarSelect) sidebarSelect.value = actor.id;

    if (typeof updateOrder === "function") {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Atanıyor...";

      try {
        await updateOrder(
          button.dataset.claim,
          { warehouse_owner_id: actor.id },
          `${actor.name} siparişi üzerine aldı.`
        );

        // updateOrder sunucudaki atamayı kaydedip veriyi yeniler. Bu çağrıdan sonra
        // grup tekrar hesaplanır: atanmış sipariş artık Yeni Gelen değil Yürüyen'dir.
        if (typeof window.groupWarehouseOrders === "function") {
          window.groupWarehouseOrders();
        }
        if (typeof window.syncWarehouseWorkload === "function") {
          window.syncWarehouseWorkload();
        }
        renderNotificationBadges();
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }
  }, true);

  setInterval(renderNotificationBadges, 3000);
  setTimeout(renderNotificationBadges, 0);
})();
