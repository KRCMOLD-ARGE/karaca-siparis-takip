(() => {
  // Her sipariş aksiyonundan yaklaşık 500 ms sonra bir kez daha zorunlu veri
  // senkronizasyonu yap. İlk hızlı render yine updateOrder içinde gerçekleşir;
  // bu ikinci tur, ekranda eski durum kalması / gecikmeli grup-sayaç güncellenmesi
  // gibi yarış durumlarını temizlemek için güvenlik ağıdır.
  if (typeof updateOrder !== "function") return;

  const baseUpdateOrder = updateOrder;
  let syncTimer = null;

  function forceSyncWhenIdle() {
    if (typeof accessCode === "undefined" || !accessCode) return;

    // O anda başka bir veri yenilemesi çalışıyorsa onun bitmesini bekle. Böylece
    // iki Supabase okuması aynı anda render etmeye çalışmaz.
    if (typeof refreshing !== "undefined" && refreshing) {
      syncTimer = setTimeout(forceSyncWhenIdle, 100);
      return;
    }

    if (typeof refreshData === "function") {
      Promise.resolve(refreshData(true)).catch(err => console.error("500ms otomatik senkronizasyonu başarısız", err));
    }
  }

  function scheduleForcedSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(forceSyncWhenIdle, 500);
  }

  updateOrder = function (...args) {
    // Sayaç aksiyon anında başlar. 500 ms geldiğinde kayıt/yenileme hâlâ sürüyorsa
    // forceSyncWhenIdle mevcut işlemin bitmesini bekleyip hemen ardından çalışır.
    const result = baseUpdateOrder.apply(this, args);
    scheduleForcedSync();
    return result;
  };
})();
