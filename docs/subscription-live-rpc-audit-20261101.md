# Audit RPC thực tế — cấp quyền và thiết bị (01/11/2026)

**Nguồn:** đọc trực tiếp `information_schema.routines` trên Supabase `zigpqddlhvjbjrwhfhaa`. Không chạy migration, không thay đổi bản ghi.

## Kết quả
| RPC | Hành vi hiện tại | Vấn đề cần giải quyết |
|---|---|---|
| `claim_device` | Dựa trên `auth.uid()`, ghi mã thiết bị đầu tiên; mã khác bị từ chối | Mã thiết bị do client gửi; không có chuyển quyền sang B và thu hồi phiên A |
| `admin_reset_device` | Kiểm tra `profiles.role='admin'`, sau đó `DELETE FROM public.devices` của user | Mất lịch sử thiết bị; không thu hồi phiên Auth; cần audit và bảo vệ tài khoản admin |
| `check_license` | Admin bypass, giấy phép `licenses` active và chưa hết hạn | Không kiểm tra phiên đang được chọn |
| `check_email_license` | Admin bypass, giấy phép `email_licenses` active và chưa hết hạn | Không kiểm tra phiên đang được chọn |
| `member_access_status` | Lấy `ott_memberships`, xét `trial_ends_at` và `paid_until` | Nguồn quyền khác với hai RPC trên; không kiểm tra phiên |

## Hướng sửa
1. **Không thay thế RPC cũ ngay**. Giữ nguyên khách đang hoạt động.
2. Dùng phiên Auth (`auth.jwt()->>'session_id'`) làm nguồn kiểm tra, thay vì tin mã thiết bị client tự cung cấp. Cần xác minh claim và kiểm thử logout.
3. Không triển khai hai nguồn quản lý thiết bị song song. Migration `20261101001000_stage_single_session_gate.sql` mới là **ứng viên**; phải điều chỉnh/loại bỏ khi chọn phương án hợp nhất.
4. Viết một cổng truy cập server có thể bảo vệ toàn bộ RPC/Edge Functions liên quan; mọi endpoint còn dùng trực tiếp `check_license` hoặc `check_email_license` phải được rà soát.
5. Thiết kế reset thiết bị qua admin có audit, không xóa lịch sử; xử lý phiên A/B và mất điện thoại.
6. Trước merge: sao lưu Supabase và thử restore trên môi trường độc lập; kiểm thử login 2 máy, gia hạn, hết hạn, trial, quyền admin, Telegram, QR, phơi và in.

## Điều kiện chặn
Chưa xác minh backup/restore, RLS và vị trí gọi RPC trong ứng dụng. Không thực thi migration, không bật giới hạn một máy ở production, không merge PR #16.
