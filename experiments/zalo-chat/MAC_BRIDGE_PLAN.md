# Cầu nối Zalo cá nhân trên Mac mini — thiết kế an toàn

## Phạm vi được hỗ trợ

Mac mini chạy ứng dụng Zalo chính thức 24/24. Cầu nối chỉ được đọc **thông báo mới mà macOS thực sự cung cấp** sau khi người dùng tự cấp quyền. Không truy cập cơ sở dữ liệu Zalo, cookie, token, QR đăng nhập, mật khẩu hoặc OTP.

**Không được mô tả là đồng bộ toàn bộ Zalo.** Thông báo có thể không xuất hiện khi cuộc trò chuyện đang mở, khi tắt preview, bật Focus, hoặc khi Zalo/macOS không phát thông báo. Nội dung bị ẩn không được suy đoán.

## Giai đoạn 1: kiểm tra khả thi trên máy thật

1. Bật thông báo Zalo trong System Settings > Notifications > Zalo; bật Show Previews theo lựa chọn của chủ máy.
2. Gửi thử một tin từ tài khoản khác đến Zalo chính, trong khi Zalo trên Mac không mở đúng cuộc trò chuyện đó.
3. Xác minh thông báo có hiện tên người gửi, nội dung, thời điểm hay không; thử tin nhóm, ảnh và lúc Zalo ở nền.
4. Nếu macOS không cung cấp nguồn sự kiện thông báo đáng tin cậy cho ứng dụng cầu nối, **dừng tại đây**. Không tự động hóa việc đọc màn hình hoặc cào dữ liệu ứng dụng để thay thế.

## Giai đoạn 2: cầu nối có kiểm soát (chỉ sau khi giai đoạn 1 đạt)

- Quy trình chạy cục bộ trên Mac mini, có nút bật/tắt rõ ràng.
- Cho xem trước tin nhận được trước khi đưa vào CUNCUN; không tự tính, lưu phơi hoặc in.
- Chỉ truyền qua HTTPS đến endpoint xác thực riêng, có chống phát lại, giới hạn tốc độ và khóa có thể thu hồi; không dùng khóa quản trị.
- Hạn chế lưu dữ liệu nhạy cảm, áp dụng chính sách lưu/xóa 48 giờ đã chốt cho tin nhắn CUNCUN.
- Tin không có nội dung hoặc thiếu nguồn gửi phải gắn trạng thái chưa xác minh, không nhập phơi tự động.
- Tắt cầu nối không ảnh hưởng Zalo chính thức và Telegram đang chạy.

## Chưa hỗ trợ

- Đọc lịch sử hội thoại cá nhân và nhóm.
- Gửi tin nhắn bằng tài khoản Zalo cá nhân qua API chính thức.
- Xác nhận đã đọc, đồng bộ hai chiều, đồng bộ ảnh đầy đủ.
- Chạy thực tế trên Mac mini khi chưa có quyền truy cập máy và chưa kiểm thử.

## Tiêu chí hoàn thành

Chỉ đánh dấu `nhận tin Zalo trên Mac: hoạt động` khi thử trên máy thật thành công, có bằng chứng thông báo và không cần truy cập dữ liệu riêng của Zalo.
