# Sửa khởi động đăng nhập/PIN — 24/10/2026

Sao lưu: backup/login-startup-race-20261024, từ 48c9d6b.

Phát hiện hai lần gọi boot() trong cùng trang, mỗi lần chờ đồng bộ cài đặt rồi chọn màn hình. showPinLock/showLogin gọi showPublicCover, xóa trạng thái public-auth-open kể cả người dùng vừa vuốt vào đăng nhập. Kết quả bất đồng bộ có thể đẩy người dùng trở lại trang xổ số hoặc đặt lại màn PIN.

Thay đổi:
- Chỉ gọi boot một lần và tái sử dụng cùng promise nếu được gọi lại.
- PIN đã lưu tại máy hiện ngay khi đọc được session; đồng bộ cài đặt không chặn việc chọn màn hình PIN.
- Giữ public-auth-open khi màn PIN/đăng nhập sẵn sàng. Trang kết quả mặc định và thao tác vuốt vẫn được giữ.
- Bỏ phản ứng giao diện trùng với INITIAL_SESSION; SIGNED_OUT vẫn khóa ứng dụng.
- Bỏ qua kết quả boot đến muộn sau khi đăng nhập thủ công bắt đầu hoặc sau đăng xuất.
- Lỗi tải session có đường quay về mật khẩu, không yêu cầu reload.

10 kiểm thử mô phỏng session chậm, gọi trùng, PIN máy/PIN cloud, không có session, lỗi mạng, đăng nhập thủ công trong lúc boot và trạng thái màn hình khi vuốt. Tổng bộ kiểm thử 423 PASS. Không dùng mật khẩu/PIN thật trong kiểm thử; chưa xác minh trên iPhone của khách.

Không đổi PIN/mật khẩu, OTP, quyền truy cập, kiểm tra license/device, bot, Worker, database hay dữ liệu khách. Đây là sửa điều phối giao diện và khởi động, không thay thế kiểm tra máy chủ khi mở khóa.
