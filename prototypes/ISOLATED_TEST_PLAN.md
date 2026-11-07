# Kế hoạch nghiệm thu trên môi trường tách biệt — Trung tâm quản lý khách hàng

**Trạng thái:** chỉ lập kế hoạch, chưa tạo môi trường, chưa chạy SQL, chưa có phê duyệt triển khai.

**Mức 1 đã thực hiện cục bộ:** `tests/isolated-owner-auth.test.cjs` chạy RPC giả lập hoàn toàn trong bộ nhớ; `tests/owner-admin-overlay-session.test.cjs` chạy lớp phủ bằng DOM giả lập. Không có server, kết nối Internet, credential hay dữ liệu thật. Mô phỏng đã bao phủ AUTH-01…10, gồm khóa ứng dụng, đổi phiên khi màn hình vẫn mở, đăng xuất và refresh token. Đây là kiểm thử logic, **không chứng minh** chính sách RLS, `EXECUTE` grants, cấu hình Auth hoặc tính đúng của SQL trên Postgres. AUTH-09 vẫn cần kiểm tra trên trình duyệt thật.

## 1. Ranh giới bắt buộc

- Không kết nối môi trường thử nghiệm tới project Supabase/VPS/website sản xuất.
- Không sao chép email, danh sách khách, PIN, API key, token, thiết bị hay bản sao cơ sở dữ liệu sản xuất.
- Không sử dụng hai tài khoản Admin sản xuất trong các bài kiểm thử tạo/xóa/sửa dữ liệu.
- Không đổi nhánh `main`, không merge Draft PR #2, không bật triển khai tự động.
- Chỉ tạo tài khoản giả với email thuộc miền kiểm thử do chủ sở hữu kiểm soát; không gửi thư bất ngờ cho người thật.

## 2. Tài nguyên cần phê duyệt riêng

1. Một dự án Supabase *mới, tách biệt* hoặc một bộ Supabase chạy cục bộ; kiểm tra chi phí và khả năng vận hành trước khi chọn.
2. Hai danh tính Admin thử nghiệm (A1, A2) cùng một chủ sở hữu nhưng có `auth.users.id` riêng; một tài khoản khách (C1) không nằm trong danh sách Admin.
3. Dữ liệu giả: 3 khách đã đăng ký, 1 email chờ đăng ký, 2 thiết bị giả. Mọi ID và ngày hết hạn được tạo mới.
4. Bản schema tối thiểu được rà soát phù hợp với RPC đang sử dụng; không lấy dump sản xuất.
5. Cơ chế hủy môi trường và xóa dữ liệu giả sau nghiệm thu, nhưng không thực hiện trước khi có lệnh riêng.

## 3. Ma trận nghiệm thu quyền

| Mã | Phiên thử | Hành động | Kết quả bắt buộc |
|---|---|---|---|
| AUTH-01 | A1 | Gọi RPC kiểm tra Admin | Chỉ A1 được nhận quyền quản trị |
| AUTH-02 | A2 | Gọi RPC kiểm tra Admin | A2 cũng được nhận quyền, định danh khác A1 |
| AUTH-03 | C1 | Gọi RPC lấy tổng quan khách | Từ chối ngay tại cơ sở dữ liệu (không chỉ ẩn giao diện) |
| AUTH-04 | Chưa đăng nhập | Gọi RPC lấy tổng quan khách | Từ chối, không lộ dữ liệu |
| AUTH-05 | A1 | Lấy danh sách | Không chứa A1, A2, PIN, token, khóa hay bí mật |
| AUTH-06 | A2 | Lấy danh sách | Đồng nhất tập dữ liệu với A1, không lẫn quyền riêng |
| AUTH-07 | A1 → C1 | Đổi phiên khi truy vấn đang chờ | Kết quả A1 bị loại bỏ; C1 không tải danh sách |
| AUTH-08 | C1 → A2 | Đăng nhập lại | Chỉ dữ liệu được xác thực bằng phiên A2 mới hiển thị |
| AUTH-09 | A1/A2 | Đăng xuất hoặc khóa ứng dụng | Đóng giao diện, xóa dữ liệu nhạy cảm đang hiển thị |
| AUTH-10 | C1 | Thử gọi RPC trực tiếp, không qua UI | Vẫn bị từ chối bởi chính RPC/RLS/grants |

## 4. Nghiệm thu chức năng và bố cục

| Mã | Khu vực | Kiểm tra |
|---|---|---|
| UI-01 | Tổng quan | Thống kê khớp các bản ghi giả, rõ nhãn “thử nghiệm” |
| UI-02 | Khách hàng | Tìm kiếm, lọc tình trạng, sắp xếp và xóa lọc |
| UI-03 | Hồ sơ | Phân biệt giấy phép, thiết bị, nhật ký; không thực hiện thao tác ghi |
| UI-04 | Thiết bị | Ở màn hình nhỏ các cột thành thẻ có nhãn rõ ràng |
| UI-05 | Quyền | C1 không thấy trang quản trị dù cố mở đường dẫn trực tiếp |
| UI-06 | Thiết bị thật | iPhone Safari, Chrome desktop; xoay màn hình, phóng chữ, bàn phím |
| UI-07 | Mạng | Mất mạng, hết phiên, RPC lỗi: không hiện dữ liệu cũ hoặc nhầm quyền |

## 5. Điều kiện nghiệm thu trước bước tiếp theo

- [ ] Chủ sở hữu duyệt loại môi trường và chi phí (nếu có).
- [ ] Duyệt schema, quyền `EXECUTE`, RLS và RPC *trên môi trường thử nghiệm*.
- [x] Chạy mô phỏng RPC offline và kiểm tra kết quả Admin/khách/chuyển phiên.
- [ ] Tất cả ca AUTH-01…AUTH-10 đạt và lưu bằng chứng không chứa bí mật.
- [ ] Tất cả ca UI-01…UI-07 được kiểm tra trên thiết bị thật.
- [ ] Xác định riêng hướng xử lý lỗi nền `reconcile-preview` trong GitHub Actions.
- [ ] Chủ sở hữu nghiệm thu và **cấp phép riêng** nếu muốn tích hợp hoặc triển khai.

## 6. Lưu ý bảo mật SQL

Bản `sql/admin_customer_overview.proposal.sql` hiện chỉ là ý tưởng chưa được phép chạy. Vì dùng `SECURITY DEFINER` trong schema `public`, cần đánh giá kỹ quyền thực thi mặc định `PUBLIC`, việc thu hồi quyền ngay trong cùng giao dịch, kiểm tra `auth.uid()`, role grants và hiệu lực RLS. Không chạy bản đề xuất nguyên trạng lên bất kỳ dự án nào trước khi rà soát và duyệt.
