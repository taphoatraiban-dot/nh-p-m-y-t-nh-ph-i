# Phiếu duyệt SQL Supabase — Trung tâm quản lý khách hàng

**Trạng thái: CHỜ CHỦ SỞ HỮU DUYỆT. KHÔNG ĐƯỢC CHẠY SQL SẢN XUẤT TỪ PHIẾU NÀY.**

Ngày rà soát: 26/10/2026. Dự án sản xuất dự kiến: `zigpqddlhvjbjrwhfhaa`.
Mô hình: một chủ sở hữu với **hai tài khoản Admin hiện hữu, tách biệt**, cùng quyền.

## 1. Chính xác những gì đề nghị thay đổi

| Thứ tự phụ thuộc | Nguồn SQL review-only | Đối tượng tạo mới | Đối tượng hiện hữu chịu tác động khi Admin dùng chức năng |
|---|---|---|---|
| 1 | `sql/admin_customer_command.review_only.sql` | 3 bảng `admin_customer_revisions`, `admin_customer_commands`, `admin_device_reset_history`, các chỉ mục, hàm `admin_customer_command` | `email_licenses.expires_at`, `email_licenses.active`, `email_licenses.updated_at`; đặt lại thiết bị: lưu lịch sử rồi xóa **liên kết hiện hành** trong `devices` |
| 2 | `sql/admin_customer_overview.proposal.sql` | Hàm chỉ đọc `admin_customer_overview` | Không ghi vào bảng hiện hữu |
| 3 | `sql/admin_customer_audit.review_only.sql` | Hàm chỉ đọc `admin_customer_audit` | Không ghi vào bảng hiện hữu |

**Lưu ý:** Ba tệp hiện tại đều dùng `BEGIN ... ROLLBACK`; chạy nguyên trạng sẽ không triển khai gì. Chúng là bản để xem và kiểm thử, **không phải migration phát hành**. Chỉ sau khi chủ sở hữu duyệt mới tạo migration có `COMMIT` theo quy trình được kiểm soát.

**Bản rà soát SQL gộp:** chạy `node scripts/build-customer-center-sql.cjs` từ thư mục dự án để in ra toàn bộ SQL theo đúng thứ tự phụ thuộc trong **một giao dịch `BEGIN ... ROLLBACK`**. Công cụ không có chế độ triển khai hoặc `COMMIT`. Bài kiểm thử PostgreSQL cục bộ xác nhận giao dịch nguyên trạng không lưu bảng/hàm, sau đó diễn tập bản `COMMIT` **chỉ trong cơ sở dữ liệu giả**.

Không đề nghị xóa/sửa hai tài khoản Admin, thay cấu trúc bảng cũ, sửa RPC cũ, di chuyển khách hàng hoặc đặt lại hạn dùng hàng loạt.

## 2. Các quyết định chức năng được áp dụng

1. **Gia hạn:** tài khoản còn hạn cộng số ngày vào hạn hiện tại; đã hết hạn tính từ thời điểm máy chủ thực hiện. Mỗi lệnh 1–365 ngày; không tự bỏ tạm ngưng.
2. **Tạm ngưng/kích hoạt lại:** chỉ đổi cờ `email_licenses.active`, không xóa giấy phép.
3. **Đặt lại thiết bị — ĐÃ ĐƯỢC CHỦ SỞ HỮU CHẤP THUẬN VỀ CƠ CHẾ:** trước khi xóa hàng `devices` hiện hành, sao lưu đầy đủ thông tin liên kết sang `admin_device_reset_history` **trong cùng giao dịch**. `claim_device` hiện chỉ chấp nhận máy mới khi không còn hàng cũ. Quyết định này **không phải quyền thi hành SQL trên sản xuất**.
4. **Khách chờ đăng ký:** chỉ xem; không tự tạo tài khoản hay giấy phép.
5. **Nhật ký:** lưu Admin thực hiện, UUID yêu cầu, khách, hành động, lý do, phiên bản và thời điểm; chống gia hạn lặp bằng UUID duy nhất.

## 3. Điều kiện bảo mật bắt buộc

- RPC tự đối chiếu `auth.uid()` với `admin_users`; không tin `user_metadata` hay mã Admin do trình duyệt gửi.
- Không được quản lý hai Admin như khách. Khách và `anon` bị từ chối ở mức cơ sở dữ liệu.
- Bảng mới bật RLS, không cấp quyền đọc/ghi trực tiếp qua API; RPC là cổng có kiểm tra quyền và nhật ký.
- Các hàm `SECURITY DEFINER` trong schema `public` là **ngoại lệ có chủ đích cần xem xét an ninh riêng**. `authenticated` vẫn có `EXECUTE`, dù bên trong hàm kiểm tra `admin_users`, nên Supabase Advisor có thể báo cảnh báo. Phải kiểm tra owner, quyền thực thi, `search_path`, lệnh gọi trực tiếp bằng khách thường và kết quả Security Advisor trước khi phát hành.
- Không gắn service role key, PIN, mật khẩu, session token hay dữ liệu riêng khác vào các RPC mới.

