# Telegram VPS nhiều tài khoản — triển khai an toàn

Đây là mã **opt-in**. Chưa thay đổi dịch vụ VPS hiện tại `member_sync.py`.

- Một khách = một Telegram session Telethon, một `SYNC_USER_ID` và `SYNC_KEY` riêng (tạo bằng chức năng khóa đồng bộ trong tài khoản khách).
- Tạo session bằng xác thực Telegram chính chủ (SMS/Telegram OTP, 2FA), chỉ nhập OTP vào tiến trình đáng tin cậy trên VPS. Không lưu OTP, mật khẩu hay token vào GitHub.
- Mỗi tenant có thư mục /var/lib/ongthantai-telegram/tenants/<auth-user-uuid>/ quyền 0700; config /etc/ongthantai-telegram/tenants/<uuid>.json quyền 0600.
- Cấu hình `allowed_chat_ids` bằng ID nhóm mà tài khoản Telegram khách tham gia và cho phép đồng bộ. Không tự lấy mọi nhóm.
- Chạy worker: `python3 telegram/tenant_worker.py --config /etc/ongthantai-telegram/tenants/<uuid>.json`; mỗi khách một dịch vụ systemd riêng với User không đặc quyền, giới hạn tài nguyên, không dùng chung file session.
- Cần kiểm tra backend `telegram-member-sync` xác minh cặp user/key, phân quyền bảng theo `auth.uid()`, không chấp nhận client tự ghi user_id khác, có giới hạn tốc độ và hết hạn license trước khi triển khai cho khách.
- Quản trị viên chỉ nên xem tình trạng kết nối; không cấp cho quản trị viên quyền đọc inbox khách.
- Khi khóa gói: dừng worker / vô hiệu khóa sync; không xóa session hay tin đã lưu.
- Cần tích hợp quy trình cấp phát session + systemd + trạng thái và chọn nhóm trên website **trước khi** tự phục vụ được. File này không tự tạo VPS hay triển khai production.
- Chú ý Telethon/API có thể giới hạn tần suất, cần backoff. Bảo vệ dữ liệu riêng tư; chỉ đồng bộ nhóm mà người dùng có quyền truy cập.

Kiểm thử trước khi bật: khách A/B nhận nhóm riêng, không đọc chéo, khóa của khách A không ghi được cho B, tenant lỗi không ảnh hưởng worker cũ, và cập nhật không gây mất tin.
