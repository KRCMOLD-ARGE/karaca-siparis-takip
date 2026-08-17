(() => {
  // Siparis aksiyonlarinda kayit islemi tamamen bittikten 100 ms sonra,
  // diger anlamli ekran/sekme/filtre/personel/buton etkileşimlerinde ise
  // etkileşimden 100 ms sonra zorunlu veri senkronizasyonu yap.
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

  // Veri yazan siparis aksiyonlarinda ikinci kontrolu, yazma ve ilk yenileme
  // tamamen bittikten sonra baslat. Boylece 100 ms kontrolu kayittan once kosmaz.
  updateOrder = async function (...args) {
    try {
      return await baseUpdateOrder.apply(this, args);
    } finally {
      scheduleForcedSync(100);
    }
  };

  // Uygulamadaki anlamli buton ve ekran gecislerini tek standarda bagla:
  // Ilk Depo / Onay Sonrasi, sol menu, Yenile, Temizle, Detay, dialog butonlari,
  // claim/send/approve/ship gibi butonlar dahil tum button tiklamalari.
  document.addEventListener("click", event => {
    const control = event.target.closest?.("button, [data-wh-tab], .nav-btn[data-view]");
    if (!control) return;
    scheduleForcedSync(100);
  });

  // Bolum, personel, durum filtresi, depo sorumlusu, depo durumlari ve formdaki
  // select/checkbox/radio degisimlerinde de ayni 100 ms standardini uygula.
  document.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.matches("select, input[type='checkbox'], input[type='radio']")) return;
    scheduleForcedSync(100);
  });

  // Arama kutusu yalnizca yerel filtreleme yaptigi icin her tus vurusunda Supabase
  // okumasi baslatmiyoruz; aksi halde hizlandirmak yerine gereksiz trafik olusur.
})();
