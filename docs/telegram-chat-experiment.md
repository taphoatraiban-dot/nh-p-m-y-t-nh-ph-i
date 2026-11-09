# Telegram Chat thử nghiệm — ÔNG THẦN TÀI

Nhánh: `experiment/telegram-chat`. Ưu tiên không phát sinh phí theo yêu cầu ngày 09/11/2026.

## Phạm vi đã triển khai

- Màn hình Telegram Chat riêng, danh sách nhóm và cá nhân được cấp quyền, bộ lọc hội thoại, ô soạn và gửi hai chiều bằng tài khoản Telethon đang được cấp quyền.
- PIN Chat đúng 4 số, xác nhận khi tạo. Máy chủ lưu bcrypt, khóa 15 phút sau 5 lần sai; vé mở Chat tồn tại 10 phút, chỉ giữ trong bộ nhớ trình duyệt. Đóng Chat, khóa thủ công hoặc đăng xuất sẽ xóa nội dung trên màn hình và bản nháp. Đây là khóa bổ sung cho màn hình Chat; luồng đồng bộ và hộp tin cũ vẫn hoạt động theo đăng nhập hiện có.
- Âm báo cần người dùng bấm Bật âm báo để trình duyệt cho phép. Không báo lại lịch sử khi mở; không báo tin gửi từ phần mềm. Hoạt động khi trang Chat đang mở và trình duyệt còn chạy, không phải thông báo đẩy khi đóng ứng dụng.
- Mỗi tin có nút Đưa vào nhập phơi thủ công: nối vào `#bets` và phát sự kiện nhập liệu. Không gọi tính tiền, lưu phơi hay in tự động.
- Gửi có trạng thái Chờ VPS gửi / Đang gửi / Đã gửi / Gửi thất bại. Chỉ xác nhận đã gửi sau biên nhận Telegram. UUID giữ nguyên khi gửi lại sau lỗi mạng; worker dùng MTProto random_id ổn định và biên nhận lưu bền trước khi báo máy chủ.
- Mỗi hội thoại tải tối đa 200 tin gần nhất; trạng thái hàng đợi tải 100 mục gần nhất. Nhận tin dùng cơ chế đồng bộ hiện có; làm mới màn hình mỗi 3 giây.

## Tình trạng triển khai ngày 09/11/2026

Đã triển khai Edge Function `telegram-chat`, ba bảng Chat riêng và bộ gửi trên VPS hiện có. Chỉ một tài khoản quản trị được bật qua `telegram_chat_access`; các tài khoản khác bị từ chối ở máy chủ. Không tạo Supabase branch trả phí, không thuê thêm VPS.

Bộ gửi chạy cùng dịch vụ Telegram quản trị qua bản sao worker riêng; tệp worker gốc giữ nguyên. 5 worker khách hàng và API tự kết nối vẫn chạy. Đã sao lưu mã, cấu hình, hàng đợi và bản sao SQLite nhất quán của phiên Telegram trong thư mục chỉ root đọc trên VPS trước khi thay đổi.

Đã thử gửi một tin vào Saved Messages của chính tài khoản quản trị: Telegram trả biên nhận và bản tin đồng bộ về phần mềm. Không gửi cho nhóm/khách. Chỉ cho phép cá nhân là Saved Messages; các liên hệ cá nhân khác cần được chọn/cấp quyền riêng trước khi bật.

Đã kiểm tra bcrypt, đếm sai PIN, khóa 15 phút, hạn vé và quyền truy cập trên Postgres thật. PIN kiểm thử được rollback; chưa đặt PIN thay người dùng. Người dùng tự tạo PIN khi vào Chat.

Trang thử riêng: https://salad-randy-witnesses-bargains.trycloudflare.com/ . Đây là Quick Tunnel tạm thời trên VPS hiện có; link có thể đổi khi khởi động lại và không có SLA. Chưa thay website chính. Không có mật khẩu, phiên Telegram hoặc khóa đặc quyền mới trong gói mã nguồn.

Không sửa parser, cách tính tiền hoặc mã in phơi. Giữ thay đổi tên nút `CUNCUN.ICU` đã có trong bản làm việc trước khi bắt đầu nhiệm vụ này.

## Kiểm thử

Node 24:

```sh
cd tests/chat
npm ci
npm test
cd ../..
python3 -m unittest discover -s tests -p 'test_chat_outbox.py'
python3 -m unittest discover -s tests -p 'test_telegram_private.py'
node --test tests/*.test.cjs tests/*.test.mjs tests/parser-regression.cjs
```

