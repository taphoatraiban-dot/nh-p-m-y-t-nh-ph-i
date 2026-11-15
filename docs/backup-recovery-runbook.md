# Sao lưu và phục hồi

Tài liệu này là quy trình cần triển khai và kiểm chứng, không phải xác nhận hệ thống đã có lịch sao lưu tự động.

## Phạm vi cần lưu

- PostgreSQL: cấu trúc, migration, dữ liệu ứng dụng, quyền, hàm và trigger. Kiểm tra riêng phạm vi dữ liệu Auth trong phương pháp sao lưu đã chọn.
- Storage: tệp đối tượng và thông tin liên kết; không suy luận bản sao database có chứa nội dung tệp.
- VPS: cấu hình dịch vụ và danh sách phiên bản worker. Khóa và phiên Telegram phải mã hóa, có quyền truy cập riêng, không đưa vào kho mã hoặc bản báo cáo.
- Mã nguồn: commit đã phát hành và bản triển khai có thể dựng lại.

## Thiết lập

Người quản trị cần chọn nơi lưu ngoài hệ thống đang chạy, phương thức mã hóa, người giữ khóa, thời hạn lưu và mức mất dữ liệu có thể chấp nhận. Xác minh gói Supabase hiện tại hỗ trợ loại backup/PITR nào trước khi đặt mục tiêu phục hồi. Chưa có cấu hình nơi lưu và chính sách được xác nhận trong kho mã này.

Sau khi chọn, tạo lịch chạy và cảnh báo khi không có bản sao mới trong khoảng thời gian cam kết. Cảnh báo chỉ chứa thời điểm, kết quả và mã lỗi; không chứa nội dung khách hàng hoặc thông tin đăng nhập.

## Diễn tập phục hồi

1. Tạo môi trường riêng, không kết nối các worker gửi tin hay hàng đợi in thật.
2. Giải mã và phục hồi bản sao; ghi thời điểm bản sao và thời gian hoàn thành.
3. Đối chiếu số lượng bản ghi theo bảng, quyền sở hữu, RLS, cấu trúc và phiên bản migration. Dùng tài khoản thử để xác minh không đọc được dữ liệu tài khoản khác.
4. Đối chiếu một số mã hồ sơ và dấu vết xác nhận với bản sao gốc. Không thực hiện tác vụ gửi tin, in hoặc xác nhận trên dữ liệu phục hồi.
5. Ghi kết quả, lỗi và thời gian mất dữ liệu thực tế. Chỉ đánh dấu bản sao có thể phục hồi sau khi các bước trên đạt.
6. Hủy môi trường diễn tập và bản sao tạm theo chính sách lưu giữ, sau khi lưu báo cáo không chứa dữ liệu khách.

Thư viện sao lưu phơi gần đây trong `src/phoi-recent-*` là chức năng phục hồi một phần dữ liệu ứng dụng. Nó không thay thế quy trình sao lưu toàn bộ ở trên.
