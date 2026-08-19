(() => {
  if (window.__karacaAdminNoteDetailLoaded) return;
  window.__karacaAdminNoteDetailLoaded = true;

  const SEEN_KEY = "karaca_admin_note_seen_v1";

  const style = document.createElement("style");
  style.textContent = `
    .admin-detail-note b{
      display:block;
      margin-bottom:5px;
      font-size:10px;
      font-weight:900;
      letter-spacing:.04em;
      text-transform:uppercase;
      color:#344054;
    }
    .admin-detail-note div{
      white-space:pre-wrap;
      line-height:1.55;
    }
    .admin-note-unread-btn{
      position:relative;
      overflow:visible!important;
    }
    .admin-note-unread-badge{
      position:absolute;
      top:-8px;
      right:-8px;
      display:flex;
      align-items:center;
      justify-content:center;
      width:18px;
      height:18px;
      min-width:18px;
      border:2px solid #fff;
      border-radius:999px;
      background:#d92d20;
      color:#fff;
      font-size:10px;
      font-weight:950;
      line-height:1;
      box-shadow:0 2px 5px rgba(180,35,24,.24);
      pointer-events:none;
      z-index:2;
    }
    .admin-elapsed-time{
      white-space:nowrap;
      font-weight:800;
      color:#475467;
      font-variant-numeric:tabular-nums;
    }
    .admin-elapsed-time.is-done{
      color:#067647;
    }
  `;
  document.head.appendChild(style);

  function readSeen() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeSeen(value) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(value));
    } catch {}
  }

  function actorKey() {
    const currentRole = typeof role !== "undefined" ? role : "unknown";
    let personId = "";
    try {
      personId = typeof currentPerson === "function" ? (currentPerson()?.id || "") : "";
    } catch {}
    return `${currentRole}:${personId || "anonymous"}`;
  }

  function noteFingerprint(note) {
    const value = String(note || "");
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${value.length}:${hash >>> 0}`;
  }

  function orderById(id) {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return null;
    return orders.find(item => item.id === id) || null;
  }

  function orderByNo(orderNo) {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return null;
    const target = String(orderNo || "").trim();
    return orders.find(item => String(item.orderNo || "").trim() === target) || null;
  }

  function isUnread(order) {
    if (!order || !String(order.adminNote || "").trim()) return false;
    if (typeof role !== "undefined" && role === "admin") return false;

    const seen = readSeen();
    const key = actorKey();
    const saved = seen?.[key]?.[order.id] || "";
    return saved !== noteFingerprint(order.adminNote);
  }

  function markSeen(orderId) {
    const order = orderById(orderId);
    if (!order || !String(order.adminNote || "").trim()) return;
    if (typeof role !== "undefined" && role === "admin") return;

    const seen = readSeen();
    const key = actorKey();
    if (!seen[key] || typeof seen[key] !== "object") seen[key] = {};
    seen[key][order.id] = noteFingerprint(order.adminNote);
    writeSeen(seen);
  }

  function decorateNoteBadges() {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    document.querySelectorAll("[data-detail], [data-all-detail]").forEach(button => {
      const orderId = button.dataset.detail || button.dataset.allDetail || "";
      const order = orderById(orderId);
      const unread = isUnread(order);
      let badge = button.querySelector("[data-admin-note-unread]");

      button.classList.toggle("admin-note-unread-btn", unread);

      if (!unread) {
        badge?.remove();
        return;
      }

      if (!badge) {
        badge = document.createElement("span");
        badge.className = "admin-note-unread-badge";
        badge.dataset.adminNoteUnread = "1";
        badge.textContent = "1";
        badge.title = "Yeni Admin notu";
        button.appendChild(badge);
      }
    });
  }

  function elapsedText(order) {
    if (!order?.createdAt) return "-";
    const start = new Date(order.createdAt).getTime();
    if (!Number.isFinite(start)) return "-";

    const end = order.phase === "done" && order.updatedAt
      ? new Date(order.updatedAt).getTime()
      : Date.now();
    if (!Number.isFinite(end)) return "-";

    const totalMinutes = Math.max(0, Math.floor((end - start) / 60000));
    if (totalMinutes < 60) return `${totalMinutes} dk`;

    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours < 24) return minutes ? `${totalHours} sa ${minutes} dk` : `${totalHours} sa`;

    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return hours ? `${days} gün ${hours} sa` : `${days} gün`;
  }

  function decorateAdminElapsedTimes() {
    if (typeof role === "undefined" || role !== "admin") return;
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    const table = document.querySelector(".admin-order-table");
    const body = document.getElementById("allTable");
    if (!table || !body) return;

    const headRow = table.tHead?.rows?.[0] || null;
    if (headRow && !headRow.querySelector("[data-admin-elapsed-head]")) {
      const th = document.createElement("th");
      th.dataset.adminElapsedHead = "1";
      th.textContent = "GEÇEN SÜRE";
      headRow.insertBefore(th, headRow.lastElementChild || null);
    }

    body.querySelectorAll("tr").forEach(row => {
      const emptyCell = row.querySelector("td[colspan]");
      if (emptyCell) {
        emptyCell.colSpan = Math.max(Number(emptyCell.colSpan) || 11, 12);
        return;
      }

      const orderNo = row.querySelector("td:first-child strong")?.textContent?.trim() || "";
      const order = orderByNo(orderNo);
      if (!order) return;

      let cell = row.querySelector("[data-admin-elapsed-cell]");
      if (!cell) {
        cell = document.createElement("td");
        cell.dataset.adminElapsedCell = "1";
        cell.className = "admin-elapsed-time";
        row.insertBefore(cell, row.lastElementChild || null);
      }

      cell.textContent = elapsedText(order);
      cell.classList.toggle("is-done", order.phase === "done");
      cell.title = order.phase === "done"
        ? "Siparişin açılıştan tamamlanmaya kadar toplam süresi"
        : "Sipariş açıldığından beri geçen süre";
    });
  }

  if (typeof mapOrder === "function") {
    const baseMapOrder = mapOrder;
    mapOrder = function (raw) {
      const mapped = baseMapOrder(raw);
      mapped.adminNote = raw?.admin_note || "";
      return mapped;
    };
  }

  if (typeof rpc === "function") {
    const baseRpc = rpc;
    rpc = async function (name, args) {
      const result = await baseRpc.call(this, name, args);

      if (name === "app_admin_set_order_note" && typeof orders !== "undefined" && Array.isArray(orders)) {
        const order = orders.find(item => item.id === args?.p_order_id);
        if (order) order.adminNote = String(args?.p_note || "").trim();
      }

      return result;
    };
  }

  function decorateAdminNote(orderId) {
    if (typeof orders === "undefined" || !Array.isArray(orders)) return;

    const order = orders.find(item => item.id === orderId) || null;
    const content = document.getElementById("detailContent");
    if (!order || !content) return;

    content.querySelector("[data-detail-admin-note]")?.remove();
    if (!String(order.adminNote || "").trim()) return;

    const box = document.createElement("div");
    box.className = "note admin-detail-note";
    box.dataset.detailAdminNote = "1";

    const label = document.createElement("b");
    label.textContent = "Admin Notu";

    const text = document.createElement("div");
    text.textContent = order.adminNote;

    box.append(label, text);

    const timeline = content.querySelector(".timeline");
    if (timeline) content.insertBefore(box, timeline);
    else content.appendChild(box);
  }

  if (typeof openDetail === "function") {
    const baseOpenDetail = openDetail;
    openDetail = function (id) {
      const result = baseOpenDetail(id);
      decorateAdminNote(id);
      markSeen(id);
      decorateNoteBadges();
      return result;
    };
  }

  if (typeof renderWork === "function") {
    const baseRenderWork = renderWork;
    renderWork = function (...args) {
      const result = baseRenderWork.apply(this, args);
      decorateNoteBadges();
      return result;
    };
  }

  if (typeof renderAll === "function") {
    const baseRenderAll = renderAll;
    renderAll = function (...args) {
      const result = baseRenderAll.apply(this, args);
      decorateNoteBadges();
      decorateAdminElapsedTimes();
      return result;
    };
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      decorateNoteBadges();
      decorateAdminElapsedTimes();
      return result;
    };
  }

  document.getElementById("roleSelect")?.addEventListener("change", () => setTimeout(() => {
    decorateNoteBadges();
    decorateAdminElapsedTimes();
  }, 0));
  document.getElementById("personSelect")?.addEventListener("change", () => setTimeout(decorateNoteBadges, 0));
  document.getElementById("allNav")?.addEventListener("click", () => setTimeout(decorateAdminElapsedTimes, 0));

  setInterval(() => {
    if (typeof role !== "undefined" && role === "admin") decorateAdminElapsedTimes();
  }, 60000);

  setTimeout(() => {
    decorateNoteBadges();
    decorateAdminElapsedTimes();
  }, 0);
})();
