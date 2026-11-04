# Tích hợp sao lưu phơi: điều kiện bắt buộc trước khi bật

Trạng thái: **chưa tích hợp vào in Wi-Fi hoặc bản chính**.

## Luồng ghi an toàn
1. Sau khi ứng dụng đã tạo một phiếu có `id` ổn định, `created_at` dạng ISO có múi giờ và đã lưu phiếu vào danh sách quản lý in, gọi `queue.enqueue(receipt, authUser.id)` **trước khi gửi lệnh in**. Không được chặn việc in khi mạng Supabase lỗi.
2. Gọi `queue.flush()` khi có kết nối, sau khi đăng nhập và khi ứng dụng hoạt động trở lại. Hiển thị số phiếu đang chờ và lỗi đồng bộ. **Không báo "đã sao lưu" chỉ vì đã enqueue.**
3. Sau đăng nhập, gọi `restore({supabase,userId:authUser.id})`, so sánh theo ID, hợp nhất với phiếu hiện có; không xóa hay thay thế toàn bộ danh sách in. Chỉ hiển thị phơi của hôm nay/hôm qua theo Asia/Ho_Chi_Minh.
4. Khi khách chuyển tài khoản, không được tải dữ liệu tài khoản trước. Mọi truy vấn dùng auth.uid và RLS; hàng đợi offline gắn userId riêng.
5. Với iOS Wi-Fi ESC/POS, điểm tích hợp phải nằm **trước** TCP send, ngay sau bước lưu phiếu; không dựa vào phản hồi TCP để quyết định có sao lưu hay không.
6. Trước khi phát hành: kiểm thử in thật qua Wi-Fi, tắt mạng rồi in, bật mạng đồng bộ, đóng/mở app, cài lại app, đăng nhập và phục hồi; kiểm thử hai tài khoản, trùng ID, qua 00:00 giờ Việt Nam, phiếu quá hạn.
7. Phải có tác vụ dọn bản ghi **trên máy chủ** sau khi kết thúc ngày hôm qua theo giờ Việt Nam. Lọc phía ứng dụng không tương đương xóa dữ liệu.
8. Chỉ chạy migration và dọn dữ liệu sau khi có sao lưu database và xác nhận chính sách RLS, tránh ảnh hưởng dữ liệu hiện hữu.

## Chú ý
Bản mã thử nghiệm chỉ là thư viện dùng khi tích hợp. Chưa có bảng `phoi_recent_backups` trên production, chưa có lịch dọn tự động, chưa có kiểm thử end-to-end, và chưa bật tính năng cho khách.
