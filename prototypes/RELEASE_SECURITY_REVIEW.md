# Rà soát an toàn trước phát hành — Trung tâm quản lý khách hàng

**Ngày:** 26/10/2026. **Chỉ kiểm tra đọc** Supabase sản xuất và GitHub Actions; không thực hiện thay đổi dữ liệu, schema, cấu hình hoặc website.

## 1. Tình trạng kiểm thử

- Bản ứng viên cục bộ đã qua 15/15 nhóm kiểm thử tập trung, có thử bản đề xuất SQL trên PGlite 18.6.
- Workflow GitHub của commit ứng viên `c521ec3` thất bại tại `tests/reconcile-preview.test.cjs`: 430 bài đạt, 1 bài lỗi. Đây là lỗi đã ghi nhận trước chức năng quản lý khách hàng; không được ghi nhận là toàn bộ CI đã xanh.
- Chưa xác minh UI trên trình duyệt thật, đăng nhập Supabase Auth thật, quyền RPC/RLS trên PostgreSQL 17 sản xuất.
- **Bổ sung kiểm thử quyền cục bộ:** PostgreSQL WASM đã kiểm thử `SET ROLE authenticated` gọi hai RPC qua `SECURITY DEFINER` khi là Admin; người đăng nhập không được đọc thẳng bảng audit; `anon` không có quyền `EXECUTE`; tài khoản khách dưới role `authenticated` bị RPC từ chối. Bản SQL đọc và ghi đều có `ROLLBACK` bảo vệ. Đây là kiểm tra mô phỏng `auth.uid()` bằng tham số phiên nội bộ, **không phải JWT Supabase thật**.

## 2. Cảnh báo Supabase hiện hữu (read-only advisors)

**Security:**

| Loại | Mức | Số ghi nhận | Tham khảo |
|---|---|---:|---|
| RLS bật nhưng không có policy | INFO | 23 | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy |
| Extension `pg_net` ở schema public | WARN | 1 | https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public |
| Hàm `SECURITY DEFINER` có thể gọi bởi người đăng nhập | WARN | 41 | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable |
| Bảo vệ mật khẩu lộ lọt | WARN | 1 | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection |

**Performance:**

| Loại | Mức | Số ghi nhận |
|---|---|---:|
| Foreign key thiếu index hỗ trợ | INFO | 12 |
| Hàm Auth trong RLS bị đánh giá lặp | WARN | 24 |
| Index chưa ghi nhận sử dụng | INFO | 3 |
| Nhiều permissive policy cùng phạm vi | WARN | 10 |

Đây là các cảnh báo ở thời điểm đọc; **không được suy diễn rằng tất cả là lỗ hổng**, và không tự sửa chúng trong phạm vi dự án này. Chức năng mới phải được đánh giá riêng về `SECURITY DEFINER`, `EXECUTE`, quyền trực tiếp trên bảng và RLS.

## 3. Phương án sao lưu và quay lui — đề xuất, chưa thực hiện

1. Trước khi triển khai phải chụp danh sách phiên bản schema, định nghĩa `claim_device`, `admin_reset_device`, `admin_set_license_paused`, `check_email_license`, grants, RLS, counts; tạo **bản sao lưu thực tế và kiểm tra khả năng khôi phục** bằng công cụ quản trị được chủ sở hữu phê duyệt.
2. Không sao chép bản backup chứa dữ liệu khách, PIN, token hoặc khóa API vào tài liệu, GitHub hay môi trường giả lập.
3. Tạo migration thật từ SQL `review_only` sau khi kiểm tra độc lập trên PostgreSQL tương thích. Chạy schema và RPC trước; không bật nút ghi trước khi xác thực Admin/khách đều đạt.
4. Bật giao diện bằng cờ phát hành được chủ sở hữu duyệt. Theo dõi lỗi và audit từ Admin 1/2; kiểm thử tài khoản thường không thấy chức năng.
5. Nếu lỗi: tắt giao diện/nút ghi trước, thu hồi `EXECUTE` của RPC mới khi cần, kiểm tra nhật ký và dữ liệu ảnh hưởng, **khôi phục bằng bản sao lưu có chọn lọc**, không xóa lịch sử hoặc reset toàn bộ database.
6. Không tự `DROP` bảng nhật ký/bản lưu thiết bị sau khi có thao tác thật; phải xét lưu trữ và tuân thủ. Việc quay lui chức năng không được làm mất lịch sử thao tác đã phát sinh.

## 4. Quyết định chưa được phê duyệt

- [ ] Duyệt SQL thật, quyền, kế hoạch backup và khả năng khôi phục Supabase sản xuất.
- [ ] Duyệt thao tác đặt lại thiết bị: sao lưu hàng `devices` rồi xóa liên kết hiện hành để `claim_device` có thể nhận máy mới.
- [ ] Duyệt kết quả kiểm thử trên Auth/RLS và trình duyệt thật, quyết định xử lý lỗi CI nền.
- [ ] Duyệt merge `main` và triển khai website/VPS **riêng biệt**.

Tình trạng hiện tại: **NO-GO cho production**. Tiếp tục hoàn thiện và kiểm thử trên nhánh riêng.