Kết quả tại thời điểm bàn giao:

- 14 ca JavaScript Chat đạt (bao gồm các kiểm thử bổ sung sau rà soát): cổng PIN, xác nhận PIN, đăng xuất xóa dữ liệu, nhóm/cá nhân, chống chèn HTML, đưa tin vào nhập thủ công, giữ UUID sau lỗi mạng, âm báo, từ chối người dùng/hội thoại không có quyền, vé PIN hết hạn, VPS ngoại tuyến, chống ghi đè tin đã xếp hàng.
- 4 ca Python bộ gửi đạt: biên nhận khi báo máy chủ lỗi, từ chối chat ngoài danh sách, random_id và cấp quyền cá nhân.
- 9 ca đồng bộ cá nhân cũ đạt.
- 632 ca hồi quy hiện có: 617 đạt, 15 lỗi. Chạy trên bản gốc cũng lỗi đúng 15 ca đó; không phát sinh ca lỗi mới. Các lỗi cũ liên quan parser, lịch đài, PIN đăng nhập, bản in và quyền đọc phiếu. Xem log và danh sách lỗi trong gói bàn giao. Không sửa lan sang các chức năng này.

Kiểm thử SQL chạy bằng PostgreSQL WASM (PGlite) riêng trên máy, kiểm tra migration, quyền truy cập, đếm sai PIN, vé hết hạn và nhận việc từ hàng đợi. PGlite không có pgcrypto: bài kiểm thử thay riêng hàm mật mã bằng hàm giả xác định để kiểm tra điều khiển SQL. Bcrypt thật và đường gửi Telegram đã được kiểm tra thêm trên hệ thống hiện có như mô tả ở trên. Đăng nhập trình duyệt, âm thanh trên điện thoại và nhận từ người khác vẫn cần người dùng nghiệm thu.

## Chạy thử không tốn phí máy chủ bổ sung

1. Đọc mã nguồn và chạy kiểm thử trên máy hiện tại. Không tạo môi trường Supabase tính phí riêng.
2. Nếu máy có Docker, có thể dựng Supabase cục bộ. Cần tạo schema nền của dự án từ bản sao schema, không áp dụng mù toàn bộ migrations hiện có vì kho này không chứa đầy đủ schema ban đầu. Tạo người dùng thử và dữ liệu nhóm giả; không lấy tin khách thật để kiểm thử.
3. Để thử gửi nhận thật sau này, có thể dùng Supabase/VPS hiện có trong hạn mức và tài nguyên sẵn có, nhưng phải kiểm tra quyền triển khai, tài nguyên, schema và sao lưu trước. Không cam kết phí sử dụng dịch vụ hiện có luôn bằng 0. Đợt này đã bật hạn chế cho một tài khoản quản trị trên hạ tầng hiện có, chưa mở rộng cho khách hàng.

## Các thành phần để bật sau khi nghiệm thu

Chỉ áp dụng migration mới `supabase/migrations/20261109065921_telegram_chat_experiment.sql`, sau khi kiểm tra khóa duy nhất `(user_id,chat_id)` của bảng nhóm và hàm `telegram_member_upsert_messages` hiện hữu.

Triển khai Edge Function `telegram-chat` với `verify_jwt=false` để worker dùng khóa riêng. Trong mã, mọi đường gọi đều kiểm tra JWT người dùng hoặc cặp `x-sync-user`/`x-sync-key`. Cấp quyền từng tài khoản trong `telegram_chat_access.enabled`; mặc định không có tài khoản nào được bật. Biến môi trường `TELEGRAM_CHAT_ENABLED=false` là công tắc tắt khẩn cấp toàn bộ Chat. Secret service-role chỉ nằm ở Edge Function, không đưa vào trang web. Kiểm tra tư vấn bảo mật Supabase trước khi đưa vào chạy thật.

Đưa `chat_outbox.py` cùng thư mục `tenant_worker.py`. Trên cấu hình **tài khoản thử đã được phép**, thêm:

```json
{
  "telegram_chat_enabled": true,
  "chat_endpoint": "https://<PROJECT_THU>.supabase.co/functions/v1/telegram-chat",
  "member_sync_endpoint": "https://<PROJECT_THU>.supabase.co/functions/v1/telegram-member-sync?action=ingest"
}
```

