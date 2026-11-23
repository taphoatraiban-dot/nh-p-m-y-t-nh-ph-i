# Tích hợp sao lưu phơi: trạng thái và điều kiện phát hành

Trạng thái: **đã có điểm bật đồng bộ do người dùng chủ động chọn trong trình quản lý in; mặc định không tự bật**. Nút **ĐỒNG BỘ NGAY** gọi thiết lập đồng bộ cho phiên đăng nhập hiện tại hoặc đồng bộ ngay nếu đã bật. Luồng in tiếp tục không chờ mạng sao lưu.

## Hành vi và giới hạn đã xác minh
1. Bản sao lưu phơi dùng hàng đợi cục bộ và thao tác cloud không được làm chặn lệnh in.
2. Người dùng phải chủ động bấm nút đồng bộ; không tự khởi chạy sau khi cài đặt hoặc đăng nhập.
3. Dữ liệu cloud được gắn với tài khoản đăng nhập; luồng phục hồi hợp nhất theo ID và chặn ghi nếu tài khoản đổi trong khi tải.
4. Các kiểm thử trong `tests/phoi-recent-integration.test.cjs` kiểm tra adapter với dữ liệu giả. Chúng **không thay thế** kiểm tra phục hồi end-to-end trên bản ứng dụng và tài khoản staging.
5. Trước khi phát hành rộng: kiểm thử in Wi-Fi khi online/offline, đóng/mở app, cài lại rồi đăng nhập phục hồi, đổi tài khoản, ID trùng, qua 00:00 giờ Việt Nam và phiếu quá hạn.
6. Phải xác minh lịch dọn bản ghi phía máy chủ và chính sách RLS theo tài khoản. Lọc phía ứng dụng không tương đương xóa dữ liệu trên máy chủ.
7. Không chạy phục hồi thử hoặc xóa trên tài khoản production. Dùng tài khoản staging có dữ liệu kiểm thử, xác nhận sao lưu database trước migration hoặc thao tác thay đổi dữ liệu.

## Kiểm tra production chỉ đọc (23/11/2026)
Dự án production `zigpqddlhvjbjrwhfhaa` đang có bảng sao lưu phơi và tác vụ `cuncun-retention-24h` chạy hàng giờ; tác vụ dọn các bản ghi liên quan quá 24 giờ. Không xóa bản ghi production trong đợt kiểm tra này.

Các bảng `public.printed_phoi` và `public.print_queue` vẫn có RLS theo `auth.uid() = user_id`. Policy `phone_license_guard` là RESTRICTIVE, nên được kết hợp với policy chủ sở hữu bằng AND. Không thay đổi policy production.

## Kiểm thử Supabase staging (23/11/2026)
Tạo nhánh Supabase tạm không mang theo dữ liệu production, áp dụng migration sao lưu rồi kiểm tra qua SQL: chủ phiếu đọc được bản ghi của mình; tài khoản thứ hai không đọc hoặc ghi được bản ghi chủ; dấu xóa chặn upload đến muộn; vai trò anon không có quyền đọc; authenticated không được gọi hàm dọn. Advisor staging không phát hiện cảnh báo mới trên hai bảng sao lưu. Giao dịch kiểm thử đã rollback; xác nhận sau đó staging không còn hàng thử nghiệm. Nhánh staging tạm đã xóa.

Phép thử này xác minh schema, RLS và trigger trên Supabase; chưa mô phỏng đăng nhập thật trên iPhone, cài lại ứng dụng hoặc phục hồi hàng đợi cục bộ. Các ca đó vẫn cần chạy trên bản ứng dụng với tài khoản staging được cấp phép trước khi phát hành rộng.

## An toàn dữ liệu và kiểm thử còn lại
Các test đơn vị bao phủ hàng đợi, phục hồi hợp nhất, đổi tài khoản giữa lúc tải, đánh dấu xóa và retry khi offline. Vẫn cần chạy bộ kiểm tra trên tài khoản staging trước khi bật rộng, đặc biệt kiểm thử cạnh tranh giữa upload cũ và dấu xóa trên PostgreSQL thật. Không suy ra bảo đảm giao dịch từ test đơn vị.

Tác vụ dọn 24 giờ đã được xác minh đang hoạt động. Cửa sổ hiển thị và giữ cục bộ trong PR này được chỉnh về 24 giờ để đồng nhất với tác vụ đó.
