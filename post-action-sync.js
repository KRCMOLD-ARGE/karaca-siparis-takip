(() => {
  // Siparis aksiyonlarinda kayit islemi tamamen bittikten 100 ms sonra,
  // ekran/sekmeler arasi gecislerde ise gecisten 100 ms sonra zorunlu veri
  // senkronizasyonu yap. Bu ikinci tur ekranda eski veri kalmasini temizler.
  if (typeof updateOrder !== "function") return;

  const baseUpdateOrder = updateOrder;
  let syncTimer = null;

  function forceSyncWhenIdle() {
    if (typeof accessCode === "undefined" || !accessCode) return;

    // O anda baska bir veri yenilemesi calisiyorsa bitmesini kisa araliklarla bekle.
    // Boylece iki Supabase okumasi ayni anda render etmeye calismaz.
    if (typeof refreshing !== "undefined" && refreshing) {
      syncTimer = setTimeout(forceSyncWhenIdle, 25);
      return;
    }

    if (typeof refreshData === "function") {
      Promise.resolve(refreshData(true)).catch(err => console.error("100ms otomatik senkronizasyonu basarisiz", err));
    }
  }

  function scheduleForcedSync(delay = 100) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(forceSyncWhenIdle, delay);
  }

  updateOrder = async function (...args) {
    // Ekstra senkronizasyon sayaci artik aksiyon basinda degil, Supabase yazma ve
    // updateOrder icindeki ilk veri yenilemesi tamamen bittikten sonra baslar.
    try {
      return await baseUpdateOrder.apply(this, args);
    } finally {
      scheduleForcedSync(100);
    }
  };

  // Ilk Depo Akisi <-> Onay Sonrasi Depo ve diger ekran gecislerinde yeni ekran
  // acildiktan 100 ms sonra veriyi tekrar Supabase'den dogrula.
  document.addEventListener("click", event => {
    const tabOrView = event.target.closest?.("[data-wh-tab], .nav-btn[data-view]");
    if (!tabOrView) return;
    scheduleForcedSync(100);
  });

  // Pazarlama / Depo / Operasyon / Sevkiyat bolum degisiminde de 100 ms korumasi.
  document.getElementById("roleSelect")?.addEventListener("change", () => scheduleForcedSync(100));
})();