Hai trường endpoint là tùy chọn; mặc định vẫn giữ địa chỉ hiện có. Khi dùng môi trường riêng, phải đổi cả endpoint, người dùng và khóa đồng bộ cho cùng môi trường. Trang web thử cũng phải dùng URL và publishable key của môi trường đó. Không dùng cùng một tệp phiên Telethon cho hai tiến trình; tài khoản thử phải có phiên độc lập và chỉ cấp các nhóm/cá nhân được phép. Không chỉnh allowlist nhóm hiện tại khi thử.

Worker chat chỉ chạy khi giá trị `telegram_chat_enabled` là boolean `true`. Giữ nguyên nhóm được phép; cá nhân cần `allowed_private_chat_ids` hoặc đồng ý `receive_all_private` như thiết kế cũ. Không bắt đầu hội thoại tới một ID tùy ý từ trình duyệt.

Lưu ý vận hành: nếu crash sau Telegram nhận tin nhưng trước khi ghi được biên nhận, worker gửi lại cùng random_id để Telegram chống trùng. Trường hợp Telegram trả lỗi RandomIdDuplicate hoặc không trả được biên nhận, tin dừng gửi tự động và hiển thị “Chưa xác nhận — kiểm tra tin gốc trên Telegram trước khi gửi lại”. Các tin tiếp theo vẫn được xử lý; cần đối soát tin gốc trước khi thao tác tiếp.

## Quay lại bản cũ

Đặt `TELEGRAM_CHAT_ENABLED=false` ở Edge Function hoặc `telegram_chat_access.enabled=false` cho tài khoản thử, rồi tắt cấu hình Chat của worker, rồi trả giao diện về bản cũ. Không xóa hàng đợi đang chờ hoặc bản tin đồng bộ để tránh mất dấu gửi. Các thay đổi dữ liệu mới là bảng/hàm riêng; không đổi bảng nghiệp vụ tính tiền hoặc in phơi.

## Tài liệu đã đối chiếu

