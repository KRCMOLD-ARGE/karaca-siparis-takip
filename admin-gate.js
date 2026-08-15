(() => {
  const adminBtn = document.getElementById("adminEntryBtn");
  const adminDialog = document.getElementById("adminLoginDialog");
  const adminForm = document.getElementById("adminLoginForm");
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const roleSelectEl = document.getElementById("roleSelect");
  const orderDialog = document.getElementById("orderDialog");
  const orderForm = document.getElementById("orderForm");
  const orderNoInput = document.getElementById("orderNo");

  const style = document.createElement("style");
  style.textContent = `
    .dialog-inline-error{
      margin:0 21px 14px;
      padding:10px 12px;
      border:1px solid #f3b7b2;
      border-radius:10px;
      background:#fff1f0;
      color:#b42318;
      font-size:12px;
      font-weight:750;
      line-height:1.45;
    }
    .dialog-inline-error.hidden{display:none!important}
    .field-error{border-color:#d92d20!important;box-shadow:0 0 0 3px rgba(217,45,32,.08)!important}
  `;
  document.head.appendChild(style);

  function ensureErrorBox(form, key) {
    if (!form) return null;
    let box = form.querySelector(`[data-inline-error="${key}"]`);
    if (!box) {
      box = document.createElement("div");
      box.className = "dialog-inline-error hidden";
      box.dataset.inlineError = key;
      const actions = form.querySelector(".dialog-actions");
      if (actions) form.insertBefore(box, actions);
      else form.appendChild(box);
    }
    return box;
  }

  const adminError = ensureErrorBox(adminForm, "admin");
  const orderError = ensureErrorBox(orderForm, "order");

  function setError(box, message, input) {
    if (!box) return;
    box.textContent = message || "Bir hata oluştu.";
    box.classList.remove("hidden");
    input?.classList.add("field-error");
  }

  function clearError(box, input) {
    box?.classList.add("hidden");
    if (box) box.textContent = "";
    input?.classList.remove("field-error");
  }

  function syncAdminButton() {
    if (!adminBtn) return;
    adminBtn.classList.toggle("active", typeof role !== "undefined" && role === "admin");
  }

  function openAdminLogin() {
    if (!adminDialog) return;
    adminForm?.reset();
    clearError(adminError, passwordInput);
    if (usernameInput) usernameInput.value = "admin";
    adminDialog.showModal();
    setTimeout(() => passwordInput?.focus(), 0);
  }

  function enterAdmin() {
    role = "admin";
    if (roleSelectEl) roleSelectEl.value = "admin";
    if (typeof switchView === "function") switchView("all", false);
    if (typeof render === "function") render();
    syncAdminButton();
    if (typeof toast === "function") toast("Admin paneli açıldı");
  }

  adminBtn?.addEventListener("click", () => {
    if (typeof role !== "undefined" && role === "admin") {
      if (typeof switchView === "function") switchView("all");
      return;
    }
    openAdminLogin();
  });

  adminForm?.addEventListener("submit", async event => {
    event.preventDefault();
    clearError(adminError, passwordInput);

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!username || !password) {
      setError(adminError, "Kullanıcı adı ve şifreyi girin.", !username ? usernameInput : passwordInput);
      return;
    }

    const submitBtn = adminForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Kontrol ediliyor...";
    }

    try {
      const ok = await rpc("app_admin_login", {
        p_passcode: accessCode,
        p_username: username,
        p_password: password
      });

      if (!ok) {
        setError(adminError, "Admin kullanıcı adı veya şifre hatalı. Kullanıcı adı: admin", passwordInput);
        passwordInput?.select();
        return;
      }

      adminDialog.close();
      enterAdmin();
    } catch (err) {
      console.error(err);
      setError(adminError, err?.message || "Admin doğrulaması yapılamadı. Tekrar deneyin.", passwordInput);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Admin'e Gir";
      }
    }
  });

  usernameInput?.addEventListener("input", () => clearError(adminError, passwordInput));
  passwordInput?.addEventListener("input", () => clearError(adminError, passwordInput));

  // Sipariş formunda aynı sipariş numarasının tekrar girildiğini daha sunucuya gitmeden göster.
  document.addEventListener("submit", event => {
    if (event.target !== orderForm) return;
    clearError(orderError, orderNoInput);
    const orderNo = orderNoInput?.value.trim() || "";
    const normalized = orderNo.toLocaleLowerCase("tr-TR");
    const exists = Array.isArray(orders) && orders.some(o => String(o.orderNo || "").trim().toLocaleLowerCase("tr-TR") === normalized);
    if (orderNo && exists) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setError(orderError, `“${orderNo}” sipariş numarası zaten sistemde kayıtlı. Farklı bir sipariş numarası girin.`, orderNoInput);
      orderNoInput?.focus();
    }
  }, true);

  orderNoInput?.addEventListener("input", () => clearError(orderError, orderNoInput));
  document.getElementById("newOrderBtn")?.addEventListener("click", () => setTimeout(() => clearError(orderError, orderNoInput), 0));

  // Modal açıkken normal toast arka planda kaldığı için sipariş RPC hatalarını formun içinde görünür yap.
  if (typeof rpc === "function") {
    const baseRpc = rpc;
    rpc = async function(name, args) {
      try {
        return await baseRpc(name, args);
      } catch (err) {
        if (name === "app_create_order") {
          const msg = /duplicate|unique|orders_order_no_key/i.test(err?.message || "")
            ? "Bu sipariş numarası zaten sistemde kayıtlı. Farklı bir sipariş numarası girin."
            : (err?.message || "Sipariş kaydedilemedi. Tekrar deneyin.");
          setError(orderError, msg, orderNoInput);
        }
        throw err;
      }
    };
  }

  roleSelectEl?.addEventListener("change", () => {
    setTimeout(syncAdminButton, 0);
  });

  syncAdminButton();
})();
