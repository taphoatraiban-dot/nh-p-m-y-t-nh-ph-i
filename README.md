# CUNCUN — hướng dẫn bảo trì

Ứng dụng web tĩnh, kèm các hàm Supabase, migration PostgreSQL, worker Telegram và công cụ in cục bộ. Trang chính là `index.html`; các URL `index*.html` cũ chuyển về trang chính. Dữ liệu thật không nằm trong kho mã.

## Cấu trúc

- `src/`: các thành phần in, đồng bộ và sao lưu phía trình duyệt.
- `assets/telegram-chat/`: giao diện Chat. Sửa `chat.js`/`chat.css`, sau đó chạy `node scripts/release-telegram-chat.cjs` để tạo tệp mang mã băm và cập nhật URL trong trang chính.
- `supabase/functions/`: API; `supabase/migrations/`: thay đổi cấu trúc và quyền dữ liệu.
- `telegram/`: worker chạy trên VPS; `printing/`: công cụ in cục bộ.
- `tests/`: kiểm thử với dữ liệu mẫu; `docs/`: hướng dẫn vận hành và phát hành.

## Chạy kiểm tra

Dùng Node 24. Cài các phụ thuộc đã khóa phiên bản:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix tests/permissions
```

Kiểm tra phần lưu trữ dữ liệu, quyền sở hữu và Chat (không kết nối dữ liệu thật):

```sh
NODE_PATH=tests/permissions/node_modules node --test tests/receipt-archive.test.cjs tests/qr-receipt-privacy.test.mjs tests/permissions/receipt-*.test.cjs tests/chat/*.test.cjs
```

Bộ phân quyền bổ sung:

```sh
npm test --prefix tests/permissions
```

Kiểm thử giao diện cần Chromium của Playwright (`npx --prefix tests/permissions playwright install chromium`) hoặc biến `PW_EXECUTABLE` trỏ tới trình duyệt Chromium tương thích. Chrome giả lập điện thoại không thay thế kiểm thử Safari/iPhone thật.

Bộ kiểm thử rộng đang có **hai lỗi nghiệp vụ tồn tại từ trước**: `tests/2dmt-5464-regression.test.cjs` và ca lịch đài trong `tests/station-alias-input-regression.test.cjs`. Các kiểm tra lỗi này được giữ nguyên, không bị bỏ qua hay đổi kỳ vọng để tạo kết quả xanh. Đợt bảo trì dữ liệu ngày 15/11 không thay đổi bộ phân tích cược, công thức hay giá tính.

## Phát hành và khôi phục

Đọc [hướng dẫn lưu trữ và lịch sử Chat](docs/data-retention-release.md) trước khi triển khai thay đổi mới. Migration phải được kiểm tra trên môi trường thử, sau đó áp dụng trước API và giao diện có sử dụng cột mới.

Không đưa khóa máy chủ, mật khẩu, phiên Telegram, bản xuất dữ liệu khách hoặc tệp `.env` vào Git. Khóa công khai trong trình duyệt không thay thế kiểm soát quyền ở máy chủ.

GitHub chỉ lưu mã nguồn. Sao lưu/khôi phục toàn bộ dữ liệu, phiên Telegram và VPS cần quy trình riêng; xem [hướng dẫn sao lưu](docs/backup-recovery-runbook.md).
