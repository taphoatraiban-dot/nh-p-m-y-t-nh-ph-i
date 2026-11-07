# ÔNG THẦN TÀI — kiểm thử cục bộ Trung tâm quản lý

Trạng thái: **bản mẫu, chưa triển khai**, nhánh `prototype/owner-customer-center`.

Báo cáo tổng hợp kết quả và điều kiện phát hành: `ACCEPTANCE_REPORT.md`.

## Phạm vi đã có

- `admin-customer-center.html`: năm khu vực giao diện, tìm kiếm, lọc, xem chi tiết và chuyển vai trò giả lập.
- Danh sách khách mẫu có sắp xếp theo hạn dùng/email, trạng thái hết hạn, xóa lọc và bố cục thẻ trên màn hình nhỏ.
- Hồ sơ chi tiết tách rõ thông tin tài khoản, bản quyền, thiết bị và lịch sử quản trị; mọi thao tác ghi vẫn khóa.
- `src/admin-customer-overview.cjs`: chuẩn hóa dữ liệu và phân loại trạng thái.
- `src/admin-customer-service.cjs`: lớp đọc dữ liệu với kiểm tra Admin, từ chối truy cập và loại bỏ kết quả cũ khi đổi phiên.
- `tests/admin-customer-ui-logic.test.cjs`: chạy script giao diện với DOM giả lập để xác nhận lọc/sắp xếp, mở hồ sơ và chuyển vai trò.
- `sql/admin_customer_overview.proposal.sql`: **chỉ là đề xuất SQL**, chưa triển khai. Không tự chạy trên production.
- Truy vấn đề xuất loại trừ hai tài khoản Admin khỏi danh sách khách hàng, nhưng không xóa hay thay đổi chúng.
- `src/owner-admin-center.js`: cửa sổ xem giao diện mẫu được nhúng vào `index.html` trên **nhánh cục bộ**; chỉ kích hoạt khi có `?admin_preview=1` và RPC bản quyền xác nhận Admin. Iframe chỉ chứa dữ liệu mẫu, không cần RPC SQL mới.

## Chạy kiểm thử

Tại thư mục gốc bản sao repo:

```sh
node --test tests/admin-customer-*.test.cjs tests/owner-admin-integration.test.cjs tests/login-startup.test.cjs tests/pin-unlock.test.cjs
```

## Giới hạn nghiệm thu

1. Giao diện HTML đang sử dụng **dữ liệu giả**, không gọi Supabase và không lưu dữ liệu.
2. Chuyển vai trò trong giao diện chỉ để **mô phỏng**, không phải cơ chế bảo mật.
3. Các kiểm thử dịch vụ dùng client RPC giả lập. Chưa có kiểm thử trên cơ sở dữ liệu thử nghiệm hay phiên Admin thật.
4. SQL đề xuất cần kiểm tra schema, quyền `EXECUTE`, RLS, trùng dữ liệu email và kế hoạch rollback trước khi duyệt triển khai.
5. Không sửa `index.html` chính, không đẩy GitHub, không chạy migration, không đổi dữ liệu Supabase/VPS.

## Kiểm tra giao diện bằng trình duyệt

- Đã kiểm tra cú pháp script, các `id` duy nhất, sự tồn tại của các phần tử được JS tham chiếu, vai trò mô phỏng và việc khóa nút ghi.
- Đã kiểm thử tương tác bằng DOM giả lập (không phải trình duyệt thực): 4 ca gồm thứ tự hạn dùng, bộ lọc, trang chi tiết, và chuyển vai trò.
- Trình duyệt cloud không cho phép mở `file://` theo chính sách URL, nên **chưa thể tuyên bố đạt QA hình ảnh** ở kích thước điện thoại/máy tính.
- Không tìm đường vượt giới hạn trình duyệt. Bước QA hình ảnh vẫn phải thực hiện qua một kênh mở bản mẫu được cho phép trước khi nghiệm thu.

## Điều kiện trước khi tích hợp thật

- Chủ phần mềm duyệt giao diện và nguồn dữ liệu cần hiển thị.
- Có môi trường Supabase thử nghiệm độc lập hoặc nhánh thử nghiệm được phê duyệt.
- Kiểm thử cả hai Admin và ít nhất một tài khoản thường, bằng dữ liệu thử.
- Kiểm thử không trả API key/PIN/bí mật và không đọc chéo dữ liệu khi không có quyền.
- Chạy lại bộ kiểm thử ứng dụng chính; xử lý hoặc ghi ngoại lệ cho lỗi nền `reconcile-preview` đã được phát hiện từ trước.
