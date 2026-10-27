# Cuncun Mac Mini: in một chạm qua hàng đợi trực tuyến

**Bản thử độc lập — chưa chạy trên Mac Mini thực tế và chưa triển khai giao diện lên website sản xuất.**

Sơ đồ luồng: Cuncun HTTPS (người dùng đã đăng nhập) → `print_queue` → Mac Mini worker (poll qua HTTPS) → Xprinter XP-Q809K TCP `192.168.1.159:9100`. iPhone không cần Xcode hoặc thêm ứng dụng, nhưng Mac Mini phải bật và kết nối mạng.

## BẮT BUỘC trước khi in phiếu thật

**Ngày 28/10/2026:** đã xác nhận và sửa policy `print_queue` sản xuất theo yêu cầu chủ sở hữu: `anon` không còn quyền SELECT/INSERT/UPDATE/TRUNCATE; `authenticated` chỉ SELECT/INSERT phơi cùng `user_id`; 215 bản ghi giữ nguyên. Tệp `security-review-DRAFT.sql` là bản ghi tham chiếu, không chạy lại. Bộ nhận lệnh vẫn **chưa bật trên Mac thật**.

Worker chạy thủ công mặc định **dry-run**, không in và không sửa dữ liệu. Bộ cài `setup-mac.cjs` chỉ bật `armed` sau khi người dùng xác nhận tờ kiểm tra IP đã ra giấy và đã nhập khóa truy cập riêng trên Mac.

## Cài tự động trên Mac Mini

- Mac có Node 20+ (`node -v`); người dùng đã kiểm tra được v24.21.0.
- Chạy `node setup-mac.cjs` ngay trên Mac. Bộ cài dùng launchd của người dùng, **không cần sudo, Xcode hoặc CUPS**.
- Sau khi tờ thử Xprinter 192.168.1.159:9100 ra giấy, nhập các email đăng nhập Cuncun được phép in (có thể nhiều email, phân tách bằng dấu phẩy), rồi dán khóa `service_role` JWT riêng từ trang Supabase của dự án vào lời nhắc nhập ẩn. **Không gửi hoặc chụp khóa lên ChatGPT.**
- Bộ cài lưu cấu hình với quyền `600` trong `~/Library/Application Support/CuncunPrinter` và tự khởi động dịch vụ khi đăng nhập macOS. Chỉ xử lý phiếu tạo sau thời điểm cài mới, tránh in 29 phiếu cũ đang chờ.
- Dịch vụ cần Mac Mini bật và có kết nối đến Xprinter, Supabase. Nếu tờ thử không ra, bộ cài dừng an toàn.

### Cấu hình (chỉ ở Mac, không gửi mật khẩu/token qua chat)

- `TSH_SUPABASE_URL`: URL của dự án Supabase đúng với Cuncun.
- `TSH_SUPABASE_SERVICE_ROLE_KEY`: secret chỉ lưu trong biến môi trường trên Mac, **không đưa vào website**. Nếu sử dụng, phải bảo vệ máy và quyền đọc biến môi trường.
- `TSH_PRINT_USER_ID`: UUID đúng tài khoản sở hữu phiếu; worker chỉ lấy hàng đợi của tài khoản này.
- `TSH_PRINTER_IP`: `192.168.1.159`.
- `TSH_PRINTER_PORT`: `9100`.
- `TSH_PRINT_ARMED`: bỏ trống để thử an toàn, chỉ dùng `YES` sau kiểm thử phân quyền và phiếu mẫu.

Chạy: `node worker.cjs` (Node.js 20+). Không cần `npm install`.

QR nếu có mã phiếu `MA PHIEU` được in bằng lệnh QR ESC/POS của máy; **chỉ là QR chứa mã phiếu, chưa phải QR ký xác thực chống giả**. Kiểm tra thực tế trên XP-Q809K trước khi dùng. Worker chỉ xác nhận gửi bytes qua TCP, không tự kết luận giấy đã in.

Không chỉnh Cốc Cốc hoặc AirPrint. Website hiện có một đường in `internet` vào `print_queue`, nhưng nút IN NGAY đang được đặt theo lựa chọn người dùng; **chưa chuyển nút IN NGAY sản xuất tự động sang worker này**.
