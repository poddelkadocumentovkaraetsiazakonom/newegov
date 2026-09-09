let qrInterval = null;

const STORAGE_KEY_IMG = "egov_user_doc_img";
const STORAGE_KEY_DATA = "egov_user_doc_data";

document.addEventListener("DOMContentLoaded", function() {

  const tabDoc = document.getElementById("tabDoc");
  const tabReq = document.getElementById("tabReq");
  const documentSection = document.getElementById("documentSection");
  const requisitesSection = document.getElementById("requisitesSection");
  const openBtn = document.getElementById("openAccessBtn");
  const fileInput = document.getElementById("fileInput");
  const img = document.getElementById("zoomImage");
  const editReqModal = document.getElementById("editReqModal");
  const reqForm = document.getElementById("reqForm");
  const clearDataBtn = document.getElementById("clearDataBtn");

  // Загружаем ранее сохраненные данные
  loadStoredData();

  // === Вкладки ===
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

  // === ВЫБОР И ЧТЕНИЕ ФОТОГРАФИИ ===
  if (fileInput) {
    fileInput.addEventListener("change", function(e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          const base64Image = evt.target.result;
          if (img) {
            img.src = base64Image;
          }
          try {
            localStorage.setItem(STORAGE_KEY_IMG, base64Image);
          } catch (err) {
            // Если localStorage переполнен большим файлом
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // === РЕДАКТИРОВАНИЕ И СОХРАНЕНИЕ РЕКВИЗИТОВ ===
  if (requisitesSection && editReqModal) {
    requisitesSection.addEventListener("click", function() {
      openReqModal();
    });

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

  // === Открытие QR ===
  if (openBtn) {
    openBtn.addEventListener("click", showQR);
  }

  // === Свайп вниз для закрытия шторки ===
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
  // === PINCH & PAN ZOOM ДЛЯ КАРТОЧКИ ===
  // ==========================================

  const container = document.getElementById("zoomContainer");

  if (img && container) {
    let scale = 1;
    let lastScale = 1;
    let startDistance = 0;
    let translateX = 0;
    let translateY = 0;
    let startX = 0;
    let startY = 0;
    let lastTap = 0;

    function getDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function updateTransform() {
      if (scale > 1) {
        img.style.borderRadius = "0px";
      } else {
        img.style.borderRadius = "16px";
      }
      img.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    }

    function limitBounds() {
      if (scale <= 1) {
        translateX = 0;
        translateY = 0;
        return;
      }

      const rect = container.getBoundingClientRect();
      const imgWidth = rect.width * scale;
      const imgHeight = (img.offsetHeight || 250) * scale;

      const maxX = Math.max(0, (imgWidth - rect.width) / 2);
      const maxY = Math.max(0, (imgHeight - rect.height) / 2);

      translateX = Math.max(-maxX, Math.min(maxX, translateX));
      translateY = Math.max(-maxY, Math.min(maxY, translateY));
    }

    // Двойной тап для приближения
    img.addEventListener("touchstart", (e) => {
      const now = Date.now();
      if (e.touches.length === 1 && now - lastTap < 300) {
        if (scale > 1) {
          scale = 1;
          translateX = 0;
          translateY = 0;
        } else {
          scale = 2.4;
        }
        img.style.transition = "transform 0.25s ease-out, border-radius 0.25s ease-out";
        updateTransform();
        setTimeout(() => { img.style.transition = "none"; }, 250);
      }
      lastTap = now;

      if (e.touches.length === 2) {
        startDistance = getDistance(e.touches);
        lastScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    }, { passive: true });

    img.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const newDistance = getDistance(e.touches);
        scale = lastScale * (newDistance / startDistance);
        scale = Math.max(1, Math.min(scale, 4));
        limitBounds();
        updateTransform();
      } else if (e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        limitBounds();
        updateTransform();
      }
    }, { passive: false });

    img.addEventListener("touchend", () => {
      if (scale < 1) {
        scale = 1;
        translateX = 0;
        translateY = 0;
        img.style.transition = "transform 0.2s ease, border-radius 0.2s ease";
        updateTransform();
        setTimeout(() => { img.style.transition = "none"; }, 200);
      } else {
        limitBounds();
        updateTransform();
      }
    });
  }

});

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ХРАНИЛИЩА ===

function loadStoredData() {
  const storedImg = localStorage.getItem(STORAGE_KEY_IMG);
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

function clearAllData() {
  localStorage.removeItem(STORAGE_KEY_IMG);
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
    new QRCode(qrContainer, {
      text: randomCode.toString(),
      width: 200,
      height: 200
    });
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
