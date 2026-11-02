# Kịch bản nghiệm thu đăng ký SĐT/Gmail — không SMS, không phí

## Quyết định bảo mật
Không dùng số điện thoại **chưa xác minh** làm định danh đăng nhập hoặc khôi phục mật khẩu. Mật khẩu đúng chỉ chứng minh người dùng biết mật khẩu, không chứng minh sở hữu số điện thoại.

## Luồng khả thi không SMS
1. **Gmail + mật khẩu:** giữ nguyên Supabase Auth hiện tại, yêu cầu xác minh email theo cấu hình dự án.
2. **SĐT + mật khẩu:** chỉ bật khi có bước liên kết với tài khoản đã xác minh bằng Gmail/email hoặc cơ chế xác minh sở hữu số độc lập. Trong thời gian chờ, chỉ thu số như thông tin liên hệ chưa xác minh; không quảng cáo đây là đăng ký chỉ bằng SĐT.
3. **Quên mật khẩu:** qua email đã xác minh; không cho reset bằng số chưa xác minh.
4. **Chống chiếm tài khoản:** không tự gộp tài khoản trùng số; không tiết lộ số có tồn tại; giới hạn số lần thử đăng nhập ở máy chủ; không cấp license khi đăng ký.

## Điều kiện mở tính năng
- Xác minh cách tạo định danh SĐT thực tế trên Supabase Auth mà không phát sinh phí và không xung đột người dùng cũ.
- Kiểm thử đầy đủ đăng ký, đăng nhập, quên mật khẩu, trùng SĐT, đăng nhập sai, Gmail cũ, admin và license trên staging cục bộ.
- Kiểm tra GitHub Actions thành công ở commit cuối; PR vẫn ở draft đến khi được duyệt.
- Không chạy migration trên Supabase production, không gộp vào main khi chưa có nghiệm thu.

## Tình trạng
CHƯA KÍCH HOẠT đăng ký/đăng nhập chỉ bằng SĐT. Giao diện demo và adapter chỉ là bản thử nghiệm. Không yêu cầu dịch vụ SMS trả phí.
