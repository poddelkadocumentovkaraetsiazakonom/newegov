let qrInterval = null;

const STORAGE_KEY_DATA = "egov_user_doc_data";
const DB_NAME = "eGovDocDB";
const STORE_NAME = "images";
const DB_KEY = "doc_image";

// === Простая асинхронная работа с IndexedDB ===
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveImageToDB(base64Data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(base64Data, DB_KEY);
    return tx.complete;
  } catch (err) {
    console.error("Error saving image to IndexedDB:", err);
  }
}

async function loadImageFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(DB_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

async function removeImageFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(DB_KEY);
  } catch (err) {}
}

// Оптимизация тяжелых фото с камеры iPhone перед сохранением
function compressImage(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener("DOMContentLoaded", function() {

  const tabDoc = document.getElementById("tabDoc");
  const tabReq = document.getElementById("tabReq");
  const documentSection = document.getElementById("documentSection");
  const requisitesSection = document.getElementById("requisitesSection");
  const openBtn = document.getElementById("openAccessBtn");
  const fileInput = document.getElementById("fileInput");
  const img = document.getElementById("zoomImage");
  const container = document.getElementById("zoomContainer");
  const editReqModal = document.getElementById("editReqModal");
  const reqForm = document.getElementById("reqForm");
  const clearDataBtn = document.getElementById("clearDataBtn");

  // Загрузка сохраненных данных
  loadStoredData();

  // === Переключение вкладок ===
  if (tabDoc && tabReq) {
    tabDoc.addEventListener("click", function() {
      documentSection.classList.remove("hidden");
      requisitesSection.classList.add("hidden");
      tabDoc.classList.add("active");
      tabReq.classList.remove("active");
    });

    tabReq.addEventListener("click", function() {
      documentSection.classList.add("hidden");
      requisitesSection.classList.remove("hidden");
      tabReq.classList.add("active");
      tabDoc.classList.remove("active");
    });
  }

  // === Загрузка изображения ===
  if (fileInput) {
    fileInput.addEventListener("change", async function(e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        try {
          const optimizedBase64 = await compressImage(file);
          if (img) img.src = optimizedBase64;
          await saveImageToDB(optimizedBase64);
        } catch (err) {
          console.error("Failed to process image:", err);
        }
      }
    });
  }

  // === Модальное окно реквизитов ===
  if (requisitesSection && editReqModal) {
    requisitesSection.addEventListener("click", openReqModal);

    editReqModal.addEventListener("click", function(e) {
      if (e.target === editReqModal) {
        editReqModal.classList.add("hidden");
      }
    });

    if (reqForm) {
      reqForm.addEventListener("submit", function(e) {
        e.preventDefault();
        saveReqData();
        editReqModal.classList.add("hidden");
      });
    }

    if (clearDataBtn) {
      clearDataBtn.addEventListener("click", function() {
        clearAllData();
        editReqModal.classList.add("hidden");
      });
    }
  }

  // === QR Модалка ===
  if (openBtn) {
    openBtn.addEventListener("click", showQR);
  }

  const qrModal = document.getElementById("qrModal");
  const qrSheet = qrModal ? qrModal.querySelector(".qr-sheet") : null;

  if (qrModal && qrSheet) {
    setupSheetSwipe(qrModal, qrSheet, closeQR);
  }
  
  if (editReqModal) {
    const editSheet = editReqModal.querySelector(".qr-sheet");
    if (editSheet) {
      setupSheetSwipe(editReqModal, editSheet, () => editReqModal.classList.add("hidden"));
    }
  }

  // ==========================================
  // === ОПТИМИЗИРОВАННЫЙ GPU ПИНЧ-ЗУМ ===
  // ==========================================

  if (img && container) {
    let scale = 1;
    let lastScale = 1;
    let startDistance = 0;
    let translateX = 0;
    let translateY = 0;
    let startX = 0;
    let startY = 0;
    let lastTap = 0;
    let isPinching = false;
    let touchMoved = false;
    let rafId = null;

    function getDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function renderTransform(animated = false) {
      if (animated) {
        img.style.transition = "transform 0.25s cubic-bezier(0.1, 0.8, 0.1, 1)";
      } else {
        img.style.transition = "none";
      }
      
      img.style.transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
      
      if (scale > 1.05) {
        img.style.borderRadius = "0px";
      } else {
        img.style.borderRadius = "16px";
      }
    }

    function requestRender(animated = false) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => renderTransform(animated));
    }

    function limitBounds() {
      if (scale <= 1) {
        translateX = 0;
        translateY = 0;
        return;
      }

      const rect = container.getBoundingClientRect();
      const imgW = rect.width * scale;
      const imgH = (img.offsetHeight || 220) * scale;

      const maxX = Math.max(0, (imgW - rect.width) / 2);
      const maxY = Math.max(0, (imgH - rect.height) / 2);

      translateX = Math.max(-maxX, Math.min(maxX, translateX));
      translateY = Math.max(-maxY, Math.min(maxY, translateY));
    }

    container.addEventListener("touchstart", (e) => {
      const now = Date.now();
      touchMoved = false;

      // Двойной тап для быстрого зума
      if (e.touches.length === 1 && now - lastTap < 280) {
        if (scale > 1.1) {
          scale = 1;
          translateX = 0;
          translateY = 0;
        } else {
          scale = 2.5;
        }
        requestRender(true);
        lastTap = 0;
        return;
      }
      lastTap = now;

      if (e.touches.length === 2) {
        isPinching = true;
        startDistance = getDistance(e.touches);
        lastScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
      touchMoved = true;
      if (e.touches.length === 2 && isPinching) {
        if (e.cancelable) e.preventDefault();
        const dist = getDistance(e.touches);
        if (startDistance > 0) {
          scale = lastScale * (dist / startDistance);
          scale = Math.max(0.9, Math.min(scale, 4.5));
          limitBounds();
          requestRender(false);
        }
      } else if (e.touches.length === 1 && scale > 1.05 && !isPinching) {
        if (e.cancelable) e.preventDefault();
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        limitBounds();
        requestRender(false);
      }
    }, { passive: false });

    container.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }

      if (scale < 1) {
        scale = 1;
        translateX = 0;
        translateY = 0;
        requestRender(true);
      } else if (scale > 4) {
        scale = 4;
        limitBounds();
        requestRender(true);
      } else {
        limitBounds();
        requestRender(true);
      }
    });
  }

});

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ХРАНИЛИЩА ===

