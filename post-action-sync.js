(() => {
  // Her siparis aksiyonundan ve ekran/sekmeler arasi gecisten yaklasik 500 ms sonra
  // bir kez daha zorunlu veri senkronizasyonu yap. Ilk hizli render yine mevcut
  // akista gerceklesir; bu ikinci tur ekranda eski veri kalmasini temizler.
  if (typeof updateOrder !== "function") return;

  const baseUpdateOrder = updateOrder;
  let syncTimer = null;

  function forceSyncWhenIdle() {
    if (typeof accessCode === "undefined" || !accessCode) return;

    // O anda baska bir veri yenilemesi calisiyorsa onun bitmesini bekle. Boylece
    // iki Supabase okumasi ayni anda render etmeye calismaz.
    if (typeof refreshing !== "undefined" && refreshing) {
      syncTimer = setTimeout(forceSyncWhenIdle, 100);
      return;
    }

    if (typeof refreshData === "function") {
      Promise.resolve(refreshData(true)).catch(err => console.error("500ms otomatik senkronizasyonu basarisiz", err));
    }
  }

  function scheduleForcedSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(forceSyncWhenIdle, 500);
  }

  updateOrder = function (...args) {
    // Sayac aksiyon aninda baslar. 500 ms geldiginde kayit/yenileme hala suruyorsa
    // forceSyncWhenIdle mevcut islemin bitmesini bekleyip hemen ardindan calisir.
    const result = baseUpdateOrder.apply(this, args);
    scheduleForcedSync();
    return result;
  };

  // Ilk Depo Akisi <-> Onay Sonrasi Depo gibi sekme gecislerinde de yeni ekran
  // acildiktan yarim saniye sonra veriyi tekrar Supabase'den dogrula.
  document.addEventListener("click", event => {
    const tabOrView = event.target.closest?.("[data-wh-tab], .nav-btn[data-view]");
    if (!tabOrView) return;
    scheduleForcedSync();
  });

  // Pazarlama / Depo / Operasyon / Sevkiyat bolum degisiminde de ayni korumayi uygula.
  document.getElementById("roleSelect")?.addEventListener("change", scheduleForcedSync);
})();
