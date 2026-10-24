# ÔNG THẦN TÀI — Lộ trình 6 phân hệ (24/10/2026)

## Nguyên tắc an toàn
- Sao lưu GitHub: `backup/six-feature-audit-20261024`. Không đổi quyền khách hàng, khóa Telegram, bot hoặc dữ liệu sản xuất trong đợt rà soát.
- Không chạy bộ phân tích mới trực tiếp trên bảng tính tiền đang dùng. Triển khai chế độ chỉ đọc / so sánh trước.
- Mọi tin nguồn phải giữ UID, chat_id, message_id, thời điểm, nguyên văn và phiên bản chuẩn hóa.
- Không được tự sửa cược mơ hồ; phải trả về trạng thái cần kiểm tra.

## P0 — Nhận dạng tin và kiểm thử
1. Giữ chuẩn đầu vào theo ngày, miền, đài, kiểu chơi, con số, điểm/tiền.
2. Kiểm thử `node --test tests/parser-regression.cjs`; đây là bộ kiểm thử *bộ chuẩn hóa thuần* với hơn 200 ca được sinh từ cấu trúc mã thực tế. Chưa bao gồm phép tính hoặc lịch đài.
3. Khi kiểm thử lỗi, sửa trên nhánh riêng, không đổi `index.html` sản xuất cho đến khi đối chiếu đủ kết quả.
4. Bổ sung test parser và phép tính tại ranh giới: thiếu tên đài, đá trùng cặp, sai độ dài DD/XC, dấu phẩy thập phân, lịch mở thưởng, chức năng nối tiếp.

## P1 — Gom nhiều nguồn Telegram
- Nguồn hợp lệ: UID đăng nhập + chat_id + message_id; đếm mỗi tin một lần nhưng các tin khác nhau có thể cùng bộ số.
- Kho tin riêng theo khách; tránh gộp dữ liệu khác tài khoản.
- Chỉ dùng tin đã phân tích thành công để hình thành bảng tổng; tin mơ hồ đưa vào chờ xác nhận.
- Đo độ trễ Telegram -> VPS -> Supabase -> Safari mà không tắt Worker.

## P1 — Đối soát tổng
- Không cộng tiền với điểm; quy đổi minh bạch theo từng miền, đài, kiểu chơi.
- Bất biến: tổng đầu vào hợp lệ = tổng chi tiết đã gom + khoản chờ xử lý (cùng đơn vị).
- Lưu dấu vết từng số tổng về các tin nguồn, có phiên bản khi sửa tin.
- Chốt bảng theo ngày; tin mới sau chốt phải là bút toán điều chỉnh.

## P2 — Sao lưu và khôi phục
- GitHub backup đã tạo. Cần thiết kế thêm backup Supabase theo lịch, lưu bản mã hóa ngoài vùng hoạt động và diễn tập khôi phục riêng.
- Không coi việc có branch GitHub là đã sao lưu dữ liệu Supabase, phiên Telegram hoặc VPS.

## P2 — Quản trị bán phần mềm
- Tái sử dụng bảng `licenses`, `email_licenses`, `member_subscriptions`.
- Xác minh trạng thái hết hạn theo thời gian phía máy chủ, quyền và hành vi gia hạn; không khóa/xóa dữ liệu khách khi hết hạn.
- Tài khoản admin/khách phải có giới hạn quyền, nhật ký cấp quyền, lịch sử thanh toán được đối chiếu; không tự thêm xử lý thanh toán vào môi trường chạy khi chưa thử.

## Tình trạng kiểm tra 24/10/2026
- Đã tạo branch sao lưu và thêm tệp kiểm thử độc lập. Chưa chạy xác nhận 200+ ca trong CI.
- Supabase: các bảng `licenses`, `member_subscriptions`, `telegram_member_groups`, `telegram_member_messages`, `telegram_member_sync_keys` bật RLS.
- `telegram_member_messages` có UNIQUE (`user_id`, `chat_id`, `message_id`).
- Chưa thay đổi schema, dữ liệu Supabase, cấu hình VPS, 5 bot Telegram, hoặc mã sản xuất `index.html` trong đợt này.
