document.addEventListener("DOMContentLoaded", () => {
  // State - biến toàn cục
  let isStarted = false;
  let proxyKey = "";
  let rotationTime = 60;
  let autoAssign = true;
  let isActive = false;
  let isp = "random"; // Nhà mạng mặc định
  let province = "random"; // Tỉnh thành mặc định
  let currentProxyInfo = "[Chưa kết nối]"; // Thông tin proxy hiện tại
  let isFullPage = false; // Kiểm tra nếu extension đang mở trong tab đầy đủ
  let isLoading = false; // Trạng thái đang tải proxy
  let proxyType = "http"; // Loại proxy mặc định
  let proxyData = null; // Dữ liệu proxy đầy đủ từ API

  // Kiểm tra nếu extension đang mở trong tab đầy đủ
  checkIfFullPage();

  // Khởi tạo giao diện
  const root = document.getElementById("root");
  renderUI();

  // Thiết lập lắng nghe thông báo từ background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "proxyUpdated") {
      // Cập nhật thông tin proxy hiện tại
      currentProxyInfo = message.proxyInfo || "[Chưa kết nối]";
      proxyData = message.proxyData || null;

      // Render lại UI để hiển thị thông tin mới
      renderUI();

      sendResponse({ success: true });
      return true;
    }
    return false;
  });

  // Kiểm tra nếu đang mở trong tab đầy đủ
  function checkIfFullPage() {
    // Nếu popup thì cửa sổ sẽ có chiều rộng nhỏ (thường < 600px)
    // Trong tab đầy đủ, cửa sổ sẽ rộng hơn nhiều
    isFullPage = window.innerWidth > 600;

    // Nếu đang ở fullpage, tự động chuyển sang giao diện chính
    if (isFullPage && !isStarted) {
      isStarted = true;
    }
  }

  // Hàm render giao diện
  function renderUI() {
    root.innerHTML = `
      <div class="extension-container">
        <canvas id="extension-canvas"></canvas>
        
        ${!isStarted ? renderIntroUI() : renderMainUI()}
      </div>
    `;

    // Thêm event listeners sau khi render
    setupEventListeners();

    // Khởi tạo canvas nếu đã render
    const canvas = document.getElementById("extension-canvas");
    if (canvas) {
      setupCanvas(canvas);
    }
  }

  // Hàm render giao diện giới thiệu
  function renderIntroUI() {
    return `
      <div class="intro-card">
        <div class="logo-container">
          <img src="logo.png" alt="HD FUTURETECH" class="logo" />
        </div>
        
        <div class="intro-content">
          <h2>Proxy Manager</h2>
          <p>Giải pháp quản lý proxy toàn diện</p>
          
          <div class="proxy-types">
            <div class="proxy-type">
              <div class="proxy-icon rotating">↻</div>
              <h3>Proxy Xoay</h3>
              <p>Tự động thay đổi IP theo thời gian</p>
            </div>
            
            <div class="proxy-type">
              <div class="proxy-icon">⚓</div>
              <h3>Proxy Tĩnh</h3>
              <p>IP ổn định, độ tin cậy cao</p>
            </div>
          </div>
          
          <div class="intro-actions">
            <button class="start-btn" id="start-btn">
              BẮT ĐẦU
            </button>
            <button class="website-btn" id="intro-website-btn">
              Truy cập Website
            </button>
          </div>
        </div>
        
        <div class="intro-footer">
          <p>© 2025 HD FUTURETECH</p>
        </div>
      </div>
    `;
  }

  // Hàm render giao diện chính
  function renderMainUI() {
    // Xử lý class cho trạng thái loading
    const toggleBtnClass = isLoading
      ? "toggle-btn loading"
      : `toggle-btn ${isActive ? "active" : ""}`;
    const toggleIconContent = isLoading ? "⟳" : isActive ? "●" : "○";
    const toggleTextContent = isLoading
      ? "ĐANG XỬ LÝ"
      : isActive
      ? "TẮT"
      : "BẬT";

    return `
      <div class="main-card">
        <div class="main-header">
          <div class="logo-small">
            <img src="logo.png" alt="HD FUTURETECH" />
            <h3>Proxy Manager</h3>
          </div>
          <div class="status-indicator ${
            isActive ? "status-active" : "status-inactive"
          }">
            ${isActive ? "✓ Đang chạy" : "✕ Đã dừng"}
          </div>
        </div>
        
        <div class="main-content">
          <div class="config-section">
            <div class="config-group">
              <label>Key Proxy Xoay:</label>
              <input 
                type="text"
                class="key-input" 
                id="proxy-key-input"
                placeholder="Nhập key proxy xoay của bạn..."
                value="${proxyKey}"
                ${isLoading ? "disabled" : ""}
              />
            </div>
            
            <div class="config-group">
              <label>Thông tin proxy hiện tại:</label>
              <div class="proxy-container">
                <input 
                  type="text"
                  class="key-input current-proxy ${
                    currentProxyInfo.includes("Lỗi") ? "error-proxy" : ""
                  }" 
                  id="current-proxy-info"
                  disabled
                  value="${currentProxyInfo}"
                />
                ${
                  isActive && proxyData
                    ? `
                  <button class="copy-btn" id="copy-proxy-btn" title="Sao chép proxy">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                  </button>
                  <div class="copy-success" id="copy-success">Đã sao chép!</div>
                `
                    : ""
                }
              </div>
            </div>
            
            <div class="config-row">
              <div class="config-group">
                <label>Thời gian tự xoay:</label>
                <div class="select-wrapper">
                  <select id="rotation-time" ${isLoading ? "disabled" : ""}>
                    <option value="30" ${
                      rotationTime == 30 ? "selected" : ""
                    }>30 giây</option>
                    <option value="60" ${
                      rotationTime == 60 ? "selected" : ""
                    }>60 giây</option>
                    <option value="120" ${
                      rotationTime == 120 ? "selected" : ""
                    }>120 giây</option>
                    <option value="300" ${
                      rotationTime == 300 ? "selected" : ""
                    }>5 phút</option>
                    <option value="600" ${
                      rotationTime == 600 ? "selected" : ""
                    }>10 phút</option>
                  </select>
                </div>
              </div>
              
              <div class="config-group">
                <label>Loại proxy:</label>
                <div class="select-wrapper">
                  <select id="proxy-type" ${isLoading ? "disabled" : ""}>
                    <option value="http" ${
                      proxyType === "http" ? "selected" : ""
                    }>HTTP</option>
                    <option value="socks5" ${
                      proxyType === "socks5" ? "selected" : ""
                    }>SOCKS5</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div class="config-row">
              <div class="config-group">
                <label>Nhà mạng:</label>
                <div class="select-wrapper">
                  <select id="isp-select" ${isLoading ? "disabled" : ""}>
                    <option value="random" ${
                      isp === "random" ? "selected" : ""
                    }>Random</option>
                    <option value="viettel" ${
                      isp === "viettel" ? "selected" : ""
                    }>Viettel</option>
                    <option value="fpt" ${
                      isp === "fpt" ? "selected" : ""
                    }>FPT</option>
                    <option value="vnpt" ${
                      isp === "vnpt" ? "selected" : ""
                    }>VNPT</option>
                  </select>
                </div>
              </div>
              
              <div class="config-group">
                <label>Tỉnh thành:</label>
                <div class="select-wrapper">
                  <select id="province-select" ${isLoading ? "disabled" : ""}>
                    <option value="random" ${
                      province === "random" ? "selected" : ""
                    }>Random</option>
                    <option value="hanoi" ${
                      province === "hanoi" ? "selected" : ""
                    }>Hà Nội</option>
                    <option value="hochiminh" ${
                      province === "hochiminh" ? "selected" : ""
                    }>TP Hồ Chí Minh</option>
                    <option value="angiang" ${
                      province === "angiang" ? "selected" : ""
                    }>An Giang</option>
                    <option value="bacgiang" ${
                      province === "bacgiang" ? "selected" : ""
                    }>Bắc Giang</option>
                    <option value="backan" ${
                      province === "backan" ? "selected" : ""
                    }>Bắc Kạn</option>
                    <option value="baclieu" ${
                      province === "baclieu" ? "selected" : ""
                    }>Bạc Liêu</option>
                    <option value="bacninh" ${
                      province === "bacninh" ? "selected" : ""
                    }>Bắc Ninh</option>
                    <option value="bariavungtau" ${
                      province === "bariavungtau" ? "selected" : ""
                    }>Bà Rịa - Vũng Tàu</option>
                    <option value="bentre" ${
                      province === "bentre" ? "selected" : ""
                    }>Bến Tre</option>
                    <option value="binhdinh" ${
                      province === "binhdinh" ? "selected" : ""
                    }>Bình Định</option>
                    <option value="binhduong" ${
                      province === "binhduong" ? "selected" : ""
                    }>Bình Dương</option>
                    <option value="binhphuoc" ${
                      province === "binhphuoc" ? "selected" : ""
                    }>Bình Phước</option>
                    <option value="binhthuan" ${
                      province === "binhthuan" ? "selected" : ""
                    }>Bình Thuận</option>
                    <option value="camau" ${
                      province === "camau" ? "selected" : ""
                    }>Cà Mau</option>
                    <option value="cantho" ${
                      province === "cantho" ? "selected" : ""
                    }>Cần Thơ</option>
                    <option value="caobang" ${
                      province === "caobang" ? "selected" : ""
                    }>Cao Bằng</option>
                    <option value="daklak" ${
                      province === "daklak" ? "selected" : ""
                    }>Đắk Lắk</option>
                    <option value="daknong" ${
                      province === "daknong" ? "selected" : ""
                    }>Đắk Nông</option>
                    <option value="danang" ${
                      province === "danang" ? "selected" : ""
                    }>Đà Nẵng</option>
                    <option value="dienbien" ${
                      province === "dienbien" ? "selected" : ""
                    }>Điện Biên</option>
                    <option value="dongnai" ${
                      province === "dongnai" ? "selected" : ""
                    }>Đồng Nai</option>
                    <option value="dongthap" ${
                      province === "dongthap" ? "selected" : ""
                    }>Đồng Tháp</option>
                    <option value="gialai" ${
                      province === "gialai" ? "selected" : ""
                    }>Gia Lai</option>
                    <option value="hagiang" ${
                      province === "hagiang" ? "selected" : ""
                    }>Hà Giang</option>
                    <option value="hanam" ${
                      province === "hanam" ? "selected" : ""
                    }>Hà Nam</option>
                    <option value="hatinh" ${
                      province === "hatinh" ? "selected" : ""
                    }>Hà Tĩnh</option>
                    <option value="haiduong" ${
                      province === "haiduong" ? "selected" : ""
                    }>Hải Dương</option>
                    <option value="haiphong" ${
                      province === "haiphong" ? "selected" : ""
                    }>Hải Phòng</option>
                    <option value="haugiang" ${
                      province === "haugiang" ? "selected" : ""
                    }>Hậu Giang</option>
                    <option value="hoabinh" ${
                      province === "hoabinh" ? "selected" : ""
                    }>Hòa Bình</option>
                    <option value="hungyen" ${
                      province === "hungyen" ? "selected" : ""
                    }>Hưng Yên</option>
                    <option value="khanhhoa" ${
                      province === "khanhhoa" ? "selected" : ""
                    }>Khánh Hòa</option>
                    <option value="kiengiang" ${
                      province === "kiengiang" ? "selected" : ""
                    }>Kiên Giang</option>
                    <option value="kontum" ${
                      province === "kontum" ? "selected" : ""
                    }>Kon Tum</option>
                    <option value="laichau" ${
                      province === "laichau" ? "selected" : ""
                    }>Lai Châu</option>
                    <option value="lamdong" ${
                      province === "lamdong" ? "selected" : ""
                    }>Lâm Đồng</option>
                    <option value="langson" ${
                      province === "langson" ? "selected" : ""
                    }>Lạng Sơn</option>
                    <option value="laocai" ${
                      province === "laocai" ? "selected" : ""
                    }>Lào Cai</option>
                    <option value="longan" ${
                      province === "longan" ? "selected" : ""
                    }>Long An</option>
                    <option value="namdinh" ${
                      province === "namdinh" ? "selected" : ""
                    }>Nam Định</option>
                    <option value="nghean" ${
                      province === "nghean" ? "selected" : ""
                    }>Nghệ An</option>
                    <option value="ninhbinh" ${
                      province === "ninhbinh" ? "selected" : ""
                    }>Ninh Bình</option>
                    <option value="ninhthuan" ${
                      province === "ninhthuan" ? "selected" : ""
                    }>Ninh Thuận</option>
                    <option value="phutho" ${
                      province === "phutho" ? "selected" : ""
                    }>Phú Thọ</option>
                    <option value="phuyen" ${
                      province === "phuyen" ? "selected" : ""
                    }>Phú Yên</option>
                    <option value="quangbinh" ${
                      province === "quangbinh" ? "selected" : ""
                    }>Quảng Bình</option>
                    <option value="quangnam" ${
                      province === "quangnam" ? "selected" : ""
                    }>Quảng Nam</option>
                    <option value="quangngai" ${
                      province === "quangngai" ? "selected" : ""
                    }>Quảng Ngãi</option>
                    <option value="quangninh" ${
                      province === "quangninh" ? "selected" : ""
                    }>Quảng Ninh</option>
                    <option value="quangtri" ${
                      province === "quangtri" ? "selected" : ""
                    }>Quảng Trị</option>
                    <option value="soctrang" ${
                      province === "soctrang" ? "selected" : ""
                    }>Sóc Trăng</option>
                    <option value="sonla" ${
                      province === "sonla" ? "selected" : ""
                    }>Sơn La</option>
                    <option value="tayninh" ${
                      province === "tayninh" ? "selected" : ""
                    }>Tây Ninh</option>
                    <option value="thaibinh" ${
                      province === "thaibinh" ? "selected" : ""
                    }>Thái Bình</option>
                    <option value="thainguyen" ${
                      province === "thainguyen" ? "selected" : ""
                    }>Thái Nguyên</option>
                    <option value="thanhhoa" ${
                      province === "thanhhoa" ? "selected" : ""
                    }>Thanh Hóa</option>
                    <option value="thuathienhue" ${
                      province === "thuathienhue" ? "selected" : ""
                    }>Thừa Thiên Huế</option>
                    <option value="tiengiang" ${
                      province === "tiengiang" ? "selected" : ""
                    }>Tiền Giang</option>
                    <option value="travinh" ${
                      province === "travinh" ? "selected" : ""
                    }>Trà Vinh</option>
                    <option value="tuyenquang" ${
                      province === "tuyenquang" ? "selected" : ""
                    }>Tuyên Quang</option>
                    <option value="vinhlong" ${
                      province === "vinhlong" ? "selected" : ""
                    }>Vĩnh Long</option>
                    <option value="vinhphuc" ${
                      province === "vinhphuc" ? "selected" : ""
                    }>Vĩnh Phúc</option>
                    <option value="yenbai" ${
                      province === "yenbai" ? "selected" : ""
                    }>Yên Bái</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div class="checkbox-group">
              <input 
                type="checkbox" 
                id="auto-assign" 
                ${autoAssign ? "checked" : ""}
                ${isLoading ? "disabled" : ""}
              />
              <label for="auto-assign">Tự động gán proxy mới</label>
            </div>
            
            <div class="config-actions">
              <button class="save-btn" id="save-config-btn" ${
                isLoading ? "disabled" : ""
              }>
                Lưu cấu hình
              </button>
              <button class="open-btn" id="open-extension-btn" ${
                isLoading ? "disabled" : ""
              }>
                <span class="open-icon">↗</span> Mở rộng
              </button>
            </div>
          </div>
          
          <div class="toggle-container">
            <button class="${toggleBtnClass}" id="toggle-btn" ${
      isLoading ? "disabled" : ""
    }>
              <span class="toggle-icon ${
                isLoading ? "loading-icon" : ""
              }">${toggleIconContent}</span>
              <span class="toggle-text">${toggleTextContent}</span>
            </button>
          </div>
        </div>
        
        <div class="main-footer">
          <p>© 2025 HD FUTURETECH</p>
          <button class="website-link" id="main-website-btn">
            hdfuturetech.com
          </button>
        </div>
      </div>
    `;
  }

  // Thiết lập event listeners
  function setupEventListeners() {
    if (!isStarted) {
      // Event listeners cho màn hình intro
      const startBtn = document.getElementById("start-btn");
      const introWebsiteBtn = document.getElementById("intro-website-btn");

      if (startBtn) {
        startBtn.addEventListener("click", handleStart);
      }

      if (introWebsiteBtn) {
        introWebsiteBtn.addEventListener("click", handleOpenWebsite);
      }
    } else {
      // Event listeners cho màn hình chính
      const proxyKeyInput = document.getElementById("proxy-key-input");
      const rotationTimeSelect = document.getElementById("rotation-time");
      const proxyTypeSelect = document.getElementById("proxy-type");
      const autoAssignCheckbox = document.getElementById("auto-assign");
      const ispSelect = document.getElementById("isp-select");
      const provinceSelect = document.getElementById("province-select");
      const saveConfigBtn = document.getElementById("save-config-btn");
      const toggleBtn = document.getElementById("toggle-btn");
      const mainWebsiteBtn = document.getElementById("main-website-btn");
      const openExtensionBtn = document.getElementById("open-extension-btn");
      const copyProxyBtn = document.getElementById("copy-proxy-btn");

      if (proxyKeyInput) {
        proxyKeyInput.addEventListener("input", (e) => {
          proxyKey = e.target.value;
        });
      }

      if (rotationTimeSelect) {
        rotationTimeSelect.addEventListener("change", (e) => {
          rotationTime = parseInt(e.target.value);
        });
      }

      if (proxyTypeSelect) {
        proxyTypeSelect.addEventListener("change", (e) => {
          proxyType = e.target.value;
        });
      }

      if (autoAssignCheckbox) {
        autoAssignCheckbox.addEventListener("change", (e) => {
          autoAssign = e.target.checked;
        });
      }

      if (ispSelect) {
        ispSelect.addEventListener("change", (e) => {
          isp = e.target.value;
        });
      }

      if (provinceSelect) {
        provinceSelect.addEventListener("change", (e) => {
          province = e.target.value;
        });
      }

      if (saveConfigBtn) {
        saveConfigBtn.addEventListener("click", handleSaveConfig);
      }

      if (toggleBtn) {
        toggleBtn.addEventListener("click", handleToggleActive);
      }

      if (mainWebsiteBtn) {
        mainWebsiteBtn.addEventListener("click", handleOpenWebsite);
      }

      if (openExtensionBtn) {
        openExtensionBtn.addEventListener("click", handleOpenExtension);
      }

      if (copyProxyBtn) {
        copyProxyBtn.addEventListener("click", handleCopyProxy);
      }
    }
  }

  // Xử lý sao chép proxy
  function handleCopyProxy() {
    if (!proxyData) return;

    // Chọn chuỗi proxy đúng loại
    let copyText = "";

    if (proxyType === "http" && proxyData.httpString) {
      copyText = proxyData.httpString;
    } else if (proxyType === "socks5" && proxyData.socks5String) {
      copyText = proxyData.socks5String;
    } else if (proxyData.host && proxyData.port) {
      // Fallback nếu không có chuỗi đầy đủ
      const auth =
        proxyData.username && proxyData.password
          ? `${proxyData.username}:${proxyData.password}@`
          : "";
      copyText = `${auth}${proxyData.host}:${proxyData.port}`;
    }

    if (copyText) {
      navigator.clipboard.writeText(copyText).then(() => {
        // Hiển thị thông báo đã copy
        const copySuccess = document.getElementById("copy-success");
        if (copySuccess) {
          copySuccess.classList.add("show");
          setTimeout(() => {
            copySuccess.classList.remove("show");
          }, 2000);
        }
      });
    }
  }

  // Thiết lập canvas
  function setupCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles = [];
    const particleCount = 40;

    // Tạo các điểm trong mạng lưới
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        vx: Math.random() * 1 - 0.5,
        vy: Math.random() * 1 - 0.5,
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particleCount; i++) {
        let p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = "rgba(173, 216, 230, 0.5)";
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx = -p.vx;
        if (p.y < 0 || p.y > canvas.height) p.vy = -p.vy;

        for (let j = i + 1; j < particleCount; j++) {
          let p2 = particles[j];
          let distance = Math.sqrt(
            Math.pow(p.x - p2.x, 2) + Math.pow(p.y - p2.y, 2)
          );

          if (distance < 70) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(173, 216, 230, ${1 - distance / 70})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    }

    animate();

    // Xử lý khi thay đổi kích thước
    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", handleResize);
  }

  // Xử lý nút bắt đầu
  function handleStart() {
    isStarted = true;
    renderUI();
  }

  // Xử lý lưu cấu hình
  function handleSaveConfig() {
    if (!proxyKey.trim()) {
      alert("Vui lòng nhập Key Proxy Xoay trước khi lưu cấu hình!");
      return;
    }

    // Hiển thị loading
    isLoading = true;
    renderUI();

    // Lưu cấu hình vào chrome.storage
    chrome.storage.sync.set(
      {
        proxyKey: proxyKey,
        rotationTime: rotationTime,
        proxyType: proxyType,
        autoAssign: autoAssign,
        isp: isp,
        province: province,
      },
      function () {
        isLoading = false;
        alert("Đã lưu cấu hình thành công!");
        renderUI();

        // Nếu đang active, thông báo cho background script về cấu hình mới
        // nhưng KHÔNG yêu cầu lấy proxy mới ngay lập tức
        if (isActive) {
          chrome.runtime.sendMessage({
            action: "updateConfig",
            proxyKey: proxyKey,
            rotationTime: rotationTime,
            proxyType: proxyType,
            autoAssign: autoAssign,
            isp: isp,
            province: province,
          });
        }
      }
    );
  }

  // Xử lý toggle trạng thái
  function handleToggleActive() {
    if (!proxyKey.trim()) {
      alert("Vui lòng nhập Key Proxy Xoay trước khi bật proxy!");
      return;
    }

    // Hiển thị loading
    isLoading = true;
    renderUI();

    // Đổi trạng thái
    const newActiveState = !isActive;

    // Gửi message đến background script để bật/tắt proxy
    chrome.runtime.sendMessage(
      {
        action: newActiveState ? "enableProxy" : "disableProxy",
        proxyKey: proxyKey,
        rotationTime: rotationTime,
        proxyType: proxyType,
        autoAssign: autoAssign,
        isp: isp,
        province: province,
      },
      function (response) {
        isLoading = false;

        if (response && response.success) {
          isActive = newActiveState;

          if (response.proxyInfo) {
            currentProxyInfo = response.proxyInfo;
          } else if (isActive) {
            currentProxyInfo = `${isp !== "random" ? isp + " - " : ""}${
              province !== "random" ? province : "IP ngẫu nhiên"
            }`;
          } else {
            currentProxyInfo = "[Chưa kết nối]";
          }

          if (response.proxyData) {
            proxyData = response.proxyData;
          }
        } else {
          // Nếu có lỗi, hiển thị thông báo
          alert(
            "Không thể " +
              (newActiveState ? "bật" : "tắt") +
              " proxy: " +
              (response?.error || "Lỗi không xác định")
          );
        }

        // Render lại UI để cập nhật trạng thái
        renderUI();
      }
    );
  }

  // Xử lý mở website
  function handleOpenWebsite() {
    chrome.tabs.create({ url: "https://hdfuturetech.com" });
  }

  // Xử lý mở extension trong tab mới
  function handleOpenExtension() {
    const extensionUrl = chrome.runtime.getURL("popup.html");
    chrome.tabs.create({ url: extensionUrl });
  }

  // Tải dữ liệu đã lưu từ chrome.storage khi mở extension
  chrome.storage.sync.get(
    [
      "proxyKey",
      "rotationTime",
      "proxyType",
      "autoAssign",
      "isActive",
      "isp",
      "province",
      "currentProxyInfo",
      "proxyData",
    ],
    function (result) {
      if (result.proxyKey) proxyKey = result.proxyKey;
      if (result.rotationTime) rotationTime = result.rotationTime;
      if (result.proxyType) proxyType = result.proxyType;
      if (result.autoAssign !== undefined) autoAssign = result.autoAssign;
      if (result.isActive !== undefined) isActive = result.isActive;
      if (result.isp) isp = result.isp;
      if (result.province) province = result.province;
      if (result.currentProxyInfo) currentProxyInfo = result.currentProxyInfo;
      if (result.proxyData) proxyData = result.proxyData;

      // Nếu proxy đang hoạt động nhưng không có thông tin, tạo thông tin mặc định
      if (isActive && currentProxyInfo === "[Chưa kết nối]") {
        currentProxyInfo = `${isp !== "random" ? isp + " - " : ""}${
          province !== "random" ? province : "IP ngẫu nhiên"
        }`;
      }

      // Render lại UI với dữ liệu đã tải
      renderUI();
    }
  );

  // Thêm sự kiện lắng nghe thay đổi kích thước cửa sổ
  window.addEventListener("resize", () => {
    checkIfFullPage();
    renderUI();
  });
});