## 4. Cửa kiểm tra trước khi thi hành

**Không đủ điều kiện chỉ với kiểm thử máy cục bộ.** Trước mọi triển khai phải hoàn thành:

1. Xác nhận đúng project ref và chụp lại schema/RPC/quyền/index đang chạy ở thời điểm thực hiện; xác nhận không có đối tượng trùng tên.
2. Có bản sao lưu *đã xác minh có thể phục hồi* cho `email_licenses`, `devices`, `admin_users`, `profiles`, `pending_email_licenses` và schema/function liên quan. Xác định rõ cách phục hồi theo gói dịch vụ Supabase thực tế; **không mặc định có PITR hoặc backup trên gói Free**.
3. Tạo bản SQL triển khai có thể xem diff (không dùng trực tiếp các tệp `ROLLBACK`); kiểm tra quyền sở hữu và grants theo người thi hành thực tế.
   CLI Supabase chưa có trong môi trường phát triển hiện tại; không tự đặt tên tệp migration thay cho lệnh `supabase migration new` được Supabase hướng dẫn.
4. Diễn tập trên Postgres/Supabase thử nghiệm tách biệt với dữ liệu giả: hai Admin, khách, `anon`, hết hạn/còn hạn, gửi trùng UUID, thao tác đồng thời, ngắt kết nối, khóa phiên, đổi máy và khôi phục.
5. Chạy lại advisor bảo mật/hiệu năng, so sánh cảnh báo mới với cảnh báo có sẵn; ghi nhận ngoại lệ `SECURITY DEFINER` nếu vẫn sử dụng thiết kế hiện tại.
6. Được chủ sở hữu cho phép **riêng** việc thi hành SQL sản xuất, với đúng bản migration đã trình và cửa sổ thực hiện.

## 5. Phương án quay lại

- **Trước khi có lệnh ghi:** có thể thu hồi `EXECUTE` ba RPC quản trị mới để khóa chức năng, sau đó xem xét xóa hàm và bảng mới nếu chắc chắn chưa có nhật ký cần giữ. Không tự xóa các bảng lịch sử.
- **Sau khi đã có lệnh ghi:** `DROP TABLE` đơn thuần **không hoàn tác gia hạn/tạm ngưng hoặc đặt lại thiết bị**. Phải dùng nhật ký `admin_customer_commands`, `admin_device_reset_history`, bản sao lưu đã kiểm chứng và biên bản từng giao dịch để đối soát. Cần khóa đường ghi, ngừng hoạt động liên quan và lên kế hoạch khôi phục có giám sát.
- Không phục hồi đè toàn bộ production, không tự xóa nhật ký, không tự ghi lại hàng `devices` nếu chưa kiểm tra khách đã liên kết máy mới hay chưa.
- Website/VPS là **cổng phê duyệt thứ hai**, không được gộp vào quyền duyệt SQL.

## 6. Bằng chứng hiện có và điều chưa đạt

- Các tệp SQL review-only nguyên trạng kết thúc bằng `ROLLBACK`.
- Kiểm thử đã đạt trên PGlite/PostgreSQL WASM 18.6 với dữ liệu giả và quyền `anon`/`authenticated` giả lập; không thay thế Supabase Auth/JWT/RLS thật hay thử phục hồi backup thật.
- Chưa kiểm thử trình duyệt thật, chưa có staging cloud, chưa triển khai Supabase, chưa cập nhật `main` hoặc VPS.

## 7. Hai lựa chọn cần chủ sở hữu xác nhận riêng

**A — SQL:** Tôi đã đọc và duyệt **phạm vi thay đổi SQL nêu trên**, bao gồm sao lưu có kiểm tra, tạo 3 bảng mới, 3 RPC và cơ chế sao lưu-rồi-xóa liên kết thiết bị khi Admin đặt lại. Tôi hiểu đây là phạm vi để **chuẩn bị triển khai**, không phải lệnh thi hành ngay.

**B — Triển khai:** Chỉ sau khi xem kết quả diễn tập và bản migration cuối cùng, chủ sở hữu mới xác nhận **thi hành SQL lên Supabase sản xuất** bằng một chỉ đạo riêng. Merge `main` và triển khai website/VPS cần **phê duyệt riêng lần nữa**.

**Trạng thái hiện tại:** chủ sở hữu đã xác nhận cơ chế lưu lịch sử rồi xóa liên kết thiết bị hiện hành. **Chưa có phê duyệt A/B cho sản xuất.**
