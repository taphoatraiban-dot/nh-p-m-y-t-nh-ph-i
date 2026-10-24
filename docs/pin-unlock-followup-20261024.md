# Ổn định thao tác mở PIN — 24/10/2026

Mốc trước sửa: 1a4ae22. Sao lưu: backup/pin-unlock-concurrency-20261024.

Trước sửa, pinUnlockBusy chỉ được bật sau khi chờ cloudPinHash/tsSha256. Hai thao tác gửi PIN trong lúc chờ có thể tạo hai lượt kiểm tra và mở khóa. Kết quả license/device trả muộn cũng chưa kiểm tra xem phiên đã đăng xuất trong lúc chờ hay chưa. Lỗi hash hoặc lỗi signOut có thể không đưa về màn hình có thể thao tác tiếp.

Bản sửa đặt khóa xử lý trước lần await đầu tiên, kiểm tra phiên thao tác sau các bước bất đồng bộ và luôn giải phóng trạng thái bận trong finally. Khi signOut thất bại, vẫn giữ ứng dụng khóa và đưa về giao diện mật khẩu. Mở ứng dụng vẫn bắt buộc cả kiểm tra license và thiết bị thành công; không đổi PIN, credential, OTP hoặc các hàm RPC.

8 ca mới dùng session/PIN giả: gửi trùng, PIN sai rồi thử lại, chờ đủ hai kiểm tra, đăng xuất trong lúc tải hash, đăng xuất trong lúc kiểm tra quyền, máy chủ từ chối cùng lỗi signOut, lỗi hash, PIN chưa đủ số. Tổng 431 test runner PASS. Chưa kiểm chứng trên iPhone thật; không tuyên bố mọi lỗi mạng/đăng nhập đã được giải quyết.
