(() => {
  function ensureLayout() {
    const workView = document.getElementById("workView");
    const workCards = document.getElementById("workCards");
    if (!workView || !workCards) return null;

    let layout = document.getElementById("warehouseWorkLayout");
    if (layout) return layout;

    layout = document.createElement("div");
    layout.id = "warehouseWorkLayout";
    layout.className = "warehouse-work-layout";

    const main = document.createElement("div");
    main.className = "warehouse-work-main";

    const panel = document.createElement("aside");
    panel.id = "warehouseWorkloadPanel";
    panel.className = "warehouse-workload-panel";
    panel.setAttribute("aria-label", "Depo iş yükü");
    panel.innerHTML = `
      <div class="warehouse-workload-head">
        <div><b>Depo İş Yükü</b><small>Personele bağlı devam eden işlerin dağılımı</small></div>
        <span class="warehouse-workload-total" id="warehouseWorkloadTotal">0</span>
      </div>
      <div class="warehouse-workload-list" id="warehouseWorkloadList"></div>
      <div class="warehouse-workload-foot">Liste en az işi olan personelden en çok işi olana doğru sıralanır. Operasyonda bekleyen ve aynı Depo personeline geri dönecek siparişler yükte kalır; iş ancak Sevkiyata geçtiğinde Depo yükünden düşer.</div>
    `;

    workCards.parentNode.insertBefore(layout, workCards);
    main.appendChild(workCards);
    layout.append(main, panel);
    return layout;
  }

  function warehouseStaff() {
    if (typeof activeStaffFor === "function") return activeStaffFor("warehouse");
    if (typeof staff === "undefined" || !Array.isArray(staff)) return [];
    return staff.filter(person => person.active !== false && person.roles?.includes("warehouse"));
  }

  function ownerIdForOrder(order) {
    const direct = String(order?.warehouseOwnerId || "").trim();
    if (direct) return direct;

    const legacyName = String(order?.warehouseOwner || "").trim();
    if (!legacyName || typeof staff === "undefined" || !Array.isArray(staff)) return "";
    return staff.find(person => person.name === legacyName)?.id || "";
  }

  function countsAsWarehouseLoad(order) {
    if (!order || !["warehouse1", "operations", "warehouse2"].includes(order.phase)) return false;
    if (!ownerIdForOrder(order)) return false;

    // Onay Sonrası Depo'ya dönmüş ancak henüz gerçekten bir sorumluya bağlanmamış
    // eski kayıtları yük hesabına dahil etme. Otomatik devam eden İlk Depo sorumlusu
    // ise warehouse-owner-continuity.js tarafından atanmış kabul edilir.
    if (order.phase === "warehouse2" && typeof window.isWarehouseOrderNew === "function") {
      if (window.isWarehouseOrderNew(order, "second")) return false;
    }

    return true;
  }

  function buildLoads() {
    const people = warehouseStaff();
    const map = new Map(people.map(person => [person.id, {
      person,
      first: 0,
      operations: 0,
      second: 0,
      total: 0
    }]));

    if (typeof orders !== "undefined" && Array.isArray(orders)) {
      orders.forEach(order => {
        if (!countsAsWarehouseLoad(order)) return;
        const row = map.get(ownerIdForOrder(order));
        if (!row) return;
        if (order.phase === "warehouse1") row.first += 1;
        if (order.phase === "operations") row.operations += 1;
        if (order.phase === "warehouse2") row.second += 1;
        row.total += 1;
      });
    }

    return [...map.values()].sort((a, b) =>
      a.total - b.total ||
      a.first - b.first ||
      a.operations - b.operations ||
      a.second - b.second ||
      a.person.name.localeCompare(b.person.name, "tr")
    );
  }

  function initials(name = "") {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toLocaleUpperCase("tr-TR") || "")
      .join("") || "-";
  }

  function loadClass(total) {
    if (total >= 5) return "load-5plus";
    if (total >= 1) return `load-${total}`;
    return "load-0";
  }

  function renderPanel(loads) {
    const list = document.getElementById("warehouseWorkloadList");
    const total = document.getElementById("warehouseWorkloadTotal");
    if (!list || !total) return;

    const activeTotal = loads.reduce((sum, row) => sum + row.total, 0);
    total.textContent = String(activeTotal);
    total.title = `${activeTotal} Depo işi personele bağlı olarak devam ediyor`;
    list.innerHTML = "";

    if (!loads.length) {
      const empty = document.createElement("div");
      empty.className = "warehouse-order-empty";
      empty.textContent = "Aktif Depo personeli yok.";
      list.appendChild(empty);
      return;
    }

    loads.forEach(row => {
      const item = document.createElement("div");
      item.className = "warehouse-workload-person";
      item.dataset.staffId = row.person.id;

      const avatar = document.createElement("span");
      avatar.className = "warehouse-workload-avatar";
      avatar.textContent = initials(row.person.name);

      const info = document.createElement("div");
      info.className = "warehouse-workload-info";
      const name = document.createElement("strong");
      name.textContent = row.person.name;
      const breakdown = document.createElement("small");
      breakdown.textContent = `İlk Depo: ${row.first} · Operasyonda: ${row.operations} · Onay Sonrası: ${row.second}`;
      info.append(name, breakdown);

      const count = document.createElement("span");
      count.className = `warehouse-workload-count ${loadClass(row.total)}`;
      count.textContent = `${row.total} iş`;
      count.title = `${row.person.name}: ${row.total} devam eden Depo işi`;

      item.append(avatar, info, count);
      list.appendChild(item);
    });
  }

  function orderById(id) {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return null;
    return orders.find(order => order.id === id) || null;
  }

  function decorateOwnerSelects(loads) {
    const loadById = new Map(loads.map(row => [row.person.id, row]));
    const sortedPeople = loads.map(row => row.person);

    document.querySelectorAll("#workCards select[data-owner]").forEach(select => {
      const order = orderById(select.dataset.owner);
      let selectedId = select.value || String(order?.warehouseOwnerId || "");

      if (order?.phase === "warehouse2" && typeof window.isWarehouseOrderNew === "function" && window.isWarehouseOrderNew(order, "second")) {
        selectedId = "";
      }

      const fragment = document.createDocumentFragment();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Sorumlu ata · iş yüküne göre";
      fragment.appendChild(placeholder);

      sortedPeople.forEach(person => {
        const load = loadById.get(person.id)?.total || 0;
        const option = document.createElement("option");
        option.value = person.id;
        option.textContent = `${person.name} — ${load} iş`;
        option.selected = person.id === selectedId;
        fragment.appendChild(option);
      });

      select.replaceChildren(fragment);
      select.value = selectedId;
    });
  }

  function syncWarehouseWorkload() {
    const layout = ensureLayout();
    if (!layout) return;

    const isWarehouse = typeof role !== "undefined" && role === "warehouse";
    layout.classList.toggle("is-warehouse", isWarehouse);
    if (!isWarehouse) return;

    const loads = buildLoads();
    renderPanel(loads);
    decorateOwnerSelects(loads);
  }

  window.syncWarehouseWorkload = syncWarehouseWorkload;

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      syncWarehouseWorkload();
      return result;
    };
  }

  const workCards = document.getElementById("workCards");
  if (workCards) {
    const observer = new MutationObserver(() => {
      if (typeof role !== "undefined" && role === "warehouse") {
        queueMicrotask(syncWarehouseWorkload);
      }
    });
    observer.observe(workCards, { childList: true });
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(syncWarehouseWorkload, 0));
  document.getElementById("personSelect")?.addEventListener("change", () => setTimeout(syncWarehouseWorkload, 0));
  document.querySelectorAll("[data-wh-tab]").forEach(tab => tab.addEventListener("click", () => setTimeout(syncWarehouseWorkload, 0)));
  document.getElementById("searchInput")?.addEventListener("input", () => setTimeout(syncWarehouseWorkload, 0));
  document.getElementById("statusFilter")?.addEventListener("change", () => setTimeout(syncWarehouseWorkload, 0));
  document.getElementById("clearBtn")?.addEventListener("click", () => setTimeout(syncWarehouseWorkload, 0));

  ensureLayout();
  setTimeout(syncWarehouseWorkload, 0);
})();
