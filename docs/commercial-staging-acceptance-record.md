# Staging acceptance record — commercial-only PR #17

> **Không điền thông tin khách hàng, mã thiết bị, token hoặc mật khẩu vào báo cáo.**
> Không triển khai production nếu bất kỳ mục bắt buộc nào chưa đạt.

| Gate | Bằng chứng cần lưu | Kết quả |
| --- | --- | --- |
| Staging riêng, không trỏ production | Project ref staging đã xác minh | CHƯA KIỂM TRA |
| Sao lưu và khôi phục thử | Thời điểm backup, restore thành công | CHƯA KIỂM TRA |
| Legacy baseline trước migration | Kết quả `commercial/read-only-legacy-counts.sql` | CHƯA KIỂM TRA |
| Migration thương mại trên staging | Nhật ký 4 migration, không sửa bảng cũ | CHƯA KIỂM TRA |
| Postflight RLS/RPC | Kết quả `commercial/read-only-postflight.sql` | CHƯA KIỂM TRA |
| Admin và non-admin | Admin thao tác được, non-admin bị chặn | CHƯA KIỂM TRA |
| Tạo, xác nhận, huỷ, liệt kê | Thử cả 4 kỳ hạn WEB và chuyển trạng thái hợp lệ | CHƯA KIỂM TRA |
| Không tự gia hạn bản quyền | Đối chiếu license trước/sau xác nhận thanh toán | CHƯA KIỂM TRA |
| Legacy baseline sau migration | 7 bảng không bị thay đổi ngoài luồng | CHƯA KIỂM TRA |
| UI tích hợp ứng dụng chính | Chỉ sau khi staging đạt và được duyệt | CHƯA KIỂM TRA |

## Quyết định phát hành

**BLOCKED** cho đến khi toàn bộ gate đạt và có phê duyệt triển khai rõ ràng.

CI Node.js chỉ xác nhận unit/static tests; không chứng minh Supabase staging đã chạy hoặc backup đã khôi phục được. Không merge PR #16 (nhánh single-session cũ).
