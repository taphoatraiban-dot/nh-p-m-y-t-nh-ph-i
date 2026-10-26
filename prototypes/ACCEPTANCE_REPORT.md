# Báo cáo nghiệm thu cục bộ — Trung tâm quản lý khách hàng

**Ngày rà soát:** 26/10/2026 · **Nhánh:** `prototype/owner-customer-center`

## Kết luận

**Đạt kiểm thử cục bộ trong phạm vi bản mẫu**, nhưng **chưa đạt điều kiện phát hành** vì chưa kiểm thử hình ảnh trên trình duyệt thật, chưa có Supabase thử nghiệm và chưa nghiệm thu bằng hai tài khoản Admin thật.

## Phạm vi đã kiểm tra

| Nhóm | Kết quả |
|---|---|
| Giao diện tổng quan và danh sách khách mẫu | Đạt kiểm thử mã/DOM giả lập |
| Tìm kiếm, lọc, sắp xếp, xóa bộ lọc | Đạt kiểm thử DOM giả lập |
| Hồ sơ chi tiết: bản quyền, thiết bị, lịch sử | Đạt kiểm thử DOM giả lập |
| Admin 1 và Admin 2 có quyền tương đương | Đạt mô phỏng RPC |
| Khách thường bị từ chối | Đạt mô phỏng RPC |
| Không chuyển API key/PIN vào dữ liệu giao diện | Đạt kiểm thử adapter |
| Chuyển phiên không giữ lại kết quả cũ | Đạt kiểm thử adapter |
| Đăng nhập và PIN của mã hiện có | Đạt bộ kiểm thử hiện có |
| SQL chỉ đọc và loại trừ tài khoản chủ sở hữu | Đạt kiểm tra cấu trúc; **chưa chạy SQL** |
| Bố cục trên Safari/Chrome thật | Chưa kiểm chứng |
| RLS/RPC với tài khoản Admin thật | Chưa kiểm chứng |

## Kết quả chạy lại bộ kiểm thử toàn repo

Lệnh: `node --test tests/*.test.cjs tests/parser-regression.cjs`

- **14 tệp kiểm thử:** 13 đạt, 1 lỗi.
- Lỗi tại `tests/reconcile-preview.test.cjs`: phép thử so sánh tệp `doi-soat-thu.html` với nội dung do `build()` tạo ra. Có sự khác biệt chuỗi bắt đầu tại ký tự 10.432 (độ dài 14.694 so với 14.699 ký tự).
- Lỗi này đã xuất hiện trong lần chạy ban đầu ở commit `3492811`, **trước khi** tạo các tệp quản lý khách hàng. Không thay đổi mã đối soát trong phạm vi công việc này.
- Bộ kiểm thử trọng tâm Admin + đăng nhập + PIN: **8/8 tệp đạt**.

## Điều kiện trước khi có thể phát hành

1. Chủ phần mềm duyệt giao diện và hành vi thao tác.
2. Có môi trường thử nghiệm tách biệt, không sử dụng dữ liệu khách hàng thật.
3. Thử đăng nhập và phân quyền với hai Admin và một tài khoản khách thử nghiệm.
4. Rà soát lại quyền RPC, RLS, cấp quyền hàm và phương án quay lui khi triển khai SQL.
5. Kiểm tra bố cục và tương tác thực tế trên iPhone Safari và trình duyệt máy tính.
6. Khắc phục hoặc chấp nhận có ghi nhận lỗi nền `reconcile-preview` trước khi đặt điều kiện xanh toàn bộ CI.
7. Duyệt riêng việc đẩy GitHub, thay đổi Supabase và phát hành sản xuất.

## Giới hạn an toàn đã duy trì

- Chỉ làm việc trên nhánh cục bộ riêng, không sửa nhánh `main` ở GitHub.
- Chưa chạy migration hoặc SQL đề xuất.
- Không kết nối dữ liệu thật vào bản mẫu HTML.
- Không sửa trạng thái hai tài khoản Admin, giấy phép, thiết bị, dữ liệu khách, Telegram hoặc VPS.
