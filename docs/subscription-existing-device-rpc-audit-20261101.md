# Đối chiếu thực tế Supabase — 01/11/2026 (chỉ đọc)

Dự án: `zigpqddlhvjbjrwhfhaa`. Không sửa dữ liệu hay thực thi migration.

## Xác minh schema
- `auth.sessions` tồn tại các cột `id uuid`, `user_id uuid`, `not_after timestamptz`, `refreshed_at timestamp`.
- RPC hiện hữu: `claim_device(p_device_id text, p_device_name text)`, `admin_reset_device(p_user_id uuid)`.
- RPC bản quyền hiện hữu: `check_license()`, `check_email_license()`, `member_access_status()`, `member_start_trial()`, `admin_activate_license(...)`.
- `claim_device`, `admin_reset_device`, `check_email_license`, `member_access_status` đều có `SECURITY DEFINER` theo pg_proc.
- Chưa kiểm chứng nội dung function, grants EXECUTE và policies RLS của các RPC này. Không được coi chúng là an toàn chỉ từ tên gọi.

## Rủi ro tích hợp
1. Migration `20261101001000_stage_single_session_gate.sql` tạo hệ thống `ott_account_sessions` mới, trong khi ứng dụng đang có `devices` và `claim_device`. Không triển khai song song cho đến khi làm rõ nguồn dữ liệu chính.
2. `subscription_session_is_current()` hiện chỉ là hàm kiểm tra, chưa được gọi từ tất cả API/RPC. Chưa chặn được phiên cũ trên toàn hệ thống.
3. Cần kiểm tra `auth.sessions.not_after` và cơ chế logout/revocation thực tế; không coi sự tồn tại bản ghi session là phiên luôn còn hiệu lực.
4. Phải xác định quyền admin ở server trước khi áp dụng giới hạn. Không khóa hai tài khoản quản trị.
5. Bảo vệ giấy phép cũ, quyền vĩnh viễn, dữ liệu phơi, Telegram và QR.

## Quyết định kỹ thuật tạm thời
**Chặn chạy migration single-session lên production**. Trước tiên kiểm toán định nghĩa `claim_device`, `admin_reset_device`, `check_license`, chính sách RLS và vị trí ứng dụng gọi các RPC. Sau đó lựa chọn *một* cơ chế duy nhất, có kế hoạch chuyển đổi/rollback và test nhiều phiên thực tế.

## Các bước kiểm thử bắt buộc
- Test login A/B trên hai điện thoại và Safari bị xóa dữ liệu.
- Đăng nhập cùng một tài khoản trên trình duyệt máy tính; xác nhận phạm vi quy tắc một điện thoại.
- Truy cập thẳng API cũ từ phiên A sau khi B chuyển quyền.
- Kiểm tra quyền admin, khách cũ và giấy phép vĩnh viễn.
- Test hai lần chuyển trong 30 ngày, lần thứ ba bị chặn và reset admin có audit.
- Test lại Telegram, tính phơi, in và QR.
