(() => {
  const adminBtn = document.getElementById("adminEntryBtn");
  const adminDialog = document.getElementById("adminLoginDialog");
  const adminForm = document.getElementById("adminLoginForm");
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const roleSelectEl = document.getElementById("roleSelect");

  function syncAdminButton() {
    if (!adminBtn) return;
    adminBtn.classList.toggle("active", typeof role !== "undefined" && role === "admin");
  }

  function openAdminLogin() {
    if (!adminDialog) return;
    adminForm?.reset();
    adminDialog.showModal();
    setTimeout(() => usernameInput?.focus(), 0);
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
    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!username || !password) return;

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
        if (typeof toast === "function") toast("Admin kullanıcı adı veya şifre hatalı");
        passwordInput?.select();
        return;
      }

      adminDialog.close();
      enterAdmin();
    } catch (err) {
      console.error(err);
      if (typeof toast === "function") toast("Admin doğrulaması yapılamadı");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Admin'e Gir";
      }
    }
  });

  roleSelectEl?.addEventListener("change", () => {
    setTimeout(syncAdminButton, 0);
  });

  syncAdminButton();
})();
