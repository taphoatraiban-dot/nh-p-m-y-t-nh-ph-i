# Cuncun Mac Mini: in một chạm qua hàng đợi trực tuyến

**Bản thử độc lập — chưa kết nối Mac Mini thực tế và chưa triển khai trên Supabase sản xuất.**

Sơ đồ luồng: Cuncun HTTPS (người dùng đã đăng nhập) → `print_queue` → Mac Mini worker (poll qua HTTPS) → Xprinter XP-Q809K TCP `192.168.1.159:9100`. iPhone không cần Xcode hoặc thêm ứng dụng, nhưng Mac Mini phải bật và kết nối mạng.

## BẮT BUỘC trước khi in phiếu thật

Các policy `print_queue` được kiểm tra ngày 28/10/2026 **đang cho phép `anon` đọc toàn bộ**, `anon` chèn hàng đợi, và `anon` cập nhật phiếu đang chờ. Đường này **chưa an toàn cho dữ liệu khách và chưa được kích hoạt**. Phải rà soát, sao lưu, áp dụng và kiểm thử migration khóa quyền trong `security-review-DRAFT.sql` trước khi bật worker.

Worker này mặc định **dry-run**, không in và không sửa dữ liệu. `TSH_PRINT_ARMED=YES` là chế độ gửi in thật, chỉ sau khi RLS đã kiểm thử và cấu hình khóa bí mật tại Mac.

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
