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

  function activeCountForRole() {
    if (typeof orders === "undefined" || !Array.isArray(orders) || typeof role === "undefined") return 0;

    switch (role) {
      case "warehouse":
        return orders.filter(o => o.phase === "warehouse1" || o.phase === "warehouse2").length;
      case "operations":
        return orders.filter(o => o.phase === "operations").length;
      case "shipping":
        return orders.filter(o => o.phase === "shipping").length;
      case "marketing":
        return orders.filter(o => o.phase !== "done").length;
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
    badge.setAttribute("aria-label", `${count} aktif iş`);
    badge.title = `${count} aktif iş`;
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

    const firstCount = orders.filter(o => o.phase === "warehouse1").length;
    const secondCount = orders.filter(o => o.phase === "warehouse2").length;

    firstBadge.textContent = badgeText(firstCount);
    firstBadge.classList.toggle("hidden", firstCount === 0);
    firstBadge.title = `${firstCount} sipariş İlk Depo Akışında`;
    animateIfIncreased(firstBadge, "first", firstCount);

    secondBadge.textContent = badgeText(secondCount);
    secondBadge.classList.toggle("hidden", secondCount === 0);
    secondBadge.title = `${secondCount} sipariş Onay Sonrası Depoda`;
    animateIfIncreased(secondBadge, "second", secondCount);
  }

  function renderNotificationBadges() {
    renderWorkBadge();
    renderWarehouseTabBadges();
  }

  // app.js içindeki ana render fonksiyonuna bağlanır.
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

  // Depoda "Üzerime Al" işlemi, kartta seçili sorumluyu esas alır.
  // Kartta seçim yoksa sol menüde seçili Depo personeli kullanılır.
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-claim]");
    if (!button) return;

    // app.js içindeki eski click handler'ın farklı kişiyi yeniden atamasını engelle.
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

    // Sol menüdeki aktif personeli de aynı kişiyle senkron tut.
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

  // Supabase otomatik yenilemelerine karşı emniyetli güncelleme.
  setInterval(renderNotificationBadges, 3000);
  setTimeout(renderNotificationBadges, 0);
})();
