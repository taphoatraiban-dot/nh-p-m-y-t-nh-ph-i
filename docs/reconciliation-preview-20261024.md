# Đối soát chỉ đọc — 24/10/2026

## Trạng thái đã xác minh

- Mốc đầu: `a88e35a4d4235e0454174ace0f275e7687fe89d0`.
- File kiểm thử Telegram đã có tại commit `61f6659`.
- Nhánh sao lưu bổ sung: `backup/six-feature-tested-base-20261024`.
- Trước sửa: 289/289 test PASS trên Node 24.22.1.
- Sau sửa: 330/330 test runner PASS, gồm file phân miền chạy 14 assertion. 283 ca parser chỉ kiểm tra chuẩn hóa, chưa chứng minh toàn bộ parser/tính tiền đúng.
- Bài tải mẫu: 60 nhóm x 100 tin x 2 tài khoản = 12.000 dòng; phát lại 12.000 dòng; giữ đủ 12.000 dòng hợp lệ, nhận diện 12.000 lần lặp, tách 2 tài khoản.
- Không sửa `index.html`, VPS, OTP, Worker, bot, schema hoặc dữ liệu Supabase.

## Hợp đồng dữ liệu

`aggregate(records)` và `reconcile(records)` chỉ nhận dòng đã được parser kiểm tra. Không tự đọc Supabase, không xác thực người gọi, không tự suy ra đài/ngày/đơn vị, không tính giá hoặc tiền trúng.

Adapter tương lai phải lấy dữ liệu của đúng người đăng nhập. Việc gom tách `user_id` không thay thế kiểm soát quyền truy cập.

Bắt buộc: `user_id` chuỗi; `chat_id` số nguyên an toàn khác 0 (chấp nhận ID nhóm âm); `message_id` nguyên dương; `line_id` nguyên không âm; `validated === true`; ngày lịch hợp lệ YYYY-MM-DD; miền MN/MT/MB; đài, kiểu chơi, số dạng chuỗi; đơn vị point/vnd; amount số không âm tối đa 6 số lẻ, giá trị quy đổi phần triệu không vượt MAX_SAFE_INTEGER. Adapter phải chuẩn hóa HN thành MB trước khi gọi.

Có thể giữ: `source`, `raw_text`, `message_date`, `received_at`, `parser_version`, `revision`, tất cả dạng chuỗi. Không gửi nguyên văn tin khách vào log công khai hoặc Actions.

Danh tính dòng = [user_id, chat_id, message_id, line_id]. Bản phát lại giống nội dung chỉ tính một lần; khác nội dung/phiên bản thì cách ly cả danh tính vào `source_conflict`, không chọn bản đến trước hoặc sau. Thời điểm nhận lại khác nhau không gây xung đột. Không suy luận hai tin khác ID là trùng dù cùng nội dung.

`rows` giữ chi tiết theo tài khoản/ngày/miền/đài/kiểu/số/đơn vị và danh sách nguồn. `summary` bỏ chiều số, thêm nguồn và chat_id, trả số dòng/số tin và tổng. Tổng thập phân được cộng bằng BigInt phần triệu; `total_decimal` là chuỗi chính xác có thẩm quyền. `total` chỉ là giá trị số tiện hiển thị, trả null khi tổng phần triệu vượt miền số nguyên an toàn. Không cộng point với vnd.

`complete=false` nếu có dòng cần kiểm tra. Đây chỉ là trạng thái của tập dữ liệu đầu vào, KHÔNG chứng minh đã tải đủ mọi trang Telegram/Supabase. Chưa có mốc đồng bộ, kiểm tra phân trang, chốt ngày hay bút toán điều chỉnh.

Trước tích hợp cần xử lý phiên bản ở cấp toàn tin (tin sửa có thể xóa dòng cũ), kiểm tra lịch đài và kiểu chơi, so sánh kết quả với máy tính hiện hành. Không dùng tổng này cho thu/bù/trúng.

## Kiểm tra Supabase chỉ đọc

- licenses, member_subscriptions, ott_memberships, telegram_member_messages bật RLS.
- telegram_member_messages có UNIQUE(user_id, chat_id, message_id).
- anon/authenticated không có UPDATE cột profiles.role; authenticated không INSERT trực tiếp licenses/member_subscriptions; anon không gọi check_license/admin_member_change.
- admin_activate_license kiểm tra profiles.role; admin_member_change kiểm tra admin_users; gia hạn đang còn thời gian được cộng tiếp từ hạn cũ.
- check_license kiểm tra hạn và active bằng giờ máy chủ; hết hạn không xóa dữ liệu.
- admin_member_change(action='revoke') hiện DELETE bản ghi đăng ký gói: cần chuyển sang vô hiệu hóa có lịch sử trước khi mở rộng quản trị thương mại. Chưa gọi hàm hoặc thay đổi hành vi.
- Có ba nguồn trạng thái licenses/member_subscriptions/ott_memberships; phải lập bản đồ nơi sử dụng trước khi hợp nhất quyền.
- Advisors báo pg_net ở public, bảo vệ mật khẩu rò rỉ chưa bật, 41 hàm SECURITY DEFINER cho authenticated gọi và 23 bảng RLS không có policy. Đây là cảnh báo cần đánh giá theo luồng RPC, không tự thêm policy mở đọc dữ liệu.

## Sao lưu và khôi phục

Nhánh Git chỉ sao lưu mã. Các công cụ Supabase hiện có chưa cung cấp danh sách/số lần backup hoặc PITR của dự án; chưa xác nhận có backup DB dùng được, chưa diễn tập restore. Không được coi bản xuất cục bộ trên Safari là backup đầy đủ hệ thống.

Trước migration thương mại: xác minh backup trong Dashboard, tạo bản sao dữ liệu và schema được mã hóa ở nơi riêng, gồm roles/grants/functions/policies và Storage nếu có; không đưa bản dump chứa dữ liệu khách/khóa vào GitHub. Khôi phục vào dự án thử biệt lập, vô hiệu các tác vụ gửi tin/cron trong môi trường thử để tránh phát tin lặp, kiểm tra số bản ghi/ràng buộc/quyền và đối chiếu tổng; tuyệt đối không thử restore đè production.

Tồn tại chức năng backup thủ công ở index.html cho localStorage và kho tin mã hóa; nhập hiện có thể ghi đè dữ liệu thiết bị. Chưa kiểm thử thực tế quy trình này trong đợt hiện tại.

## Phần tiếp theo chưa hoàn thành

- Parser end-to-end, lịch đài, tính tiền và các cú pháp mơ hồ; kiểm thử chuẩn hóa không thay thế chúng.
- Adapter 10–50+ nhóm đang chạy, phân trang, phiên bản toàn tin, kiểm soát tài khoản và mốc đồng bộ.
- Giao diện đối soát, chốt ngày, điều chỉnh sau chốt; so sánh dữ liệu mẫu với hệ thống tính tiền cũ.
- Backup DB có kiểm chứng, lịch backup và diễn tập khôi phục.
- Quản trị thương mại: thu hồi không xóa lịch sử, audit cấp/gia hạn, kiểm thử đồng thời và hợp nhất nguồn quyền.
