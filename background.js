// Import các constant từ config
import { API_BASE_URL, API_KEY } from "./config.js";

// Biến lưu trữ thông tin proxy và timer
let proxyInfo = {
  proxyKey: "",
  rotationTime: 60,
  autoAssign: true,
  isActive: false,
  rotationTimer: null,
  isp: "random",
  province: "random",
  proxyType: "http",
  currentProxyInfo: "[Chưa kết nối]",
  nextRotationTime: null, // Thời gian cho lần xoay tiếp theo
  proxyData: null, // Dữ liệu đầy đủ của proxy
};

// Xử lý khi nhận message từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "enableProxy") {
    // Lưu thông tin proxy
    proxyInfo.proxyKey = message.proxyKey;
    proxyInfo.rotationTime = message.rotationTime;
    proxyInfo.autoAssign = message.autoAssign;
    proxyInfo.isActive = true;
    proxyInfo.isp = message.isp || "random";
    proxyInfo.province = message.province || "random";
    proxyInfo.proxyType = message.proxyType || "http";
    proxyInfo.nextRotationTime = null; // Reset thời gian xoay tiếp theo

    // Lưu trạng thái active vào storage
    chrome.storage.sync.set({ isActive: true });

    // Lấy proxy mới từ API và kích hoạt
    fetchAndApplyProxy()
      .then((proxyData) => {
        // Bắt đầu xoay proxy nếu autoAssign được bật
        if (proxyInfo.autoAssign) {
          startProxyRotation();
        }

        sendResponse({
          success: true,
          proxyInfo: proxyInfo.currentProxyInfo,
          proxyData: proxyInfo.proxyData,
        });
      })
      .catch((error) => {
        console.error("Lỗi khi lấy proxy:", error);
        proxyInfo.currentProxyInfo = "Lỗi kết nối proxy: " + error.message;
        proxyInfo.proxyData = null;

        // Lưu trạng thái lỗi
        chrome.storage.sync.set({
          currentProxyInfo: proxyInfo.currentProxyInfo,
          proxyData: null,
        });

        sendResponse({
          success: false,
          proxyInfo: proxyInfo.currentProxyInfo,
          error: error.message,
        });
      });

    return true;
  } else if (message.action === "disableProxy") {
    // Cập nhật trạng thái
    proxyInfo.isActive = false;
    proxyInfo.currentProxyInfo = "[Chưa kết nối]";
    proxyInfo.nextRotationTime = null; // Reset thời gian xoay tiếp theo
    proxyInfo.proxyData = null;

    // Lưu trạng thái active vào storage
    chrome.storage.sync.set({
      isActive: false,
      currentProxyInfo: proxyInfo.currentProxyInfo,
      proxyData: null,
    });

    // Tắt proxy
    disableProxy();

    // Dừng xoay proxy
    stopProxyRotation();

    sendResponse({
      success: true,
      proxyInfo: proxyInfo.currentProxyInfo,
    });
    return true;
  } else if (message.action === "updateConfig") {
    // Cập nhật cấu hình mà không lấy proxy mới ngay lập tức
    proxyInfo.proxyKey = message.proxyKey;
    proxyInfo.rotationTime = message.rotationTime;
    proxyInfo.autoAssign = message.autoAssign;
    proxyInfo.isp = message.isp || "random";
    proxyInfo.province = message.province || "random";
    proxyInfo.proxyType = message.proxyType || "http";

    // Nếu đang bật timer, hãy khởi động lại nó với thời gian mới
    if (proxyInfo.isActive && proxyInfo.autoAssign) {
      startProxyRotation();
    }

    return true;
  }

  return false;
});

