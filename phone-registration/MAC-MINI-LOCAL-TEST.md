# Chạy thử SĐT + mật khẩu trên Mac mini (không dùng SMS)

> Chỉ chạy trong Supabase LOCAL, không đăng nhập vào project production và không dùng số của khách.

## Chuẩn bị
1. Mở Docker Desktop và đợi Docker chạy.
2. Trong Terminal, kiểm tra `docker --version`, `node --version`, `supabase --version`.
3. Nếu chưa cài Supabase CLI, xem hướng dẫn chính thức: https://supabase.com/docs/guides/local-development/cli/getting-started (không tự chạy lệnh cài đặt không rõ nguồn).
4. Tạo thư mục thử nghiệm riêng, dùng `supabase init` và kiểm tra tài liệu cấu hình Auth hiện hành. Bật phone signup và tắt phone confirmation **chỉ tại local**. Tuyệt đối không sửa cấu hình production.
5. Khởi động bằng `supabase start`, dùng `supabase status` để lấy API URL và anon/publishable key LOCAL.

## Chạy kiểm thử
Từ bản checkout nhánh `feature/phone-password-registration-isolated-20261102`, đặt các biến môi trường sau trong Terminal (dùng dữ liệu giả, không dùng số khách):

```bash
export LOCAL_PHONE_E2E=1
export LOCAL_PHONE_E2E_URL=http://127.0.0.1:54321/auth/v1
export LOCAL_SUPABASE_ANON_KEY='DAN_ANON_KEY_LOCAL_TU_SUPABASE_STATUS'
export LOCAL_PHONE_E2E_NUMBER='0912345678'
export LOCAL_PHONE_E2E_PASSWORD='mat-khau-thu-nghiem-rat-dai'
node --test phone-registration/*.test.mjs
```

Nếu số thử nghiệm đã đăng ký trong database local, dùng số giả mới đúng định dạng hoặc reset **chỉ local**. Không dùng `supabase db reset --linked` và không dùng lệnh có `--project-ref` trỏ production.

## Kết quả cần kiểm tra
- Có token khi đăng nhập SĐT/mật khẩu sau đăng ký.
- Không gửi SMS, không dùng Gmail, không cấp bản quyền.
- Gmail cũ vẫn chạy ở hệ thống hiện tại vì PR chưa được merge.
- Nếu test lỗi: gửi thông báo lỗi đã ẩn khóa/mật khẩu, không gửi key hay token.

## Giới hạn
Bài kiểm thử này không xác minh người dùng sở hữu SĐT; không cho phép tự khôi phục mật khẩu qua số chưa xác minh. Đừng bật tính năng cho khách trước khi hoàn thành kiểm thử an ninh và quy trình hỗ trợ tài khoản.
