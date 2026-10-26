# Trung tâm quản lý khách hàng — bản ứng viên tích hợp

**Chưa phát hành. Không merge `main`, không chạy SQL trên sản xuất, không triển khai VPS/website.**

## Tình trạng mã

- `src/admin-customer-live-panel.js`: giao diện đọc và ghi qua RPC dự kiến, **không cập nhật bảng từ trình duyệt**. Cần `?admin_center_candidate=1` trên bản nhánh thử nghiệm và quyền Admin mới hiển thị nút mở.
- Bản `index.html` **cục bộ trên nhánh** có một script tham chiếu module này; `main` GitHub chưa thay đổi. Không tự bỏ cờ ứng viên để hiển thị cho người dùng sản xuất.
- Dùng `check_email_license` để xác định Admin trước khi đọc và trước khi gửi thao tác; phía máy chủ còn phải độc lập kiểm tra `auth.uid()` trong `admin_users`.
- `admin_customer_overview` trả thêm `revision` từ bảng mới; tài khoản chờ đăng ký không có lệnh ghi.
- `admin_customer_command` nhận mã yêu cầu UUID, `expected_revision`, thao tác, số ngày và lý do; trình duyệt không truyền danh tính Admin để cấp quyền.
- Phiên xác thực hoặc trạng thái khóa thay đổi sẽ đóng panel và loại bỏ dữ liệu đang hiển thị.

## Điều kiện để có thể kiểm thử kết nối thật

1. Rà soát và duyệt bản SQL tạo bảng, cấp quyền RPC ở môi trường thử nghiệm tách biệt, trong thứ tự: bảng/revisions/commands → RPC ghi → RPC đọc mới.
2. Tạo hai Admin thử nghiệm và một khách thử nghiệm. Không dùng tài khoản hoặc dữ liệu sản xuất để nghiệm thu thao tác.
3. Dùng trình duyệt thật kiểm tra tất cả thao tác, mất mạng, logout, khóa, đổi phiên, gửi lệnh trùng và thao tác đồng thời.
4. Đối chiếu công thức gia hạn và hành vi đổi thiết bị của hệ thống hiện có.
5. Sửa hoặc phê duyệt ngoại lệ đối với lỗi nền `reconcile-preview` đang đỏ trên GitHub Actions; không coi 100% kiểm thử tập trung là CI toàn kho đạt.

## Kết quả hiện tại

- Kiểm thử DOM giả và hợp đồng RPC cục bộ: đạt trong phạm vi mô phỏng.
- Thử SQL đọc/ghi phối hợp: đạt trên PGlite/PostgreSQL WASM 18.6 với dữ liệu giả.
- **Chưa kiểm chứng** trên Supabase Auth/RLS, PostgreSQL 17 của dự án sản xuất, Safari/Chrome thật hoặc luồng mạng thực tế.

## Cổng phê duyệt

- Cổng A: chủ sở hữu duyệt SQL, grants, backup và rollback Supabase riêng.
- Cổng B: chủ sở hữu duyệt merge `main` và triển khai website/VPS riêng.
- Mỗi cổng phải được xác nhận bằng hành động/phê duyệt cụ thể, không suy ra chỉ từ yêu cầu hoàn thiện giao diện.
