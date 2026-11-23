# Đối chiếu cơ chế cấp quyền hiện tại trước khi tự động gia hạn

Kiểm tra trực tiếp `information_schema.routines` ngày 01/11/2026 (chỉ đọc):

- `admin_activate_license(p_user_id, p_phone, p_days, p_note)` xác minh `profiles.role='admin'`, ghi `public.licenses`, cộng `p_days` vào hạn hiện có nếu còn hạn.
- `admin_member_change(p_user_id, p_action, p_plan_code)` xác minh `admin_users`; chỉ cấp `vip`/`pro` với mỗi lần 30 ngày, hoặc xóa bản ghi khi revoke.
- `check_license` đọc `public.licenses`; `check_email_license` đọc `public.email_licenses`; `member_access_status` đọc `public.ott_memberships`.

**Không thể xác định an toàn một RPC cấp quyền duy nhất cho mọi khách từ những dữ kiện này.** Tự động dùng `admin_activate_license` có thể gia hạn sai hệ thống, hoặc quy đổi tháng thành số ngày gây lệch ngày.

## Quy trình an toàn cho giai đoạn đầu
1. Admin tạo đơn hàng WEB và xác nhận đã nhận tiền.
2. Hệ thống lưu giao dịch, **không tự thay đổi giấy phép**.
3. Admin đối chiếu nguồn quyền đang dùng của khách rồi gia hạn bằng giao diện cấp quyền cũ.
4. Chỉ đánh dấu hoàn tất sau khi xác minh ngày hết hạn thực tế ở nguồn quyền tương ứng. Trạng thái `confirmed` chỉ có nghĩa **đã nhận tiền**, không phải **đã gia hạn**.

## Trước khi tự động hóa
- Xác minh chính xác các luồng đăng nhập/cấp quyền đang dùng theo từng nhóm khách, kể cả quyền vĩnh viễn.
- Chọn một phương thức gia hạn theo **tháng lịch** hoặc định nghĩa rõ số ngày, tránh tính lệch.
- Thiết kế audit + idempotency để tránh gia hạn hai lần khi nhấn lại/timeout.
- Thử trên môi trường độc lập với tài khoản thử; sao lưu và kiểm tra khôi phục dữ liệu.
- Không thay đổi `devices`, `claim_device`, `admin_reset_device` hoặc các giấy phép đang cấp.
