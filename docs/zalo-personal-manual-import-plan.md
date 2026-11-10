# CUNCUN — nhập thủ công tin Zalo cá nhân (nhánh thử nghiệm)

## Mục tiêu
Giữ nguyên tài khoản Zalo cá nhân. Người vận hành sao chép tin trong ứng dụng Zalo rồi dán vào CUNCUN. Không sử dụng API Zalo cá nhân không chính thức, không lấy mật khẩu/cookie/token/QR và không tự động gửi/đọc tin.

## Phạm vi
- Nhánh: experiment/zalo-chat-ui. Không chỉnh sửa production main.
- Thêm khu vực “Dán tin Zalo” vào màn nhập/tính tiền hiện hữu, không tạo hệ thống tính tiền thứ hai.
- Danh sách khách/bảng giá: chỉ dùng nguồn dữ liệu bảng giá hiện có của tài khoản đăng nhập. Không hard-code tên khách hay giá.
- Người vận hành chọn bảng giá, miền, kiểm tra nội dung và xác nhận trước khi chuyển vào ô nhập tính tiền.
- Giữ nguyên parser, kiểm tra cú pháp, cảnh báo và quy tắc tính tiền CUNCUN đang hoạt động.

## Luồng
1. Mở “Dán tin Zalo” (mặc định đóng), dán nội dung; giới hạn độ dài phù hợp parser và hiện cảnh báo khi quá dài.
2. Chọn khách/bảng giá từ dữ liệu CUNCUN thực tế; mặc định không tự chọn khách nếu có nhiều bảng giá.
3. Chọn miền theo ý người vận hành; không âm thầm sửa nội dung gốc.
4. Xem trước tên khách, bảng giá, miền và văn bản nguyên bản; cảnh báo nếu thiếu tên đài hoặc cú pháp nghi vấn.
5. Tích xác nhận để đưa văn bản vào ô nhập hiện hữu. Chuyển nội dung không đồng nghĩa với xác nhận phơi, in phiếu, gửi Telegram/Zalo hay lưu dữ liệu.
6. Sau khi chuyển, người dùng vẫn phải bấm OK theo quy trình kiểm tra hiện có.

## Quy tắc an toàn
- Không gọi dịch vụ mạng bên thứ ba từ giao diện dán; không ghi console, analytics, URL hay localStorage nội dung tin.
- Không ghi đè ô nhập đang có dữ liệu mà không hỏi xác nhận.
- Thay đổi nội dung, khách, miền hoặc bảng giá sẽ xóa xác nhận cũ.
- Không tự lưu hoặc gửi tin; nếu sử dụng cơ chế lưu phơi hiện tại, giữ nguyên quyền truy cập và chính sách lưu/xóa hiện hành.
- Không dùng nội dung HTML chưa làm sạch; hiển thị tin bằng textContent.
- Không thay đổi quy tắc xác thực, tài khoản admin, quyền sử dụng hay thanh toán.

## Tiêu chí nghiệm thu
- iPhone Safari và CuncunPrint: dán nhiều dòng, xem trước, chuyển vào ô nhập, cuộn không lỗi.
- Chọn khách khác đổi đúng bảng giá; không lẫn dữ liệu giữa các khách.
- Nội dung như 2dmn / 12.21b5. / 34.43da1. được chuyển nguyên văn và parser hiện có xử lý.
- Khi ô nhập đã có dữ liệu, phải hỏi trước khi thay thế hoặc nối thêm.
- Kiểm tra không có request nào tới Zalo, không có tác động lên production.
- Test tự động và test thực tế đạt trước khi cân nhắc merge.

## Trạng thái
Đây là đặc tả triển khai. Chưa được xem là chức năng đã tích hợp vào ứng dụng tính tiền; cần khảo sát đúng entry point của ô nhập và nguồn bảng giá trong mã nguồn trước khi sửa.
