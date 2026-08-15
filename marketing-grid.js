(() => {
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
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => {
    setTimeout(syncMarketingGrid, 0);
  });

  setTimeout(syncMarketingGrid, 0);
})();
