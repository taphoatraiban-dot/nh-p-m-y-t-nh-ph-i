# CuncunPrint – in Wi-Fi trực tiếp từ Xcode (bản thử nghiệm)

Đây là module Swift **độc lập**, chưa được tích hợp vào project Xcode vì mã nguồn .xcodeproj/.swift của ứng dụng iPhone chưa được tìm thấy trong repository hiện tại.

## Cách tích hợp
1. Thêm `CuncunWiFiPrinter.swift` vào target ứng dụng iOS trong Xcode.
2. Trong Info.plist, thêm `NSLocalNetworkUsageDescription`: `CuncunPrint cần kết nối máy in Wi-Fi trong mạng nội bộ.`
3. Chỉ cho phép cấu hình IP/cổng máy in từ màn hình cài đặt (ví dụ IP 192.168.1.159, cổng 9100 nếu máy in thực tế hỗ trợ).
4. Trong `WKScriptMessageHandler` hiện có (`tshPrinter`), giải mã trường `png` dạng data:image/png;base64,... rồi gọi `CuncunWiFiPrinter().printPNG(...)`.
5. Sau callback, gọi JavaScript bridge `TSHNativePrintBridge.resolve(id,{ok:true})` hoặc `resolve(id,{ok:false,error:'...'})`. **Phải escape JSON an toàn** bằng JSONSerialization; không ghép chuỗi từ dữ liệu không tin cậy.
6. Lưu lựa chọn Wi-Fi/Bluetooth/AirPrint ở lớp native; không thay thế các chế độ cũ.
7. Test trên iPhone thật và máy in 80mm hỗ trợ ESC/POS raster `GS v 0`, TCP 9100, lệnh cắt `GS V 0`. Không phải mọi máy in đều tương thích.

## Giới hạn cần lưu ý
- Gửi TCP thành công **không xác nhận** máy đã in ra giấy.
- Chưa có khám phá máy in tự động, trạng thái giấy, tự in lại hoặc chống trùng. Không tự động retry khi không rõ máy đã in hay chưa.
- Dữ liệu ảnh PNG được xử lý cục bộ, không gửi qua máy chủ.
- Không cần Mac Mini làm cầu nối khi máy in cùng mạng với iPhone.
- Không sửa mã website đang chạy, Supabase, tài khoản, QR hoặc Telegram.
