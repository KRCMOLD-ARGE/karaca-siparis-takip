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

  // Onay Sonrasi Depo'da artik Yeni Onayli / Yuruyen ayrimi yok.
  // warehouse-groups.js kartlari iki bolume ayirmis olsa bile burada tekrar tek
  // normal kart gridine topluyoruz. Ilk Depo gruplamasi aynen korunur.
  function flattenSecondWarehouse() {
    if (typeof role === "undefined" || role !== "warehouse") return;
    if (typeof whTab === "undefined" || whTab !== "second") return;

    const container = document.getElementById("workCards");
    if (!container) return;

    const sections = [...container.querySelectorAll(":scope > .warehouse-order-section")];
    if (!sections.length) {
      container.classList.remove("warehouse-grouped");
      return;
    }

    const cards = sections.flatMap(section =>
      [...section.querySelectorAll(":scope > .warehouse-order-grid > .order-card")]
    );

    container.innerHTML = "";
    cards.forEach(card => container.appendChild(card));
    container.classList.remove("warehouse-grouped");
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

  // Tum render zinciri bittikten sonra ikinci Depo sekmesini tek kart alanina cevir.
  if (typeof render === "function") {
    const baseRender = render;
    render = function (...args) {
      const result = baseRender.apply(this, args);
      flattenSecondWarehouse();
      return result;
    };
  }

  // Uygulamadaki anlamli buton ve ekran gecislerini tek standarda bagla:
  // Ilk Depo / Onay Sonrasi, sol menu, Yenile, Temizle, Detay, dialog butonlari,
  // claim/send/approve/ship gibi butonlar dahil tum button tiklamalari.
  document.addEventListener("click", event => {
    const control = event.target.closest?.("button, [data-wh-tab], .nav-btn[data-view]");
    if (!control) return;
    scheduleForcedSync(100);

    // warehouse-groups.js sekme tiklamasinda kendi gruplamasini setTimeout(0) ile
    // tekrar calistiriyor. Biz daha sonra yuklendigimiz icin bu callback onun
    // arkasindan calisir ve Onay Sonrasi Depo'yu yeniden tek alana toplar.
    if (control.matches?.("[data-wh-tab]")) {
      setTimeout(flattenSecondWarehouse, 0);
    }
  });

  // Bolum, personel, durum filtresi, depo sorumlusu, depo durumlari ve formdaki
  // select/checkbox/radio degisimlerinde de ayni 100 ms standardini uygula.
  document.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.matches("select, input[type='checkbox'], input[type='radio']")) return;
    scheduleForcedSync(100);
  });

  // Ilk yuklemede kullanici Onay Sonrasi Depo'daysa gruplari hemen duzlestir.
  setTimeout(flattenSecondWarehouse, 0);

  // Arama kutusu yalnizca yerel filtreleme yaptigi icin her tus vurusunda Supabase
  // okumasi baslatmiyoruz; aksi halde hizlandirmak yerine gereksiz trafik olusur.
})();
