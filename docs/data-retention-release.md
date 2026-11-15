# Lưu trữ phiếu và lịch sử Chat — 15/11/2026

## Thay đổi

- Quản lý phiếu dùng LƯU TRỮ và KHÔI PHỤC thay cho xóa vĩnh viễn. Danh sách đã lưu trữ có phân trang. Phiếu đã xác nhận vẫn xuất hiện trong lịch sử đã xác nhận.
- Lưu trữ chỉ thay `archived_at`: giữ mã QR, token hash, nội dung và thông tin xác nhận. Đây không phải hủy phiếu. Muốn phiếu đang lưu trữ xuất hiện lại trong danh sách chưa xác nhận, chọn KHÔI PHỤC.
- API `owner-delete`/`owner-delete-all` cũ trả lỗi yêu cầu tải lại trang. Không diễn giải lời xác nhận xóa cũ thành thao tác lưu trữ mới.
- Migration bổ sung cột và chỉ mục lưu trữ. Trigger chặn xóa và thay đổi nội dung bản ghi đã xác nhận; chỉ cho phép thay `archived_at`. Không cấp thêm quyền, không sửa trạng thái hay số tiền hiện có.
- Chat có “Tin cũ hơn” và “Về tin mới nhất”. Mỗi trang tối đa 200 tin, tiếp tục theo thời điểm và ID thay vì vị trí. Tin cùng thời điểm không bị bỏ sót. Trang toàn tin đã ẩn vẫn có thể đi tiếp. Tin ẩn được kiểm tra theo các ID của trang đang đọc.
- Đăng xuất/đổi tài khoản xóa nội dung đã tải; bỏ qua phản hồi đến muộn. Bản nháp Chat được giữ khi chuyển trang lịch sử.
- Kiểm thử phân quyền chạy cả khi thay đổi hàm máy chủ/migration, trên PR và nhánh main. Workflow Data retention kiểm tra API thực thi, quyền sở hữu, migration, Chat và trang quản lý với dữ liệu giả.

## Điều kiện phát hành

Bản sửa chưa tự triển khai lên dữ liệu thật. Trình tự:

1. Sao lưu cơ sở dữ liệu và xác nhận đã thử phục hồi vào môi trường tách biệt. Không dùng nhánh Git thay cho bản sao dữ liệu.
2. Đối chiếu cấu trúc thật của `receipt_verifications` và các luồng quản trị có quyền sửa/xóa bản ghi đã xác nhận. Trigger mới sẽ chặn cả luồng cũ và tác vụ xóa dây chuyền có đụng bản ghi này. Nếu cần quy trình xóa tài khoản theo chính sách lưu giữ, phải thiết kế và kiểm thử quy trình đó trước khi áp dụng trigger.
3. Trên môi trường thử: áp dụng migration `20261115030532_receipt_archive_retention.sql`; xác nhận cột, chỉ mục, trigger và quyền theo chủ sở hữu. Chạy kiểm tra advisor Supabase; xử lý cảnh báo liên quan trước phát hành.
4. Kiểm thử hai tài khoản: lưu trữ, khôi phục, phân trang và truy cập chéo bị từ chối. Thử đọc QR cũ trước/sau lưu trữ; thông tin xác nhận và mã QR phải giữ nguyên. Không gọi xác nhận hay gửi tin với dữ liệu thật để kiểm tra.
5. Triển khai API `receipt-verify` và `telegram-chat`, sau đó giao diện. Khi triển khai Chat, giữ cấu hình gateway như `supabase/config.toml` và dùng quy trình trong `docs/telegram-chat-deployment.md`.
6. Kiểm tra trên Safari/iPhone thật, Android và desktop; tải lại trang cũ phải nhận thông báo rõ ràng khi gọi chức năng xóa cũ. Bật theo dõi lỗi API sau phát hành.

## Quay lại phiên bản trước

- Nếu lỗi giao diện, quay lại giao diện trước nhưng giữ API mới để chức năng xóa cũ tiếp tục bị từ chối.
- Nếu lỗi Chat, quay lại riêng API/giao diện Chat cùng phiên bản; không thay gateway hoặc khóa đồng bộ khi chưa xác định nguyên nhân.
- Không xóa cột `archived_at` hoặc dữ liệu đã lưu trữ để quay lại. Giữ trigger bảo vệ lịch sử. Nếu cần nới trigger cho quy trình quản trị hợp lệ, phải sao lưu và kiểm tra riêng trước khi thay đổi.

## Giới hạn

Bộ kiểm thử migration dùng PostgreSQL nhúng với cấu trúc mẫu và RLS theo chủ sở hữu, không phải bản sao cơ sở dữ liệu sản xuất. Không có bảo đảm về mọi tích hợp ngoài kho mã. Bộ phân tích cược và lịch đài có hai kiểm thử cũ chưa đạt, được ghi trong README. Không nâng cấp hai kết quả này thành đạt trong đợt thay đổi dữ liệu.
