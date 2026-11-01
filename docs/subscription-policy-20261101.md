# Chính sách thuê bao ÔNG THẦN TÀI — bản chuẩn bị triển khai

Trạng thái: **CHƯA ÁP DỤNG LÊN PRODUCTION**. Tài liệu này không thay đổi quyền khách hiện tại.

## Bảng giá (VND)
| Tháng | WEB | WEB + IN |
|---|---:|---:|
| 1 | 799000 | 1299000 |
| 3 | 2290000 | 3690000 |
| 6 | 4390000 | 6990000 |
| 12 | 7990000 | 12990000 |

- Dùng thử WEB 48 giờ, một lần mỗi khách; chưa mở dùng thử IN.
- Không bán quyền vĩnh viễn mới. Quyền vĩnh viễn hợp lệ đã cấp phải được giữ nguyên.
- Gói IN chưa mở bán cho đến khi có bản ứng dụng phát hành và kiểm thử máy in.
- Gia hạn sớm cộng tháng lịch từ thời điểm hết hạn; gia hạn sau hạn tính từ thời điểm kích hoạt.
- Hết hạn khóa chức năng thuê bao, không xóa dữ liệu; quản trị viên không bị ảnh hưởng.
- Một phiên điện thoại hoạt động cho mỗi tài khoản; đổi thiết bị xác nhận trên máy mới, thu hồi phiên cũ phía máy chủ. Tự chuyển tối đa 2 lần/30 ngày; quản trị viên có thể hỗ trợ khôi phục.
- Không dựa riêng vào localStorage, IP, user-agent hoặc định danh do khách tự khai để kiểm soát phiên.
- Chuyển WEB lên IN tính chênh lệch theo thời gian còn lại sau khi IN được phát hành; hạ cấp ở kỳ tiếp theo.
- Chỉ cấp/gia hạn sau khi xác nhận thanh toán; lưu nhật ký bất biến về người thao tác, gói, số tiền và thời hạn.

## Khảo sát cấu trúc hiện có (01/11/2026)
Các bảng: public.profiles, public.devices, public.licenses, public.email_licenses, public.pending_email_licenses, public.member_entitlements, public.admin_users đều tồn tại và đã bật RLS.
- devices: user_id, device_id, device_name, active, first_seen, last_seen.
- email_licenses: user_id, email, activated_at, expires_at, active, note, created_at, updated_at.
- member_entitlements: user_id, trial_started_at, paid_until, created_at.
- Các bảng cấp quyền được kiểm tra chưa có trường phân biệt gói WEB/IN.

## Trình tự triển khai an toàn
1. Kiểm tra toàn bộ mã cấp quyền frontend và Edge Functions, policy RLS, trigger và quan hệ tài khoản; xác định nguồn sự thật của thời hạn.
2. Sao lưu schema và dữ liệu liên quan, lập kịch bản khôi phục. Không đưa dữ liệu cá nhân lên GitHub.
3. Tạo migration bổ sung gói, giá, lịch sử thanh toán và phiên thiết bị; bảo đảm mặc định không làm mất quyền khách cũ.
4. Thêm kiểm tra quyền phía máy chủ và giao diện quản trị; giữ ngoại lệ tài khoản quản trị.
5. Thử nghiệm: hết hạn, gia hạn, chuyển gói, đổi máy, đăng nhập đồng thời, mất mạng, quyền vĩnh viễn cũ, Telegram, QR, dữ liệu phơi.
6. Chỉ triển khai chính thức sau khi kiểm thử và xác nhận. Không tự động bật bán IN.

## Nguyên tắc bảo mật
RLS cho bảng public; không dùng user_metadata làm nguồn quyền; không đưa service_role ra frontend; mọi hành động quản trị được xác thực phía máy chủ. Thu hồi phiên phải được kiểm tra trên thao tác nhạy cảm, không chỉ dựa vào JWT chưa hết hạn.
