(() => {
  let lastCount = -1;

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
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.toggle("hidden", count === 0);
    badge.setAttribute("aria-label", `${count} aktif iş`);
    badge.title = `${count} aktif iş`;

    if (lastCount >= 0 && count > lastCount) {
      badge.classList.remove("badge-pop");
      void badge.offsetWidth;
      badge.classList.add("badge-pop");
    }
    lastCount = count;
  }

  // app.js içindeki ana render fonksiyonuna bağlanır.
  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      renderWorkBadge();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(renderWorkBadge, 0));
  document.getElementById("personSelect")?.addEventListener("change", () => setTimeout(renderWorkBadge, 0));

  // Supabase otomatik yenilemelerine karşı emniyetli güncelleme.
  setInterval(renderWorkBadge, 3000);
  setTimeout(renderWorkBadge, 0);
})();
