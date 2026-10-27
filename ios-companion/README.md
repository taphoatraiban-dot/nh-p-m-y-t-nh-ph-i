# Thần Tài – iPhone Bluetooth companion (thử nghiệm)

**Chưa phát hành, chưa kiểm thử trên XP-Q809K thật.** Đây là nguồn khởi đầu cho
ứng dụng iOS, không phải bản cài đặt `.ipa` và không thay thế ứng dụng XPrinter.

## Chức năng đã viết

- WKWebView chỉ mở `https://cuncun.icu`, không cho website khác gửi lệnh in.
- Chọn máy BLE do iPhone phát hiện; kết nối và dò GATT.
- Chế độ **Wi-Fi / IP**: lưu IP nội bộ của máy XP-Q809K và cổng TCP (mặc định
  `9100`); gửi raster ESC/POS trực tiếp bằng Network.framework. Chế độ này
  cần máy in nối LAN vào router và iPhone ở cùng Wi-Fi.
- Chỉ chọn dịch vụ ghi ESC/POS BLE phổ biến `FFE0`, `FF00`, `18F0`.
- Nhận PNG từ nút IN BLUETOOTH qua `src/ios-native-print-bridge.js`.
- Chuyển ảnh sang raster ESC/POS rộng 576 điểm (giấy 80mm) và gửi dữ liệu theo
  giới hạn gói BLE; **thông báo gửi lệnh không đồng nghĩa đã in ra giấy**.
- Cốc Cốc vẫn dùng bảng chia sẻ iOS, không tự nhận là đã kết nối Bluetooth.

## Cách tạo ứng dụng để thử trên máy thật

1. Trên máy Mac có Xcode, cài công cụ tạo dự án: `brew install xcodegen`.
2. Tại thư mục `ios-companion`, chạy `xcodegen generate` để tạo
   `ThanTaiPrinter.xcodeproj` từ `project.yml`, rồi mở bằng Xcode.
3. Cấu hình Signing bằng tài khoản Apple của chủ máy, chọn iPhone làm thiết bị
   chạy, rồi Build & Run. Việc này chỉ dùng Mac **để cài ứng dụng một lần**;
   không cần Mac Mini hoạt động trong lúc in.
4. Nếu không tìm thấy thiết bị `Printer001` hoặc không có dịch vụ BLE ghi phù hợp,
   **dừng**: bản XP-Q809K có thể dùng Bluetooth Classic hoặc UUID/SDK riêng.
   Cần tài liệu SDK chính thức trước khi tiếp tục, không đoán lệnh.

**Quan trọng:** Ứng dụng đang tải website sản xuất và cần file
`src/ios-native-print-bridge.js` cùng đường gọi trong `index.html` đã được
triển khai thì nút Bluetooth mới chuyển lệnh cho app. Hiện chưa triển khai.
Việc tạo dự án không tự kích hoạt chức năng in trên sản xuất.

## Chưa hoàn thành để phát hành

- Xác minh UUID và giao thức bằng XP-Q809K thực tế; thử in nhiều phiếu và tiếng Việt.
- Xác minh máy có bật cổng TCP raw `9100` và biết địa chỉ IP trong LAN.
- Kết nối QR ký trên server, luồng xác thực/quản lý phơi và sao lưu dữ liệu.
- Kiểm tra quyền truy cập Admin, xử lý khôi phục kết nối và trạng thái giấy.
- Phát hành qua phương thức ký và cài đặt iOS phù hợp.

Đây không phải thay đổi Supabase hay VPS/website sản xuất.
