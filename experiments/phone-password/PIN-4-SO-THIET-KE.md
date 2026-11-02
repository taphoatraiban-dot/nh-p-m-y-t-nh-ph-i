# Đăng nhập nhanh PIN 4 số — thiết kế thử nghiệm

Giữ nguyên đăng nhập PIN 4 số hiện có của ứng dụng chính. Bổ sung SĐT + mật khẩu, giữ Gmail; **không thay thế hoặc xóa PIN cũ**.

## Luồng sử dụng
1. Lần đầu trên thiết bị: đăng nhập SĐT + mật khẩu hoặc Gmail theo cơ chế hiện tại, kiểm tra bản quyền.
2. Người dùng có thể bật PIN 4 số cho thiết bị đã xác thực.
3. Mở lại ứng dụng: hiện bàn phím PIN 4 số quen thuộc, nhưng PIN chỉ mở khóa phiên hợp lệ đã được bảo vệ trên thiết bị.
4. Trước khi vào dữ liệu: xác minh phiên và bản quyền hiện hành trên máy chủ; hết hạn, thu hồi, đăng xuất từ xa hoặc mất mạng không được mặc định cho phép truy cập.
5. Sai PIN 5 lần: khóa cách mở bằng PIN, yêu cầu đăng nhập lại bằng phương thức chính. Không tiết lộ tài khoản có tồn tại hay không.
6. Đổi thiết bị hoặc xóa phiên: đăng nhập lại bằng phương thức chính; thiết lập PIN mới.

## Ranh giới bảo mật bắt buộc
- PIN 4 số **không phải mật khẩu Supabase**, không thay thế xác thực máy chủ.
- Không lưu PIN thuần, không lưu bearer/refresh token trong localStorage để PIN tự giải mã bằng phép băm đơn giản.
- Với iOS native: dùng Keychain, Secure Enclave / LocalAuthentication nếu khả dụng. Với web thuần: cần thiết kế cơ chế phiên an toàn riêng; không coi local PIN là biện pháp bảo vệ dữ liệu.
- Phải kiểm tra quyền tại các API / chính sách RLS, không chỉ gọi `check_access` ở màn hình đăng nhập.
- Giữ đường đăng nhập Gmail cũ và tài khoản cũ; không chuyển đổi dữ liệu.
- Không triển khai production cho tới khi có kiểm thử hồi quy, giới hạn thử PIN và rà soát chính sách dữ liệu.

## Trạng thái
Đây là tài liệu yêu cầu kỹ thuật trên nhánh thử nghiệm, **chưa phải chức năng PIN mới đã hoạt động**. Không thay đổi mã nguồn production.