// Hàm lấy proxy từ API và áp dụng
async function fetchAndApplyProxy() {
  if (!proxyInfo.proxyKey || !proxyInfo.isActive) {
    console.log("Không thể lấy proxy: Key không hợp lệ hoặc trạng thái đã tắt");
    return null;
  }

  try {
    // Chuẩn bị tham số cho API
    const keyxoay = proxyInfo.proxyKey;
    const nhamang = proxyInfo.isp !== "random" ? proxyInfo.isp : "";
    const tinhtp = proxyInfo.province !== "random" ? proxyInfo.province : "";

    // Xây dựng URL với tham số query
    let apiUrl = `${API_BASE_URL}/proxies/extension/get-proxy-by-key?keyxoay=${encodeURIComponent(
      keyxoay
    )}`;
    if (nhamang) apiUrl += `&nhamang=${encodeURIComponent(nhamang)}`;

    console.log("Đang gọi API lấy proxy mới...");
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API trả về lỗi (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("Dữ liệu proxy từ API:", data);

    if (!data || !data.status || !data.data) {
      throw new Error("API không trả về thông tin hợp lệ");
    }

    // Kiểm tra trạng thái phản hồi
    if (data.data.status === 101) {
      // Trạng thái 101: Chưa đến thời gian xoay proxy
      const message = data.data.message || "";

      // Trích xuất thời gian còn lại từ thông báo
      const timeLeftMatch = message.match(/Con (\d+)s/);
      if (timeLeftMatch && timeLeftMatch[1]) {
        const timeLeftSeconds = parseInt(timeLeftMatch[1], 10);

        // Lưu thời gian cho lần xoay tiếp theo
        proxyInfo.nextRotationTime = Date.now() + timeLeftSeconds * 1000;

        // Cập nhật thông tin hiển thị
        const waitTime = new Date(
          proxyInfo.nextRotationTime
        ).toLocaleTimeString();
        proxyInfo.currentProxyInfo = `Đang chờ đến ${waitTime} để xoay proxy...`;

        // Lưu trạng thái vào storage
        chrome.storage.sync.set({
          currentProxyInfo: proxyInfo.currentProxyInfo,
        });

        // Thông báo cho popup về cập nhật
        notifyPopupProxyUpdated();

        console.log(
          `Chưa đến thời gian xoay proxy, còn ${timeLeftSeconds} giây`
        );

        // Không ném lỗi, chỉ trả về null để biết là chưa đến thời gian
        return null;
      }

      throw new Error("Chưa đến thời gian xoay proxy: " + message);
    }

    if (data.data.status === 100) {
      // Trạng thái 100: Thành công, có thông tin proxy
      // Kiểm tra dữ liệu API
      if (data.data.proxyhttp && data.data.proxysocks5) {
        // Lưu chuỗi proxy đầy đủ
        const httpString = data.data.proxyhttp;
        const socks5String = data.data.proxysocks5;

        // Chọn proxy dựa vào loại proxy người dùng chọn
        const proxyString =
          proxyInfo.proxyType === "http" ? httpString : socks5String;

        // Phân tích chuỗi proxy
        const [host, port, username, password] = proxyString.split(":");

        // Tạo đối tượng proxy để áp dụng
        const proxyData = {
          host: host,
          port: port,
          username: username,
          password: password,
          type: proxyInfo.proxyType,
          nhaMang: data.data["Nha Mang"] || "",
          viTri: data.data["Vi Tri"] || "",
          expiration: data.data["Token expiration date"] || "",
          message: data.data.message || "",
          httpString: httpString,
          socks5String: socks5String,
        };

        // Lưu dữ liệu proxy đầy đủ
        proxyInfo.proxyData = proxyData;

        // Lưu vào storage
        chrome.storage.sync.set({ proxyData: proxyData });

        // Áp dụng proxy mới vào trình duyệt
        applyProxyToChrome(proxyData);

        // Reset thời gian xoay tiếp theo
        proxyInfo.nextRotationTime = null;

        return proxyData;
      } else {
        throw new Error("API không trả về thông tin proxy hợp lệ");
      }
    }

    // Các trạng thái khác
    throw new Error(
      `API trả về trạng thái không xử lý được: ${data.data.status}`
    );
  } catch (error) {
    console.error("Lỗi khi lấy proxy từ API:", error);
    proxyInfo.currentProxyInfo = "Lỗi kết nối proxy: " + error.message;
    proxyInfo.proxyData = null;

    // Lưu trạng thái lỗi vào storage
    chrome.storage.sync.set({
      currentProxyInfo: proxyInfo.currentProxyInfo,
      proxyData: null,
    });

    // Thông báo cho popup về lỗi
    notifyPopupProxyUpdated();

    throw error;
  }
}

// Thông báo cho popup về thay đổi proxy
function notifyPopupProxyUpdated() {
  chrome.runtime.sendMessage(
    {
      action: "proxyUpdated",
      proxyInfo: proxyInfo.currentProxyInfo,
      proxyData: proxyInfo.proxyData,
    },
    (response) => {
      // Xử lý lỗi khi gửi thông báo (nếu popup chưa mở)
      if (chrome.runtime.lastError) {
        console.log(
          "Popup chưa mở, không thể gửi thông báo:",
          chrome.runtime.lastError.message
        );
      }
    }
  );
}

// Áp dụng thông tin proxy vào Chrome
function applyProxyToChrome(proxyData) {
  if (!proxyData || !proxyData.host || !proxyData.port) {
    console.error("Không thể áp dụng proxy: Dữ liệu không hợp lệ", proxyData);
    return;
  }

  try {
    // Cấu hình proxy
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: proxyData.type === "socks5" ? "socks5" : "http",
          host: proxyData.host,
          port: parseInt(proxyData.port, 10),
        },
        bypassList: [],
      },
    };

    // Tạo thông tin proxy hiện tại để hiển thị
    let displayIsp =
      proxyData.nhaMang ||
      (proxyInfo.isp !== "random" ? proxyInfo.isp.toUpperCase() : "");
    let displayProvince =
      proxyData.viTri ||
      (proxyInfo.province !== "random" ? proxyInfo.province : "");
    let ispProvince = "";

    if (displayIsp && displayProvince) {
      ispProvince = `${displayIsp} - ${displayProvince}`;
    } else if (displayIsp) {
      ispProvince = displayIsp;
    } else if (displayProvince) {
      ispProvince = displayProvince;
    } else {
      ispProvince = "IP ngẫu nhiên";
    }

    // Tạo thông tin hiển thị và lưu
    let expirationInfo = proxyData.expiration
      ? ` | Hết hạn: ${proxyData.expiration}`
      : "";
    proxyInfo.currentProxyInfo = `${proxyData.host}:${
      proxyData.port
    } [${proxyData.type.toUpperCase()}] (${ispProvince})${expirationInfo}`;

    // Lưu thông tin proxy hiện tại
    chrome.storage.sync.set({
      currentProxyInfo: proxyInfo.currentProxyInfo,
    });

    // Thông báo cho popup về thay đổi
    notifyPopupProxyUpdated();

    // Thiết lập proxy
    chrome.proxy.settings.set(
      {
        value: config,
        scope: "regular",
      },
      function () {
        console.log("Proxy đã được áp dụng thành công:", config);

        // Thiết lập xác thực nếu có username và password
        if (proxyData.username && proxyData.password) {
          setupProxyAuth(proxyData.username, proxyData.password);
        }
      }
    );

    return proxyInfo.currentProxyInfo;
  } catch (error) {
    console.error("Lỗi khi áp dụng proxy:", error);
    proxyInfo.currentProxyInfo = "Lỗi khi áp dụng proxy: " + error.message;
    proxyInfo.proxyData = null;

    // Lưu trạng thái lỗi
    chrome.storage.sync.set({
      currentProxyInfo: proxyInfo.currentProxyInfo,
      proxyData: null,
    });

    // Thông báo cho popup về lỗi
    notifyPopupProxyUpdated();

    throw error;
  }
}