- [Bảo vệ Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Quyền truy cập theo hàng](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Telethon client](https://docs.telethon.dev/en/stable/modules/client.html)

## Bổ sung vận hành đợt triển khai thực tế

- Bảng `telegram_chat_access` chỉ service-role truy cập; chứa công tắc tài khoản và thời điểm bộ gửi báo hoạt động. Tin chỉ được xếp hàng khi bộ gửi còn trực tuyến.
- Khi hàng đợi trống, worker tăng khoảng chờ lên tối đa 30 giây để giảm số lần gọi dịch vụ; khi có việc trở về 3 giây. Tin mới có thể chờ khoảng 30 giây trước khi bắt đầu gửi.
- Dịch vụ quản trị dùng `/opt/ongthantai-chat-experiment/member_sync_chat.py`; bản gốc `/opt/ongthantai-telegram/member_sync.py` giữ nguyên. Bản sao được tạo bằng thay đổi hẹp, có thể tái tạo với `telegram/prepare_admin_chat_worker.py` từ bản gốc thực tế.
- Cấu hình Chat: `/etc/ongthantai-telegram/chat-experiment.json`, quyền 0600; không chứa API key hoặc phiên mới. Module `legacy_chat_bridge.py` dùng khóa có sẵn trong tiến trình quản trị.
- Override duy nhất: `/etc/systemd/system/ongthantai-telegram-member.service.d/telegram-chat-experiment.conf`.
- Sao lưu trước triển khai: `/var/backups/ongthantai-chat/20261109T072519Z`, chỉ root đọc.
- Trang thử: `ott-chat-preview.service`, cổng nội bộ 8792, nguồn công khai trong `/opt/ongthantai-chat-preview`.
- Link HTTPS: `ott-chat-preview-tunnel.service`, không sửa tunnel đang phục vụ API cũ. Hai dịch vụ preview không được enable tự chạy khi reboot; link chỉ dùng nghiệm thu tạm thời.
- Muốn quay về worker cũ: tắt quyền tài khoản thử trong bảng access, gỡ riêng override trên, `systemctl daemon-reload` và restart đúng `ongthantai-telegram-member.service`. Dừng hai dịch vụ preview nếu không dùng nữa. Giữ bảng Chat, biên nhận và hàng đợi để đối soát; không xóa dữ liệu.
- Supabase advisor không có WARN/ERROR mới thuộc đối tượng Chat. Ba INFO `RLS Enabled No Policy` là chủ ý: bảng chỉ cho service-role, frontend không đọc trực tiếp. Tham khảo https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Những cảnh báo khác có từ trước không được thay đổi trong đợt này.
- Nguồn về link tạm: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ và https://blog.cloudflare.com/protected-quick-tunnels .

## Rà soát hoàn thiện sau triển khai

- Đưa tin từ Chat sang nhập phơi có dấu sự kiện riêng. Cơ chế nhập cũ chỉ bỏ qua tính tự động cho sự kiện này; gõ/dán thông thường giữ nguyên hành vi. Có kiểm thử chạy đúng handler nhập liệu đang dùng.
- Giữ mã gửi chờ theo từng hội thoại; khi đổi hội thoại lúc mạng chậm, biên nhận chỉ xóa đúng bản nháp của tin được xác nhận, không xóa bản nháp cuộc trò chuyện khác.
- Khi quyền Chat bị thu hồi, dữ liệu đang hiển thị được xóa và quay lại cổng PIN.
- Khóa Chat chỉ thu hồi đúng vé đang khóa, tránh làm mất vé vừa mở lại trong lúc có yêu cầu mạng đến chậm.
- Nếu biên nhận Telegram không rõ, dừng tự gửi lại và yêu cầu đối soát; lỗi một tin không giữ lại toàn bộ các tin phía sau.
- Đã cập nhật các bản sửa lên trang thử và máy chủ hiện có. Chưa đưa giao diện lên website chính.
- Cần đăng nhập tài khoản quản trị trên trang thử để nghiệm thu trực quan; không có mật khẩu/PIN người dùng trong môi trường kiểm thử.

## Mở toàn bộ hội thoại cho tài khoản quản trị

Sau khi người dùng chọn phương án 1, đã bật `receive_all_private: true` cho riêng tài khoản quản trị trong cấu hình bridge. Các nhóm của tài khoản này tiếp tục đồng bộ theo listener cũ. Metadata nhóm và cá nhân được cập nhật; nội dung cá nhân chỉ nhận từ tin mới, không lấy lịch sử.

Danh sách cá nhân được phát hiện mỗi 120 giây và chia lô tối đa 300 mục; tin từ liên hệ mới được đăng ký khi nhận. Bot và hộp tin xác thực/hệ thống Telegram không được nhập như hội thoại cá nhân. Bộ gửi dùng cùng phạm vi đã được cấp cho tài khoản quản trị.

Kiểm tra sau bật: 4 nhóm, 9 hội thoại cá nhân đang hiển thị; không có hội thoại bị ẩn tại thời điểm kiểm tra. 5 worker khách hàng và API vẫn chạy. Cấu hình và module bridge trước thay đổi đã được sao lưu trên VPS. Chưa đưa giao diện lên website chính.

Có thêm 2 kiểm thử bridge về cấp quyền tất cả cá nhân, loại tin hệ thống/bot và chỉ nhận tin mới. Các ca Python bộ gửi và đồng bộ cũ vẫn đạt.

## Phát hành cho toàn bộ kết nối hiện có

Theo yêu cầu bật cho tất cả và đưa lên bản chính, đã gộp thay đổi mới nhất của `origin/main` vào nhánh phát triển; giữ nhãn CUNCUN.ICU hiện hữu.

Đã bật quyền Chat cho 6/6 tài khoản đang kết nối. 5 worker tenant được nâng cấp sang bản có gửi hai chiều, nhận cá nhân hai chiều và polling phục hồi; từng tài khoản giữ nguyên khóa, phiên, nhóm được cấp quyền. Cấu hình và mã được sao lưu trước đổi. Dịch vụ quản trị giữ module bridge riêng. Cả 6 bộ gửi đều báo hoạt động trước bước phát hành giao diện.

Worker tenant dùng `/opt/ongthantai-chat-release/tenant_worker.py` và `chat_outbox.py` qua override riêng từng dịch vụ; không ghi đè worker dùng chung trước đây. Khi quay lại, khôi phục cấu hình đã sao lưu và gỡ riêng `zz-telegram-chat-release.conf`, rồi daemon-reload/restart đúng dịch vụ; giữ hàng đợi để đối soát.

Giữ nguyên parser, công thức tiền, tuyến in và allowlist nhóm. 14 ca JavaScript Chat, 10 ca private-policy, 4 ca outbox và 2 ca bridge đạt. Bộ hồi quy cũ vẫn có đúng 15 lỗi như trước, không có ca lỗi mới. Không tự gửi tin thử tới khách hàng.
