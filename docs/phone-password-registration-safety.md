# Đăng ký bằng số điện thoại + mật khẩu (bản thử nghiệm, chưa bật)

## Ràng buộc an toàn
- Không thay đổi luồng đăng ký/đăng nhập email đang chạy, không thay đổi tài khoản cũ, quyền admin, giấy phép hoặc thiết bị.
- Không dùng SMS trả phí, không yêu cầu bật Phone Auth trên Supabase production.
- **Số điện thoại + mật khẩu không chứng minh quyền sở hữu số điện thoại.** Không được dùng số chưa xác minh để khôi phục mật khẩu, cấp quyền, chuyển tài khoản hoặc nhận diện chủ sở hữu.
- Không lưu mật khẩu ở bảng public, localStorage, log hay metadata; chỉ dùng dịch vụ xác thực có cơ chế băm mật khẩu chuẩn.
- Không dùng email giả dạng số điện thoại để đăng ký Supabase Auth; tránh xung đột định danh và rủi ro chiếm đoạt tài khoản.

## Thiết kế đề xuất
1. Giữ đăng ký Gmail/email + mật khẩu hiện tại nguyên vẹn.
2. Đăng ký số điện thoại Việt Nam theo E.164 (+84), chuẩn hóa và kiểm tra cú pháp, nhưng hiển thị rõ **chưa xác minh số**.
3. Cần có cơ chế xác thực danh tính không tốn SMS (ví dụ liên kết email đã xác minh hoặc xác minh thủ công có kiểm soát) trước khi cho phép số điện thoại trở thành định danh đăng nhập có quyền.
4. Kiểm tra khả năng tương thích Supabase Auth và chính sách khôi phục tài khoản trên môi trường cục bộ, không chạy migration production.
5. Kiểm thử số trùng, tạo đồng thời, giới hạn thử mật khẩu, liệt kê tài khoản, reset mật khẩu, phân quyền và tài khoản cũ.

## Trạng thái
CHỈ THIẾT KẾ / CHƯA KÍCH HOẠT. Không tạo người dùng bằng số điện thoại trên production; chưa nối UI. Chỉ triển khai khi có giải pháp xác thực an toàn và kiểm thử đầy đủ.
