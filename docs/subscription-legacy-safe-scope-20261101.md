# Quyết định triển khai: bổ sung thương mại, không đổi cấp quyền cũ

Đã thống nhất: giữ nguyên mọi máy, tài khoản, quyền admin, giấy phép và quy trình cấp quyền hiện tại. Chỉ bổ sung bảng giá, báo giá gia hạn, ghi nhận thanh toán và lịch sử.

## Những phần KHÔNG ĐƯỢC triển khai từ PR #16
- `supabase/migrations/20261101001000_stage_single_session_gate.sql`: **KHÔNG CHẠY**; không dùng cổng phiên đăng nhập mới.
- `subscription/subscription-access.mjs`: **KHÔNG TÍCH HỢP**; không áp dụng quy tắc chuyển máy 2 lần/30 ngày.
- Không sửa `claim_device`, `admin_reset_device`, `check_license`, `check_email_license`, `member_access_status`.
- Không sửa bảng `devices`, không reset thiết bị cũ, không tự động chuyển giấy phép cũ sang bảng giá mới.

## Phần được tiếp tục
- `subscription/subscription-catalog.mjs`: bảng giá WEB và WEB + IN; WEB + IN chưa mở bán.
- `subscription/manual-renewal.mjs`: báo giá và ngày hết hạn dự kiến, **không ghi dữ liệu**.
- Phần tương lai: giao diện admin chọn khách/gói/kỳ hạn, lập giao dịch chờ xác nhận, lịch sử thanh toán chỉ ghi thêm; sau khi admin xác nhận mới sử dụng luồng cấp quyền cũ đã được kiểm thử.
- Cần xác minh quyền admin ở phía máy chủ, trạng thái thanh toán và tính idempotent trước khi ghi dữ liệu.
- Chưa xác nhận có backup khôi phục được, nên chưa thực hiện migration production.

## Lưu ý PR
PR #16 đang chứa cả các file thử nghiệm về phiên đăng nhập. **Không merge toàn bộ PR**. Trước khi merge, phải loại bỏ các file đó khỏi nhánh phát hành hoặc tạo PR mới chỉ chứa phần thương mại.
