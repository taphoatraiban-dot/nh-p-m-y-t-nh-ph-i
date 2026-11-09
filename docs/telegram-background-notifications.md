# Thông báo Telegram khi rời hoặc đóng phần mềm

Tính năng dùng Web Push trên hạ tầng hiện có. Mỗi thiết bị phải được người dùng cho phép một lần; không tự cấp quyền hệ điều hành.

## Cách bật

1. Mở cuncun.icu và đăng nhập tài khoản của mình.
2. Mở Telegram Chat, bấm **Bật báo tin khi đóng PM** và chọn **Cho phép**.
3. Trên iPhone/iPad: mở bằng Safari, chọn Chia sẻ → Thêm vào Màn hình chính; mở từ biểu tượng đó, đăng nhập rồi bật thông báo. Cần iOS/iPadOS có hỗ trợ Web Push cho ứng dụng Màn hình chính (từ 16.4).
4. Khi cần dừng, bấm **Tắt báo tin khi đóng PM** trên thiết bị đó, hoặc tắt trong cài đặt thông báo của hệ điều hành.

Đóng/rời trang và hết hạn PIN Chat không tắt đăng ký thông báo. Nút âm báo đang mở PM cũng nhớ lựa chọn bật/tắt theo tài khoản trên trình duyệt. Bật/tắt báo nền là lựa chọn theo từng thiết bị; muốn bật trên điện thoại và máy tính thì thao tác một lần trên từng thiết bị.

Thông báo nền chỉ hiện “Có tin nhắn Telegram mới. Mở phần mềm để xem.” Không có tên người gửi, nhóm, nội dung tin hay số tiền trên màn hình khóa. Bấm thông báo mở phần mềm; vẫn phải đăng nhập/mở khóa để đọc tin.

## Giới hạn thực tế

Chuông nền là chuông của hệ điều hành/trình duyệt, không phải âm Web Audio trong trang. Âm lượng, chế độ im lặng, Focus/Không làm phiền, quyền thông báo và cơ chế tiết kiệm pin có thể làm chuông không phát. Phần mềm không vượt qua những cài đặt đó. Ép dừng trình duyệt hoặc thu hồi quyền thông báo có thể dừng việc nhận.

Không dùng timer chạy nền để giả vờ duy trì trang. Service worker chỉ xử lý push, không lưu nội dung tin, không chặn hoặc thay đổi các yêu cầu tính tiền, in phơi hay đồng bộ. Không có fetch handler hoặc bộ nhớ đệm trang/phiên.

## Phân quyền và triển khai

- Subscription chứa khóa thiết bị chỉ nằm ở bảng service-only có RLS; trình duyệt chỉ quản lý thiết bị đang dùng bằng JWT của tài khoản hiện tại.
- Giới hạn 10 thiết bị đang bật mỗi tài khoản. Không ghi đè subscription của tài khoản khác. Đổi tài khoản trên cùng trình duyệt sẽ ngắt subscription cũ trước khi đăng ký mới.
- Chỉ nhận push từ các tin mới sau khi bật; bỏ tin gửi đi, tin đã ẩn, nhóm đã tắt, tin dịch vụ xác thực Telegram và lịch sử cũ.
- Hàng đợi có khóa chống xử lý trùng, retry có giới hạn và biên nhận bền trên VPS. Worker trình duyệt cũng nhớ mã thông báo đã hiển thị để hạn chế báo lặp.
- Khóa riêng VAPID được tạo và giữ trong `/etc/ongthantai-push/vapid-private.pem` trên VPS, quyền 0600, cung cấp cho dịch vụ bằng systemd LoadCredential. Không đưa khóa riêng vào GitHub hoặc frontend.
- Bộ gửi `ongthantai-push.service` dùng DynamicUser, StateDirectory riêng, API key giới hạn cho hàng đợi push; không dùng service-role key trên VPS và không lấy nội dung Telegram.
- Endpoint `telegram-push` xác thực JWT cho thiết bị và khóa dispatcher cho gửi nền. Dịch vụ không gửi gì khi chưa có thiết bị đăng ký.
- Không thuê thêm VPS hay tạo nhánh Supabase tính phí. Vẫn sử dụng tài nguyên/hạn mức sẵn có; không cam kết tổng sử dụng luôn dưới hạn mức của nhà cung cấp.

## Kiểm chứng

23 ca JavaScript/SQL/frontend/worker đạt; 2 ca Python dispatcher đạt. Kiểm tra SQL thật xác nhận cấu hình sẵn sàng, hàng đợi hoạt động và tài khoản anon/authenticated không đọc bảng khóa hoặc gọi claim. Bộ gửi mã hóa/ký một payload giả thành công mà không gửi ra ngoài. Dịch vụ nền đã chạy, không có lỗi khi kiểm tra.

Cần người dùng bật quyền trên thiết bị thật và thử nhận một tin Telegram khi đóng phần mềm để nghiệm thu giao tận thiết bị/âm thanh. Không tuyên bố đã kiểm tra iPhone, Android và máy tính thực tế khi chưa có các đăng ký và xác nhận đó.

Nguồn: [Apple/WebKit](https://webkit.org/blog/13878/), [MDN Push/Background](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation), [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), [pywebpush](https://pypi.org/project/pywebpush/2.5.0/).
