(() => {
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

  function renderNotificationBadges() {
    renderWorkBadge();
    renderWarehouseTabBadges();
    renderOrderAges();
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

  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-claim]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const row = button.closest(".inline-form");
    const ownerSelect = row?.querySelector("[data-owner]");
    const sidebarSelect = document.getElementById("personSelect");
    const selectedId = ownerSelect?.value || sidebarSelect?.value || "";
    const actor = typeof personById === "function" ? personById(selectedId) : null;

    if (!actor || !actor.roles?.includes("warehouse")) {
      if (typeof toast === "function") toast("Önce Depo personelini seçin");
      return;
    }

    if (typeof selectedPeople === "object" && selectedPeople) {
      selectedPeople.warehouse = actor.id;
      if (typeof saveSelectedPeople === "function") saveSelectedPeople();
    }
    if (sidebarSelect) sidebarSelect.value = actor.id;

    if (typeof updateOrder === "function") {
      updateOrder(
        button.dataset.claim,
        { warehouse_owner_id: actor.id },
        `${actor.name} siparişi üzerine aldı.`
      );
    }
  }, true);

  setInterval(renderNotificationBadges, 3000);
  setTimeout(renderNotificationBadges, 0);
})();
