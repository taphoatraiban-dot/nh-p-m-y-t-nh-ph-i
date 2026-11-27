# Tự động triển khai Edge Function Telegram

Workflow `.github/workflows/deploy-telegram-edge-functions.yml` kiểm tra thay đổi rồi triển khai đúng ba function `telegram-chat`, `telegram-member-sync` và `telegram-tenant` khi commit có liên quan được merge vào `main`.

Workflow kiểm tra giới hạn truy vấn 24 giờ, cấu hình `verify_jwt = false` và biên dịch TypeScript của cả ba function trước khi cho phép triển khai. Khi deploy, workflow cũng xác nhận project ref đúng project production CUNCUN. Các function tự kiểm tra JWT, khóa đồng bộ hoặc webhook secret ở trong mã nguồn. Workflow không chạy migration, không thay đổi secrets của Supabase và không triển khai function khác.

## Cần cấu hình một lần

Trong GitHub, mở **Settings → Secrets and variables → Actions → New repository secret** và thêm:

- `SUPABASE_ACCESS_TOKEN`: access token tạo trong Supabase Account → Access Tokens. Workflow đã cố định project ref production `zigpqddlhvjbjrwhfhaa` và sẽ từ chối deploy nếu mã định danh không đúng.

Không ghi access token vào repository, workflow, tài liệu, hoặc log.

## Cách chạy

- Pull request chạy kiểm tra 24 giờ và kiểm tra cấu hình xác thực; không nhận secrets và không triển khai.
- Sau khi PR được merge vào `main`, workflow chạy lại các kiểm tra rồi triển khai ba function.
- Có thể chạy thủ công bằng **Actions → Deploy Telegram Edge Functions → Run workflow** trên nhánh `main`.

Nếu thiếu một trong hai secret, bước triển khai dừng với thông báo tên secret cần cấu hình.
