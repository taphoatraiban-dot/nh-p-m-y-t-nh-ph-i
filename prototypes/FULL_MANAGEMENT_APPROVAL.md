# Hồ sơ phê duyệt — quản lý khách hàng đầy đủ

**Trạng thái:** đang phát triển và kiểm thử cục bộ. **Không** phải tài liệu cho phép thi hành SQL, merge, hoặc triển khai sản xuất.

## Phạm vi chức năng dự kiến

| Chức năng | Hành vi kỳ vọng | Bảo vệ dữ liệu |
|---|---|---|
| Xem và lọc tài khoản | Dữ liệu chỉ đọc; Admin 1/2 cùng quyền | RPC kiểm tra Admin; loại trừ chủ sở hữu |
| Gia hạn | Cộng số ngày đã duyệt vào hạn dùng | Không tự đổi số ngày/hạn khi kiểm tra quyền lỗi |
| Tạm ngưng | Ngừng quyền sử dụng, vẫn giữ thông tin | Không xóa giấy phép hoặc khách |
| Kích hoạt lại | Bỏ trạng thái tạm ngưng | Không tự ý tạo giấy phép mới |
| Đặt lại thiết bị | Cho khách đăng ký lại thiết bị | Ưu tiên vô hiệu hóa liên kết + nhật ký, **không xóa cứng** |
| Nhật ký | Ghi người thao tác (Admin 1 hay Admin 2), thời điểm, lý do, kết quả | Lưu trên máy chủ, không tin giá trị actor từ trình duyệt |

## Đã viết và kiểm thử cục bộ

- `src/admin-customer-commands.cjs` là **hợp đồng phía client** cho RPC tương lai `admin_customer_command`; chưa được tích hợp vào website chính.
- `tests/admin-customer-commands.test.cjs` dùng RPC giả lập trong bộ nhớ, không kết nối Supabase và không dùng credential.
- `src/admin-customer-renewal.cjs` và bài kiểm thử tương ứng biểu diễn **quy tắc gia hạn đã được chủ sở hữu lựa chọn**; đây chỉ là phép tính kiểm thử ở client, không phải nguồn tính toán có thẩm quyền.
- `prototypes/admin-customer-center.html` có mục **“Thử thao tác (giả lập)”**: nhập email xác nhận, lý do, số ngày; xem thay đổi trên bản ghi mẫu và nhật ký gắn Admin 1/2. Tất cả thay đổi nằm trong bộ nhớ trang, mất khi tải lại. Các nút thao tác thật vẫn `disabled` và không gọi API.
- `tests/admin-customer-ui-logic.test.cjs` kiểm thử biểu mẫu giả lập bị từ chối khi nhập sai email, nhật ký gắn đúng Admin, thiết bị mẫu được cập nhật và khách không thể thao tác.
- `sql/admin_customer_audit.review_only.sql` là đề xuất RPC đọc nhật ký có kiểm tra quyền Admin và giới hạn số dòng, không cấp quyền đọc trực tiếp bảng audit. Đã thử thành công trên PostgreSQL cục bộ với cả role `authenticated` và `anon`; file này cũng kết thúc bằng `ROLLBACK`.
- Các lệnh chỉ chấp nhận `extend`, `pause`, `resume`, `reset_device`.
- Trước thao tác yêu cầu nhập đúng email, lý do 10–500 ký tự, phiên bản khách hàng (`revision`), và số ngày hợp lệ (gia hạn từ 1 đến 365).
- Trước RPC ghi phải xác nhận quyền Admin bằng RPC đọc hiện có; khi lỗi hoặc đổi phiên không được tuyên bố thành công.
- RPC dự kiến nhận mã yêu cầu duy nhất để chống gửi lặp; máy chủ phải lưu và thực thi tính duy nhất bằng giao dịch.

## Hợp đồng RPC đề xuất — CHƯA TỒN TẠI TRÊN SUPABASE

**Đã đối chiếu schema thực tế ở chế độ chỉ đọc (26/10/2026):** `email_licenses` có `user_id`, `expires_at`, `active`, `updated_at` nhưng không có `revision`; `devices` có một hàng/user (`user_id` là khóa chính) và cờ `active`. RPC hiện tại `admin_reset_device` **xóa** hàng `devices`; `claim_device` chỉ cho thiết bị mới khi không còn hàng cũ, kể cả hàng đã `active=false`. Vì vậy chỉ đổi `active=false` **không giúp khách đổi máy**. Bản thiết kế giữ nguyên hai RPC cũ và đề xuất RPC mới sao lưu liên kết vào bảng lịch sử rồi mới xóa hàng hiện hành trong một giao dịch.

SQL tham khảo: `sql/admin_customer_command.review_only.sql` — **cố ý kết thúc bằng `ROLLBACK`, không phải migration dùng để triển khai**. `tests/admin-customer-command-sql-contract.test.cjs` kiểm tra cấu trúc tĩnh; bài thử PostgreSQL cục bộ được ghi ngay sau đây.

