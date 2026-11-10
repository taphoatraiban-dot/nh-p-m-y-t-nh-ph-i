# Zalo Chat — thiết kế thử nghiệm CUNCUN

Trạng thái: giao diện/kiến trúc; **chưa có kết nối tài khoản Zalo cá nhân**, không hiển thị trạng thái đã kết nối giả.

## Mục tiêu
- Giao diện trên iPhone tương tự Telegram Chat: tìm kiếm, danh sách cá nhân/nhóm, huy hiệu chưa đọc, màn hội thoại, chọn/chọn tất cả, sao chép, đưa nội dung vào ô nhập phơi thủ công, xóa bản sao cục bộ có xác nhận.
- Dùng component giao diện chung nhưng lưu namespace riêng `zalo`; không dùng nhầm endpoint, token, session hay hàng đợi Telegram.
- Không tự động tính, lưu hoặc in phơi; không tự động gửi tin.
- Khóa PIN Chat và kiểm tra quyền server-side; không lưu khóa/phiên trên client. Không đưa dữ liệu thật vào mock.
- Mặc định Zalo ở chế độ `disconnected`, các nút gửi/đồng bộ bị vô hiệu; chỉ bật khi có connector hợp lệ và kiểm thử được.

## Giới hạn và phương án
API chính thức của Zalo dành cho OA, không phải quyền đọc/gửi toàn bộ inbox tài khoản cá nhân. Không giả định OA có thể đọc inbox cá nhân. Không sử dụng cookie, QR session scraping hay thư viện reverse-engineered trên tài khoản chính khi chưa được chủ tài khoản chấp thuận rủi ro.

Giai đoạn 1: xây giao diện độc lập dùng dữ liệu mẫu và kiểm thử trên nhánh này.
Giai đoạn 2: adapter riêng `ZaloProvider` với các phương thức `listConversations`, `listMessages`, `sendMessage`, `getConnectionStatus`, trả `unsupported` khi chưa có API phù hợp.
Giai đoạn 3: chỉ kết nối dịch vụ chính thức được cấp quyền, kiểm tra giới hạn loại tài khoản, quyền truy cập, webhook và chi phí trước khi bật.

## Điều kiện nghiệm thu
- Không làm thay đổi Telegram, parser, in ấn, tài khoản, dữ liệu production.
- Không có yêu cầu mạng tới Zalo khi chưa cấu hình connector.
- Không hiện 'Đã gửi' khi chưa có biên nhận thật.
- Kiểm thử điện thoại, quyền truy cập, XSS, xóa cục bộ và thao tác chọn/sao chép.
- Chỉ merge main sau khi kiểm thử và chủ dự án xác nhận.
