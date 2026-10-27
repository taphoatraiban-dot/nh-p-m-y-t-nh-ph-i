# Cuncun – In một chạm từ iPhone qua Mac Mini

## Trạng thái triển khai
- Website gửi phiếu vào bảng Supabase `print_queue` khi chọn **Mac Mini – In tự động một chạm** rồi bấm **IN NGAY**.
- Mac Mini lấy phiếu bằng tài khoản Cuncun của chính người dùng, in 80mm qua TCP 9100.
- Phiếu được vẽ thành ảnh đen trắng nên chữ tiếng Việt và QR không phụ thuộc bảng mã của Xprinter.
- Không cần cài Xcode, không cần công khai cổng Mac ra Internet.
- Chương trình không tự in lại phiếu đã nhận. Phiếu lỗi được ghi trạng thái `failed` để kiểm tra thủ công.
- Worker mặc định bỏ qua các phiếu có ID <= 235 (đây là ranh giới kiểm tra tại 28/10/2026, không phải tự động xóa).

## Cài trên Mac Mini (một lần)
```sh
python3 -m pip install --user Pillow qrcode
mkdir -p ~/CuncunPrintNew
curl -fL 'https://raw.githubusercontent.com/taphoatraiban-dot/nh-p-m-y-t-nh-ph-i/main/printing/mac_user_worker.py' -o ~/CuncunPrintNew/mac_user_worker.py
python3 ~/CuncunPrintNew/mac_user_worker.py
```
Lần đầu nhập email và mật khẩu Cuncun trong Terminal của Mac. Mật khẩu không lưu; phiên đăng nhập được lưu ở `~/.cuncun-print-session.json` với quyền chỉ chủ máy đọc. Không gửi mật khẩu cho bất kỳ ai.

**Quan trọng:** Chỉ chạy lệnh tải từ nhánh `main` sau khi pull request được kiểm thử và merge. Khi đang thử nhánh riêng, thay `main` trong URL bằng `feature/cuncun-one-tap-print-20261028`.

## Sử dụng
1. Giữ Mac Mini bật, chạy worker và Xprinter ở `192.168.1.159:9100`.
2. Trên iPhone mở `cuncun.icu`, đăng nhập cùng tài khoản với worker Mac.
3. Mở **Quản lý kết nối máy in** → **Mac Mini – In tự động một chạm** → **IN NGAY**.
4. Kiểm tra trạng thái phiếu trong Supabase: `pending`, `printing`, `printed` hoặc `failed`.

## An toàn
- Không sử dụng `service_role` key trong trình duyệt hoặc worker này.
- Supabase RLS giới hạn đọc/tạo/cập nhật phiếu theo `user_id = auth.uid()`.
- Quyền cập nhật chỉ cho phép `status`, `attempts`, `error_message`, `printed_at`, không cho sửa nội dung phiếu.
- Để tránh in trùng, worker chiếm phiếu bằng điều kiện `status=pending`. Sau khi nhận, không tự lấy lại phiếu `printing`.
- Nếu mất kết nối đúng lúc đang in, cần kiểm tra giấy trước khi đặt lại trạng thái; không có cách bảo đảm 100% đúng một lần khi thiết bị mất điện giữa lệnh in và xác nhận.
- Các phương thức Chia sẻ, AirPrint, ứng dụng native và in cũ vẫn được giữ nguyên.

## Kiểm tra trước khi phát hành
- [ ] Đăng nhập worker bằng đúng tài khoản Cuncun trên iPhone.
- [ ] In một phiếu mới và xác minh giấy đủ chữ tiếng Việt, mã QR, cắt cuối phiếu.
- [ ] Kiểm tra một phiếu lỗi không tự in lặp lại.
- [ ] Kiểm tra các chế độ in cũ vẫn hoạt động.
- [ ] Thiết lập tự khởi động worker bằng launchd sau khi in thử thành công.
