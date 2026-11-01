# Triển khai thương mại độc lập — bảo vệ quyền cũ

Nhánh này xuất phát từ `main`, không kế thừa các thử nghiệm quản lý phiên đăng nhập ở PR #16.

## Phạm vi
- Báo giá WEB / WEB+IN theo bảng giá được duyệt.
- Gia hạn dự kiến (cộng dồn khi còn hạn; bắt đầu từ hiện tại nếu đã hết hạn).
- SQL **chưa chạy** để lưu đơn thanh toán, chỉ ghi lịch sử; không tự động cấp hoặc thu hồi giấy phép.
- WEB+IN chưa mở bán.
- Chưa nối giao diện admin, chưa triển khai Supabase.

## Bảo toàn
Không sửa `claim_device`, `admin_reset_device`, `check_license`, `check_email_license`, `devices`, `licenses`, `email_licenses`, `member_subscriptions`, `ott_memberships`. Không chuyển đổi khách cũ, không ép đăng nhập lại, không thay đổi quyền vĩnh viễn.

## Kiểm thử và phát hành
- Chạy `node --test commercial/*.test.mjs` (bao gồm kiểm tra tĩnh 4 migration SQL).
- GitHub Actions run #27 tại commit `a0fa3fdc214ae5b9057abbfe5fe1e95e85b68a26` đã thành công; phải chạy lại cho commit mới.
- Kiểm thử SQL thực tế trên staging tách biệt với kiểm thử tĩnh, chưa hoàn tất.
- Xác minh sao lưu Supabase có thể khôi phục.
- Kiểm tra RLS, quyền admin, giao dịch trùng, bảng giá lưu trên server và thao tác xác nhận thanh toán.
- Tích hợp admin bằng RPC riêng, bảo đảm idempotent; **không cấp quyền khi chỉ tạo đơn**.
- Khi admin xác nhận thanh toán, dùng đúng luồng cấp quyền hiện hữu đã kiểm thử, không viết lại logic cấp quyền.
- Không merge trước khi kiểm thử hồi quy máy đã cấp quyền, Telegram, QR và in.