**Cập nhật kiểm thử PostgreSQL cục bộ:** `tests/admin-customer-postgres.test.cjs` đã chạy đạt trên PGlite 0.5.11 (PostgreSQL WASM 18.6) vào 26/10/2026. Bài thử kiểm tra: tệp SQL nguyên trạng `ROLLBACK` không để lại bảng; bản sao SQL trong bộ nhớ đổi sang `COMMIT` trên cơ sở dữ liệu giả tạo được hàm/bảng, gia hạn, idempotency, phát hiện phiên bản cũ, Admin 1/2, từ chối khách, chặn đụng Admin, sao lưu thiết bị trước khi xóa liên kết. **Đây không phải chứng nhận trên Supabase Auth/RLS hoặc PostgreSQL 17 của sản xuất.**

Chạy độc lập với gói PGlite được cài vào thư mục tạm (không cài trong repo):

```sh
PGLITE_MODULE_PATH=/duong-dan-cuc-bo/node_modules/@electric-sql/pglite node tests/admin-customer-postgres.test.cjs
```

Tên: `admin_customer_command`.

Tham số: `p_request_id` (UUID), `p_action` (enum kiểm chứng ở máy chủ), `p_user_id` (UUID khách), `p_expected_revision` (bigint), `p_days` (integer hoặc null), `p_reason` (text).

Phản hồi thành công: `{ "success": true, "revision": <phiên bản mới> }`. Lỗi phải trả mã rõ ràng, không tiết lộ bí mật. RPC phải:

1. Xác định **Admin thật từ `auth.uid()` và bảng quyền tin cậy**, không nhận `p_actor_id` từ trình duyệt.
2. Không cho Admin tác động chính hai tài khoản chủ sở hữu; không cấp quyền cho khách thường/anon.
3. Khóa hàng khách, so sánh `p_expected_revision` và chỉ cập nhật khi đúng phiên bản; thực hiện cùng giao dịch với nhật ký.
4. Ràng buộc duy nhất `p_request_id` và lưu kết quả để lệnh lặp không làm gia hạn hai lần.
5. Ghi nhật ký riêng: người thực hiện, thao tác, mục tiêu, thời gian, lý do, mã yêu cầu, phiên bản trước/sau; không lưu token/PIN/khóa.
6. Thu hồi quyền `EXECUTE` mặc định `PUBLIC`, cấp tối thiểu cho `authenticated`, áp dụng kiểm tra quyền bên trong RPC; kiểm tra RLS và quyền người sở hữu hàm.
7. Dùng cơ chế đặt lại thiết bị có thể phục hồi, không `DELETE` trực tiếp từ giao diện quản trị.

## Những quyết định cần chủ sở hữu duyệt trước khi chốt SQL

1. **ĐÃ CHỐT — Gia hạn:** nếu hạn cũ đã qua thì tính từ thời điểm gia hạn; nếu còn hạn thì cộng vào hạn cũ. Công thức `max(hạn cũ, thời điểm thực hiện) + số ngày`, với đơn vị ngày là 24 giờ liên tiếp và thời gian lưu UTC. Không tự động bỏ trạng thái tạm ngưng. Phép tính quyết định phải nằm trong giao dịch Postgres dùng đồng hồ máy chủ và hàng đã khóa; **không tin `expires_at` hoặc thời gian do trình duyệt gửi**.
2. **Đặt lại thiết bị:** do `claim_device` hiện không chấp nhận máy mới khi hàng thiết bị cũ còn tồn tại, đề xuất chép bản ghi cũ sang lịch sử rồi xóa hàng liên kết hiện hành **trong cùng giao dịch**. Cần chủ sở hữu duyệt riêng việc xóa liên kết hiện hành này; dữ liệu thiết bị cũ vẫn tồn tại trong lịch sử mới.
3. **Phạm vi tài khoản:** chỉ tài khoản đã đăng ký hay cho phép chuyển email chờ đăng ký thành giấy phép? Đề xuất xử lý email chờ đăng ký ở luồng riêng để tránh tạo tài khoản nhầm.
4. **Số ngày và xác nhận:** đề xuất tối đa 365 ngày/lần, nhập lại email + lý do và xác nhận trước khi gửi.

## Hai cổng phê duyệt độc lập

### A. Duyệt Supabase

- [ ] Kiểm kê schema và RPC thực tế ở chế độ chỉ đọc, xác nhận chính xác cột dữ liệu/quan hệ.
- [ ] Tạo và duyệt script thay đổi cùng bản rollback, kiểm tra các trường hợp lỗi và quyền RLS/grant.
- [ ] Thử trên cơ sở dữ liệu tách biệt với tài khoản giả; kiểm tra log, idempotency, cạnh tranh giữa Admin.
- [ ] Chủ sở hữu cho phép rõ ràng **thay đổi Supabase sản xuất** ở bước riêng; chưa có phép đó.

### B. Duyệt website/VPS

- [ ] Giao diện thực tế tích hợp với dữ liệu thử, có trạng thái tải/lỗi/xác nhận và kiểm soát phiên.
- [ ] Safari iPhone + Chrome desktop đạt nghiệm thu; phần mềm cũ không bị ảnh hưởng.
- [ ] Có sao lưu và hướng quay lại phiên bản trước.
- [ ] Chủ sở hữu cho phép rõ ràng **merge `main` và triển khai website/VPS** ở bước riêng; chưa có phép đó.

**Không được coi kiểm thử giả lập là bằng chứng RPC, Postgres hay RLS thật đã an toàn.**