async function loadStoredData() {
  const storedImg = await loadImageFromDB();
  if (storedImg) {
    const img = document.getElementById("zoomImage");
    if (img) img.src = storedImg;
  }

  const rawData = localStorage.getItem(STORAGE_KEY_DATA);
  if (rawData) {
    try {
      const data = JSON.parse(rawData);
      applyDataToUI(data);
    } catch(e) {}
  }
}

function applyDataToUI(data) {
  const fields = ['fullname', 'iin', 'dob', 'docnum', 'issuedate', 'expdate', 'issuer', 'nationality'];
  fields.forEach(f => {
    const el = document.getElementById(`val-${f}`);
    if (el) el.innerText = data[f] && data[f].trim() !== '' ? data[f] : '—';
  });
}

function openReqModal() {
  const modal = document.getElementById("editReqModal");
  if (!modal) return;
  
  const rawData = localStorage.getItem(STORAGE_KEY_DATA);
  const data = rawData ? JSON.parse(rawData) : {};

  const fields = ['fullname', 'iin', 'dob', 'docnum', 'issuedate', 'expdate', 'issuer', 'nationality'];
  fields.forEach(f => {
    const input = document.getElementById(`in-${f}`);
    if (input) input.value = data[f] || '';
  });

  modal.classList.remove("hidden");
}

function saveReqData() {
  const fields = ['fullname', 'iin', 'dob', 'docnum', 'issuedate', 'expdate', 'issuer', 'nationality'];
  const data = {};
  
  fields.forEach(f => {
    const input = document.getElementById(`in-${f}`);
    if (input) data[f] = input.value;
  });

  localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
  applyDataToUI(data);
}

async function clearAllData() {
  await removeImageFromDB();
  localStorage.removeItem(STORAGE_KEY_DATA);

  const img = document.getElementById("zoomImage");
  if (img) {
    img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='190' viewBox='0 0 300 190'><rect width='100%' height='100%' fill='%23f2f2f7'/><text x='50%' y='50%' font-family='sans-serif' font-size='14' fill='%238e8e93' text-anchor='middle' dy='.3em'>Нажмите для выбора фото</text></svg>";
  }

  applyDataToUI({});
}

function setupSheetSwipe(modal, sheet, closeFn) {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  sheet.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    isDragging = true;
    sheet.style.transition = "none";
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    let diff = currentY - startY;
    if (diff > 0) {
      sheet.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  sheet.addEventListener("touchend", () => {
    if (!isDragging) return;
    let diff = currentY - startY;
    sheet.style.transition = "transform 0.25s cubic-bezier(0.1, 0.8, 0.1, 1)";
    if (diff > 100) {
      closeFn();
    } else {
      sheet.style.transform = "translateY(0)";
    }
    isDragging = false;
  });
}

// === QR Функции ===
function showQR() {
  const modal = document.getElementById("qrModal");
  const sheet = modal ? modal.querySelector(".qr-sheet") : null;
  
  if (sheet) sheet.style.transform = "translateY(0)";
  if (modal) modal.classList.remove("hidden");

  if (qrInterval) clearInterval(qrInterval);

  const randomCode = Math.floor(100000 + Math.random() * 900000);
  const codeEl = document.getElementById("shortCode");
  if (codeEl) codeEl.innerText = randomCode;

  const qrContainer = document.getElementById("qrcode");
  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrContainer, {
        text: randomCode.toString(),
        width: 200,
        height: 200
      });
    }
  }

  let time = 60;
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.innerText = "Срок действия: 01:00";

  qrInterval = setInterval(() => {
    time--;
    let seconds = time < 10 ? "0" + time : time;
    if (timerEl) timerEl.innerText = "Срок действия: 00:" + seconds;
    if (time <= 0) closeQR();
  }, 1000);
}

function closeQR() {
  const modal = document.getElementById("qrModal");
  if (qrInterval) clearInterval(qrInterval);
  if (modal) modal.classList.add("hidden");
}
