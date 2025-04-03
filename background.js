// Biến lưu trữ thông tin proxy và timer
let proxyInfo = {
  proxyKey: '',
  rotationTime: 60,
  autoAssign: true,
  isActive: false,
  rotationTimer: null,
  isp: 'random',
  province: 'random',
  currentProxyInfo: '[Chưa kết nối]'
};

// Xử lý khi nhận message từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'enableProxy') {
    // Lưu thông tin proxy
    proxyInfo.proxyKey = message.proxyKey;
    proxyInfo.rotationTime = message.rotationTime;
    proxyInfo.autoAssign = message.autoAssign;
    proxyInfo.isActive = true;
    proxyInfo.isp = message.isp || 'random';
    proxyInfo.province = message.province || 'random';

    // Lưu trạng thái active vào storage
    chrome.storage.sync.set({ isActive: true });

    // Kích hoạt proxy
    const proxyDetails = enableProxy();

    // Bắt đầu xoay proxy nếu autoAssign được bật
    if (proxyInfo.autoAssign) {
      startProxyRotation();
    }
    
    sendResponse({ 
      success: true,
      proxyInfo: proxyInfo.currentProxyInfo
    });
    return true;
  } 
  else if (message.action === 'disableProxy') {
    // Cập nhật trạng thái
    proxyInfo.isActive = false;
    proxyInfo.currentProxyInfo = '[Chưa kết nối]';
    
    // Lưu trạng thái active vào storage
    chrome.storage.sync.set({ 
      isActive: false,
      currentProxyInfo: proxyInfo.currentProxyInfo 
    });

    // Tắt proxy
    disableProxy();
    
    // Dừng xoay proxy
    stopProxyRotation();
    
    sendResponse({ 
      success: true,
      proxyInfo: proxyInfo.currentProxyInfo
    });
    return true;
  }
  
  return false;
});

// Kích hoạt proxy
function enableProxy() {
  if (!proxyInfo.proxyKey) return;
  
  try {
    // Phân tích key proxy (giả định key có định dạng: host:port:username:password)
    const [host, port, username, password] = proxyInfo.proxyKey.trim().split(':');
    
    // Cấu hình proxy
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: host,
          port: parseInt(port, 10)
        },
        bypassList: []
      }
    };

    // Tạo thông tin proxy hiện tại để hiển thị
    let displayIsp = proxyInfo.isp !== 'random' ? proxyInfo.isp.toUpperCase() : '';
    let displayProvince = proxyInfo.province !== 'random' ? proxyInfo.province : '';
    let ispProvince = '';
    
    if (displayIsp && displayProvince) {
      ispProvince = `${displayIsp} - ${displayProvince}`;
    } else if (displayIsp) {
      ispProvince = displayIsp;
    } else if (displayProvince) {
      ispProvince = displayProvince;
    } else {
      ispProvince = 'IP ngẫu nhiên';
    }
    
    proxyInfo.currentProxyInfo = `${host}:${port} (${ispProvince})`;
    
    // Lưu thông tin proxy hiện tại
    chrome.storage.sync.set({ currentProxyInfo: proxyInfo.currentProxyInfo });

    // Thiết lập proxy
    chrome.proxy.settings.set({
      value: config,
      scope: 'regular'
    }, function() {
      console.log('Proxy đã được bật với cấu hình:', config);
      console.log('Nhà mạng:', proxyInfo.isp, 'Tỉnh thành:', proxyInfo.province);
      
      // Thiết lập xác thực nếu có username và password
      if (username && password) {
        setupProxyAuth(username, password);
      }
    });
    
    return proxyInfo.currentProxyInfo;
  } catch (error) {
    console.error('Lỗi khi bật proxy:', error);
    proxyInfo.currentProxyInfo = 'Lỗi kết nối proxy';
    chrome.storage.sync.set({ currentProxyInfo: proxyInfo.currentProxyInfo });
    return proxyInfo.currentProxyInfo;
  }
}

// Tắt proxy
function disableProxy() {
  chrome.proxy.settings.set({
    value: { mode: "direct" },
    scope: 'regular'
  }, function() {
    console.log('Proxy đã bị tắt');
  });
}

// Thiết lập xác thực proxy
function setupProxyAuth(username, password) {
  // Lắng nghe các yêu cầu xác thực
  chrome.webRequest.onAuthRequired.addListener(
    function(details, callback) {
      callback({
        authCredentials: {
          username: username,
          password: password
        }
      });
    },
    { urls: ["<all_urls>"] },
    ['blocking']
  );
}

// Bắt đầu xoay proxy theo thời gian
function startProxyRotation() {
  // Dừng timer trước nếu đã tồn tại
  stopProxyRotation();
  
  // Thiết lập timer mới
  proxyInfo.rotationTimer = setInterval(() => {
    // Ở đây bạn có thể thực hiện request để lấy IP mới từ server
    // hoặc đơn giản là kích hoạt lại proxy hiện tại
    console.log('Đang xoay proxy... Thời gian xoay:', proxyInfo.rotationTime);
    console.log('Nhà mạng:', proxyInfo.isp, 'Tỉnh thành:', proxyInfo.province);
    enableProxy();
  }, proxyInfo.rotationTime * 1000);
}

// Dừng xoay proxy
function stopProxyRotation() {
  if (proxyInfo.rotationTimer) {
    clearInterval(proxyInfo.rotationTimer);
    proxyInfo.rotationTimer = null;
  }
}

// Khôi phục trạng thái khi extension được khởi động lại
chrome.storage.sync.get(['proxyKey', 'rotationTime', 'autoAssign', 'isActive', 'isp', 'province', 'currentProxyInfo'], function(result) {
  if (result.proxyKey) proxyInfo.proxyKey = result.proxyKey;
  if (result.rotationTime) proxyInfo.rotationTime = result.rotationTime;
  if (result.autoAssign !== undefined) proxyInfo.autoAssign = result.autoAssign;
  if (result.isActive !== undefined) proxyInfo.isActive = result.isActive;
  if (result.isp) proxyInfo.isp = result.isp;
  if (result.province) proxyInfo.province = result.province;
  if (result.currentProxyInfo) proxyInfo.currentProxyInfo = result.currentProxyInfo;
  
  // Nếu trạng thái đang hoạt động, bật lại proxy
  if (proxyInfo.isActive) {
    enableProxy();
    if (proxyInfo.autoAssign) {
      startProxyRotation();
    }
  }
});