// Tắt proxy
function disableProxy() {
  chrome.proxy.settings.set(
    {
      value: { mode: "direct" },
      scope: "regular",
    },
    function () {
      console.log("Proxy đã bị tắt");
    }
  );
}

// Thiết lập xác thực proxy
// Thiết lập xác thực proxy (chỉ đăng ký 1 lần duy nhất)
let authListenerRegistered = false;

function setupProxyAuth(username, password) {
  if (authListenerRegistered) return;

  chrome.webRequest.onAuthRequired.addListener(
    (details) => {
      console.log("Intercepted proxy auth, tự động gửi username/password");
      return {
        authCredentials: {
          username,
          password,
        },
      };
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
  );

  authListenerRegistered = true;
}

// Bắt đầu xoay proxy theo thời gian
function startProxyRotation() {
  // Dừng timer trước nếu đã tồn tại
  stopProxyRotation();

  // Kiểm tra nếu có thời gian xoay cụ thể được đặt (từ API 101)
  const setupNextRotation = () => {
    if (proxyInfo.nextRotationTime) {
      // Tính thời gian còn lại đến lần xoay tiếp theo
      const timeLeft = proxyInfo.nextRotationTime - Date.now();

      if (timeLeft > 0) {
        // Nếu vẫn còn thời gian, đặt timer cho lần xoay tiếp theo
        console.log(
          `Đặt timer xoay proxy sau ${Math.ceil(timeLeft / 1000)} giây`
        );

        proxyInfo.rotationTimer = setTimeout(() => {
          if (proxyInfo.isActive) {
            fetchAndApplyProxy()
              .then((proxyData) => {
                if (proxyData) {
                  console.log("Đã xoay proxy thành công!");
                }

                // Sau khi xoay xong, thiết lập timer mới theo cấu hình
                setupRotationTimer();
              })
              .catch((error) => {
                console.error("Lỗi khi xoay proxy:", error);
                // Thiết lập timer cho lần sau ngay cả khi có lỗi
                setupRotationTimer();
              });
          }
        }, timeLeft);

        return;
      }
    }

    // Nếu không có thời gian cụ thể, hoặc thời gian đã qua, thiết lập timer thông thường
    setupRotationTimer();
  };

  // Hàm thiết lập timer thông thường
  const setupRotationTimer = () => {
    proxyInfo.rotationTimer = setInterval(() => {
      // Chỉ lấy proxy mới khi extension đang ở trạng thái bật
      if (proxyInfo.isActive) {
        console.log(
          "Đang xoay proxy... Thời gian xoay:",
          proxyInfo.rotationTime
        );

        fetchAndApplyProxy()
          .then((proxyData) => {
            if (proxyData) {
              console.log("Đã xoay proxy thành công!");
            } else if (proxyInfo.nextRotationTime) {
              // Nếu API trả về status 101 (chưa đến thời gian), hãy dừng timer hiện tại
              // và thiết lập timer mới cho thời gian chính xác
              console.log(
                "Dừng timer hiện tại và thiết lập timer mới cho thời gian chính xác"
              );
              stopProxyRotation();
              setupNextRotation();
            }
          })
          .catch((error) => {
            console.error("Lỗi khi xoay proxy:", error);
          });
      }
    }, proxyInfo.rotationTime * 1000);
  };

  // Bắt đầu thiết lập timer
  setupNextRotation();
}

// Dừng xoay proxy
function stopProxyRotation() {
  if (proxyInfo.rotationTimer) {
    clearInterval(proxyInfo.rotationTimer);
    clearTimeout(proxyInfo.rotationTimer);
    proxyInfo.rotationTimer = null;
  }
}

// Khôi phục trạng thái khi extension được khởi động lại
chrome.storage.sync.get(
  [
    "proxyKey",
    "rotationTime",
    "autoAssign",
    "isActive",
    "isp",
    "province",
    "proxyType",
    "currentProxyInfo",
    "proxyData",
  ],
  function (result) {
    if (result.proxyKey) proxyInfo.proxyKey = result.proxyKey;
    if (result.rotationTime) proxyInfo.rotationTime = result.rotationTime;
    if (result.autoAssign !== undefined)
      proxyInfo.autoAssign = result.autoAssign;
    if (result.isActive !== undefined) proxyInfo.isActive = result.isActive;
    if (result.isp) proxyInfo.isp = result.isp;
    if (result.province) proxyInfo.province = result.province;
    if (result.proxyType) proxyInfo.proxyType = result.proxyType;
    if (result.currentProxyInfo)
      proxyInfo.currentProxyInfo = result.currentProxyInfo;
    if (result.proxyData) proxyInfo.proxyData = result.proxyData;

    // Nếu trạng thái đang hoạt động, lấy proxy mới và áp dụng
    if (proxyInfo.isActive) {
      fetchAndApplyProxy()
        .then((proxyData) => {
          // Bắt đầu xoay proxy nếu autoAssign được bật
          if (proxyInfo.autoAssign) {
            startProxyRotation();
          }
        })
        .catch((error) => {
          console.error("Lỗi khi khôi phục proxy:", error);
          // Vẫn bắt đầu xoay proxy nếu autoAssign được bật, ngay cả khi có lỗi
          if (proxyInfo.autoAssign) {
            startProxyRotation();
          }
        });
    }
  }
);
