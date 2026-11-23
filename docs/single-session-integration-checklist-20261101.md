# Kiểm thử và tích hợp giới hạn một phiên (chưa triển khai)

## Ranh giới bảo vệ
- `subscription_claim_current_session()` dùng `auth.uid()` và `auth.jwt().session_id` để xác định phiên từ máy chủ.
- `subscription_session_is_current()` trả true chỉ với phiên đang được chọn; **chỉ có tác dụng khi endpoint/RLS gọi nó**.
- Không tự thu hồi access token Supabase, không chặn truy cập qua endpoint cũ, không đảm bảo một *thiết bị vật lý* (một điện thoại có thể có nhiều phiên).
- Không dùng mã thiết bị do client tự cung cấp để cấp quyền.
- Chưa có giao diện xác nhận chuyển máy, API reset của admin, hoặc kiểm tra chống lạm dụng thiết bị.
- Trước khi áp dụng, xác minh thực tế schema `auth.sessions` và claim `session_id` theo phiên bản Supabase đang chạy.

## Thứ tự tích hợp
1. Xác minh bản sao lưu Supabase và restore vào môi trường thử riêng, không phải Git branch.
2. Áp dụng migration lên môi trường thử, kiểm tra grants/RLS và quyền RPC.
3. Thêm giao diện cảnh báo trên thiết bị mới: chuyển quyền sẽ ngắt quyền thao tác trên thiết bị cũ.
4. Gọi claim khi đăng nhập; khi bị giới hạn, hiển thị hướng dẫn liên hệ admin.
5. Gọi session check ở **mọi** API/Edge Function/RPC xử lý phơi, Telegram, dữ liệu khách, QR, in; không chỉ kiểm tra ở giao diện.
6. Admin recovery riêng có xác thực admin và nhật ký; tránh tự cấp quyền qua client.
7. Kiểm tra quyền thuê bao: ưu tiên bảo toàn giấy phép cũ, đặc biệt admin/vĩnh viễn; không tự chuyển khách cũ.
8. Kiểm tra giao dịch đồng thời, đăng nhập lại sau xóa Safari data, phiên hết hạn, thiết bị mất, người dùng đăng nhập trên web máy tính.
9. Chạy `node --test subscription/*.test.mjs` và test RPC tích hợp với tài khoản thử; chưa có bằng chứng CI pass.
10. Bật theo nhóm thử, theo dõi lỗi, có công tắc rollback, sau đó mới xét mở rộng.

## Kịch bản cần đạt
| Kịch bản | Kỳ vọng |
|---|---|
| Phiên A claim lần đầu | Thành công |
| A claim lại | Không tăng bộ đếm chuyển |
| Phiên B claim sau A | B được chọn; A check=false |
| A gọi endpoint được bảo vệ | Bị từ chối |
| A dùng endpoint cũ chưa tích hợp | **Vẫn có thể truy cập: phải sửa trước khi mở bán** |
| 2 lần chuyển trong 30 ngày | Lần chuyển thứ ba bị chặn |
| Sau 30 ngày | Có thể chuyển tiếp |
| Admin cần khôi phục máy | Chỉ qua luồng admin có audit (chưa viết) |
| Giấy phép cũ/vĩnh viễn | Không thay đổi |
| WEB+IN | Không bán khi ứng dụng chưa sẵn sàng |

## Điểm chặn phát hành
Không merge khi chưa có: backup kiểm chứng; test DB thật; kiểm tra các luồng truy cập cũ; kiểm thử các chức năng Telegram, QR, phơi, in; phương án khôi phục admin. Không áp dụng giới hạn phiên cho khách đang dùng khi chưa có đường hỗ trợ đổi máy.
