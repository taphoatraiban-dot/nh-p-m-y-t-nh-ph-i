# Tích hợp sao lưu phơi: điều kiện bắt buộc trước khi bật

Trạng thái: **chưa tích hợp vào in Wi-Fi hoặc bản chính**.

## Luồng ghi an toàn
1. Sau khi ứng dụng đã tạo một phiếu có `id` ổn định, `created_at` dạng ISO có múi giờ và đã lưu phiếu vào danh sách quản lý in, gọi `queue.enqueue(receipt, authUser.id)` **trước khi gửi lệnh in**. Không được chặn việc in khi mạng Supabase lỗi.
2. Gọi `queue.flush()` khi có kết nối, sau khi đăng nhập và khi ứng dụng hoạt động trở lại. Hiển thị số phiếu đang chờ và lỗi đồng bộ. **Không báo "đã sao lưu" chỉ vì đã enqueue.**
3. Sau đăng nhập, gọi `restore({supabase,userId:authUser.id})`, so sánh theo ID, hợp nhất với phiếu hiện có; không xóa hay thay thế toàn bộ danh sách in. Chỉ hiển thị phơi của hôm nay/hôm qua theo Asia/Ho_Chi_Minh.
4. Khi khách chuyển tài khoản, không được tải dữ liệu tài khoản trước. Mọi truy vấn dùng auth.uid và RLS; hàng đợi offline gắn userId riêng.
5. Với iOS Wi-Fi ESC/POS, điểm tích hợp phải nằm **trước** TCP send, ngay sau bước lưu phiếu; không dựa vào phản hồi TCP để quyết định có sao lưu hay không.
6. Trước khi phát hành: kiểm thử in thật qua Wi-Fi, tắt mạng rồi in, bật mạng đồng bộ, đóng/mở app, cài lại app, đăng nhập và phục hồi; kiểm thử hai tài khoản, trùng ID, qua 00:00 giờ Việt Nam, phiếu quá hạn.
7. Phải có tác vụ dọn bản ghi **trên máy chủ** sau khi kết thúc ngày hôm qua theo giờ Việt Nam. Lọc phía ứng dụng không tương đương xóa dữ liệu.
8. Chỉ chạy migration và dọn dữ liệu sau khi có sao lưu database và xác nhận chính sách RLS, tránh ảnh hưởng dữ liệu hiện hữu.

## Chú ý
Bản mã thử nghiệm chỉ là thư viện dùng khi tích hợp. Chưa có bảng `phoi_recent_backups` trên production, chưa có lịch dọn tự động, chưa có kiểm thử end-to-end, và chưa bật tính năng cho khách.

## Kiểm tra cơ sở dữ liệu thật (04/11/2026, chỉ đọc)

Dự án production `zigpqddlhvjbjrwhfhaa` hiện có `public.printed_phoi` và `public.print_queue`; chưa có `public.phoi_recent_backups`. `printed_phoi` chứa `id` bigint, `user_id` uuid, `phoi_key`, `phoi_text`, `created_at`, `deleted` và các tổng tiền. `print_queue` chứa `print_text`, `created_at`, `printed_at` và trạng thái. Hai bảng có chính sách RLS theo `auth.uid() = user_id`.

**Đã xác minh bảo mật bằng truy vấn chỉ đọc:** `phone_license_guard` trên cả hai bảng có `permissive = RESTRICTIVE` (không phải `PERMISSIVE`). Do đó điều kiện `phone_auth_session_allowed()` được kết hợp AND với các policy chủ sở hữu theo `auth.uid() = user_id`; không phát sinh đường OR bỏ qua chủ sở hữu từ policy này. Hàm `phone_auth_session_allowed()` kiểm tra phiên đăng nhập và hạn sử dụng của tài khoản SĐT. Không cần thay đổi policy production vì nghi ngờ ban đầu. Vẫn phải kiểm thử hai tài khoản trước khi phát hành.

**Tích hợp thực tế:** Không tự suy diễn `TSH_PRINT_HISTORY_V1` tương đương `printed_phoi`. Cần xác định nơi ghi phiếu trong `index.html` và mối liên hệ ID trước khi bật adapter. Giữ nguyên bản ghi `printed_phoi` và `print_queue`; không chạy thao tác xóa hoặc migration lên production cho đến khi kiểm thử staging đạt.


## Independent deletion markers (draft)
The backup client now queries `phoi_recent_backup_deletions` before upload and restore.
A deletion is upserted to that table even when the original snapshot was never uploaded.
Both tables must be provisioned together on staging before enabling the feature.
Never enable the new helper against production before verifying RLS, account switching,
offline retries, and race conditions. A check-then-upsert is not atomic: a concurrent
backup request can still race with deletion, so a server-side enforcement trigger or
transactional RPC is required before release. The deletion marker table also needs a
retention policy; do not purge markers while stale upload queues may still retry.


## Concurrency test required before release
The draft migration now uses matching transaction-scoped advisory locks in the
backup validation trigger and deletion-marker insert trigger. Verify with two
authenticated staging sessions using the same account/receipt:
1. Hold a backup insert transaction open, then insert its deletion marker in
   another session; confirm the deletion waits and eventually commits.
2. Reverse the order: hold the deletion-marker transaction open, then attempt
   the backup insert; confirm the backup is rejected after the marker commits.
3. Confirm a different account with the same receipt ID remains independent.
4. Confirm a stale backup retry cannot clear an existing deletion marker.
5. Verify the RLS policies reject cross-account reads and writes.
Do not infer these guarantees from unit tests alone. Run on staging first.
