# Zalo Chat giai đoạn 1

Nhánh thử nghiệm `experiment/zalo-chat-phase1`, xuất phát từ main. Không triển khai website chính hoặc thay đổi database/VPS/Telegram.

Mở Zalo Chat cạnh Telegram Chat sau đăng nhập CUNCUN. Tạo hội thoại cá nhân hoặc nhóm, sao chép tin từ ứng dụng Zalo và dán vào ô nhập, bấm Lưu tin đã dán. Mỗi lần lưu là một tin trong lịch sử. Tìm theo tên, khách hoặc nội dung; lọc cá nhân/nhóm. Chọn từng tin hoặc chọn tất cả, sao chép, xóa có xác nhận. Xóa chỉ tác động lịch sử CUNCUN.

Chọn khách từ danh sách bảng giá hiện hữu. Khi đưa các tin được chọn vào nhập phơi, giao diện chọn khách bằng chính sự kiện change đang dùng trong CUNCUN để áp dụng bảng giá. Nội dung được nối vào bets theo thứ tự thời gian và phát sự kiện nhập thủ công của Telegram để không tự tính tiền. Người dùng kiểm tra cú pháp bằng luồng nhập phơi hiện tại; không thêm parser hoặc cách tính tiền mới. Nếu ô nhập có nội dung của khách khác, thao tác bị chặn để tránh trộn phơi. Bảng giá đã xóa phải được chọn lại.

Lịch sử nằm trong localStorage riêng `cuncun_zalo_phase1:<user-id>` trên trình duyệt/thiết bị này; không đồng bộ thiết bị, không nằm trong backup nghiệp vụ hiện có. Không lưu mật khẩu/PIN/Zalo token. Đăng xuất xóa màn hình và bản nháp, giữ lịch sử của đúng tài khoản để mở lại trong 48 giờ. Tin hết 48 giờ bị loại khi mở/thao tác hoặc mỗi phút khi trang đang chạy; khi trình duyệt đóng, dữ liệu vật lý được dọn ở lần mở trang tiếp theo. Xóa dữ liệu trình duyệt sẽ mất lịch sử. Không chỉnh hoặc xóa dữ liệu Telegram, khách hàng, bảng giá, phơi hiện hữu.

Không có kết nối tới Zalo, không API Zalo cá nhân, không yêu cầu đăng nhập Zalo, không gửi tin ra ngoài. Chỉ xác nhận phiên đăng nhập CUNCUN bằng client sẵn có.

## Kiểm thử

- `node --test tests/chat/zalo-ui.test.cjs`: 3 ca tích hợp đạt, bao phủ cá nhân/nhóm, tìm nội dung, chống chèn HTML, chọn tất cả, sao chép, xóa có xác nhận, bảng giá hiện hữu, nhập thủ công, chống trộn khách, lỗi lưu trữ, hết hạn và tách tài khoản.
- `node --test tests/verify-html-syntax.test.mjs`: 4 ca đạt.
- `tests/chat/ui.test.cjs`: 9 đạt / 8 lỗi. Đối chiếu bản main gốc tại commit xuất phát có cùng 8 ca lỗi; không sửa mã Telegram trong đợt này. Có lỗi kiểm tra canonical Telegram không khớp asset phát hành vốn đã tồn tại.
- Kiểm tra JavaScript syntax và git diff whitespace.

Các ca UI chạy bằng JSDOM với dữ liệu giả, không đăng nhập tài khoản thật hoặc gửi tin cho khách. Chưa kiểm thử trực tiếp Safari/iPhone. CSS dùng bố cục Telegram hiện hữu với luồng hội thoại riêng cho màn hình hẹp; cần nghiệm thu trên thiết bị trước khi gộp main.

Hoàn tác: bỏ hai dòng nạp assets/zalo-chat ở cuối index.html. Không cần migration hoặc thay đổi hạ tầng.
