# Kiểm thử thực tế đăng ký chỉ SĐT + mật khẩu (LOCAL ONLY)

## Điều kiện
- Cài Supabase CLI và Docker cục bộ, không liên kết tới project sản xuất.
- Kiểm tra `supabase --version`, `supabase start --help` trước khi dùng.
- Cấu hình Auth phone signup bật, phone confirmation tắt **chỉ trong môi trường cục bộ**. Đối chiếu cấu hình với tài liệu Supabase hiện hành trước khi chạy.
- Xác nhận Auth URL là `http://127.0.0.1:54321/auth/v1` hoặc localhost; tuyệt đối không dùng `zigpqddlhvjbjrwhfhaa.supabase.co`.
- Không dùng service_role trên trình duyệt; không dùng SMS provider hoặc OTP giả ở production.

## Kịch bản nghiệm thu bắt buộc
1. Đăng ký `0912345678` và mật khẩu mạnh; kiểm tra chuẩn hóa `+84912345678`.
2. Đăng nhập đúng; đăng nhập sai trả thông báo chung.
3. Đăng ký trùng số; không tiết lộ danh tính hoặc tự chuyển quyền sở hữu.
4. Không tự cấp bản quyền, không tự thêm thiết bị, không sửa quyền admin.
5. Kiểm tra tài khoản Gmail cũ đăng nhập bình thường trên bộ giả lập độc lập; không chạm DB production.
6. Đăng xuất, hết hạn phiên và đổi mật khẩu khi còn phiên hợp lệ.
7. Quên mật khẩu khi chỉ có SĐT: hiển thị liên hệ quản trị viên và xác minh thủ công, **không tự cấp lại**.
8. Kiểm tra tốc độ/rate-limit, thử sai nhiều lần, ghi log không lộ mật khẩu.

## Tiêu chí dừng
Nếu không thể tắt xác nhận điện thoại chỉ trong local, hoặc test login không hoạt động, dừng và giữ PR ở draft. Không dùng số điện thoại của khách thật trong thử nghiệm.

## Tình trạng
Bộ kiểm thử tự động hiện tại chỉ kiểm tra adapter bằng mock. Chưa có kết quả kiểm thử Supabase Auth thực tế.
