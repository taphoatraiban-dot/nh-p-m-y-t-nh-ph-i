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

## Kích hoạt từng khách (chưa thực thi trên VPS)

1. Sao lưu và kiểm tra dịch vụ đang chạy: `systemctl status xoso-live.service` và `systemctl list-units '*telegram*'`. Không dừng hoặc thay thế worker Telegram hiện tại.
2. Tạo tài khoản Supabase cho khách và cấp quyền sử dụng phần mềm. Khách đăng nhập mục **KẾT NỐI TELEGRAM VPS CỦA TÔI** để kiểm tra trạng thái và lấy khóa đồng bộ riêng trong menu quản trị tài khoản.
3. Cài bản mã này vào thư mục độc lập `/opt/ongthantai`, có Python venv và Telethon. Giữ quyền file session 0600, thư mục 0700.
4. Quản trị VPS xác thực Telegram **với sự đồng ý của khách** qua `provision_tenant.py`. Khách chỉ nhập OTP/2FA trực tiếp vào một kênh riêng tin cậy, không chuyển OTP cho admin hay nhập lên web chưa có backend xác thực.
5. Mẫu `telegram/ongthantai-tenant@.service` chỉ là bản mẫu. Chỉ cài/bật khi đã bảo đảm Linux user `ongthantai-telegram` tồn tại, file config đọc được và thư mục dữ liệu ghi được. Mẫu dùng chung một tài khoản Linux phục vụ vận hành nội bộ, vì vậy **chưa cách ly ở cấp hệ điều hành**. Không cho khách SSH vào VPS. Để cách ly mạnh, triển khai mỗi worker dưới một Linux user/container riêng, với quyền file và secret riêng.
6. Bật thử từng worker một bằng `systemctl start ongthantai-tenant@<user-uuid>.service` sau khi đặt unit và chạy `systemctl daemon-reload`. Theo dõi log và inbox của đúng tài khoản trước khi dùng `enable`.
7. Kiểm tra tính đúng đắn: người dùng B không thể đọc tin người A; khóa A không thể ingest sang B; bot và VPS cũ vẫn chạy; kiểm tra trùng tin và lỗi mạng.
8. **Chưa có hệ thống tự phục vụ OTP trên website**, chưa có daemon tự tạo phiên sau khi khách bấm nút, chưa nối điều kiện giấy phép vào ingest. Không quảng cáo tính năng tự động cho tất cả khách trước khi ba phần này được triển khai và kiểm thử.

Không gửi số điện thoại Telegram, session, API hash, secret hay mã OTP vào issue, commit, chat công khai.

## Thử nghiệm riêng mục tin nhắn cá nhân (PR #43)

Phần nhóm đang hoạt động không thay đổi. Worker chỉ đọc tin nhắn riêng khi chủ tài khoản Telegram chủ động bật cấu hình cho tenant của mình:

- Đồng bộ toàn bộ hội thoại riêng (không gồm bot/Secret Chat): đặt `"receive_all_private": true` trong JSON cấu hình tenant; giữ nguyên `allowed_chat_ids` của nhóm.
- Chỉ đồng bộ một số người: đặt `"receive_all_private": false` và điền Telegram user ID vào `"allowed_private_chat_ids": [123456789]`.
- **Không đưa** `api_hash`, `sync_key`, session hay OTP lên GitHub. Không bật đồng bộ tin riêng của khách khi chưa có sự đồng ý của chủ tài khoản.
- Sau khi sao lưu cấu hình và hàng đợi, kiểm tra cú pháp JSON, kiểm tra quyền file 0600 rồi mới khởi động lại **đúng tenant thử nghiệm**. Không restart worker nhóm hoặc toàn bộ VPS.
- Từ một tài khoản Telegram khác, gửi một tin riêng tới tài khoản thử nghiệm, sau đó gửi một tin trả lời từ tài khoản thử nghiệm. Kiểm tra hai tin xuất hiện trong tab **Cá nhân** với nhãn **Đã nhận** và **Đã gửi**, đúng hội thoại, không lẫn vào **Nhóm**.
- Kiểm tra gửi liên tiếp, sửa tin, mất mạng/tự nối lại, khởi động lại tenant, chọn/xóa/nhập phơi và tránh tin trùng. Kiểm tra dữ liệu chỉ hiển thị trong tài khoản được cấp quyền.
- Lần đầu chạy chỉ ghi nhận mốc tin mới nhất của mỗi hội thoại, **không tự nhập lịch sử cũ**. Tin mới sau khi bật cấu hình mới được đồng bộ.
- Trước khi đưa production: cần có kết quả kiểm thử thật trên VPS, kiểm tra backend Supabase và xác nhận người dùng có quyền đồng bộ tin riêng. PR không tự triển khai VPS.
