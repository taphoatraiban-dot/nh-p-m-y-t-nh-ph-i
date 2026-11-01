# Tích hợp bảng quản lý thuê bao vào admin hiện có

**Trạng thái: CHƯA TRIỂN KHAI.** Không tự động gắn module lên `index.html` khi chưa xác minh luồng xác thực admin và backup/restore.

## Cách dùng (sau khi áp dụng migration và kiểm thử staging)
```js
import { mountCommercialAdmin } from './commercial/admin-panel.mjs';
// Chỉ chạy sau khi host đã xác minh admin và có client Supabase đã đăng nhập.
// Không truyền service_role key.
mountCommercialAdmin({
  root: document.getElementById('commercial-admin-root'),
  client: existingAuthenticatedSupabaseClient,
});
```

## Tách biệt bắt buộc
- Không thay đổi `claim_device`, `admin_reset_device`, `devices`.
- Không thay đổi `check_license`, `check_email_license`, `licenses`, `email_licenses`, `member_subscriptions`.
- RPC tạo đơn và xác nhận thanh toán **không** cấp/gia hạn bản quyền. Admin dùng quy trình cấp quyền cũ riêng sau khi đối chiếu đơn.
- Không có truy cập trực tiếp bảng đơn hàng cho `anon`/`authenticated`; chỉ RPC có kiểm tra `admin_users`.
- Chưa cho WEB+IN mở bán.

## Chặn phát hành
1. Xác minh bản sao lưu và phục hồi Supabase.
2. Chạy thử migration trong môi trường staging; xem lại quyền EXECUTE, RLS và truy cập schema.
3. GitHub Actions `Commercial unit tests` đã chạy thành công tại commit `af4ab03fad7707734bfbd4643dcd73b7f521292f` (run `41332028936`), bao gồm kiểm thử JavaScript và kiểm tra tĩnh các migration SQL. Chưa có kiểm thử migration trực tiếp trên staging; kết quả CI không chứng minh migration an toàn khi áp dụng.
4. Kiểm thử admin thật, người dùng thường, thanh toán trùng và xác nhận hai lần.
5. Xác minh người dùng cũ vẫn đăng nhập, không mất quyền, Telegram, QR và in không đổi.
6. Chưa tự động gia hạn theo tháng: `admin_activate_license` hiện dùng `p_days`, còn `admin_member_change` chỉ nhận `vip/pro` với 30 ngày. Cần quy định rõ nguồn quyền trước khi nối.

**PR #17 đang ở dạng draft; không merge và không chạy SQL production cho tới khi các điều kiện trên đạt.**

## Kịch bản kiểm thử staging trước khi tích hợp

1. Dùng **Supabase project staging riêng**, không trỏ URL hoặc khóa tới production.
2. Sao lưu dữ liệu và thử khôi phục trước khi chạy migration; ghi lại kết quả.
3. Áp dụng 4 migration theo thứ tự timestamp, xác minh RLS và quyền EXECUTE.
4. Tài khoản thường và chưa đăng nhập: mọi RPC thương mại phải bị từ chối.
5. Admin: tạo đơn WEB đủ 4 kỳ hạn; đối chiếu số tiền do server tính, không tin giá từ trình duyệt.
6. Xác nhận một đơn pending, thử xác nhận lần hai (phải từ chối); hủy một đơn pending, thử hủy lần hai (phải từ chối); không hủy đơn confirmed.
7. Thử dùng cùng mã thanh toán hai lần (phải bị chặn), WEB+IN phải bị từ chối.
8. Đối chiếu quyền, thiết bị, thời hạn và số lượng admin trước/sau; tuyệt đối không tự gia hạn license sau khi xác nhận thanh toán.
9. Chỉ gắn `mountCommercialAdmin` vào giao diện chính sau khi có biên bản kiểm thử và chủ sở hữu đồng ý.
