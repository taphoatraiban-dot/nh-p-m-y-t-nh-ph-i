# Kiểm thử độc lập

Chạy ở thư mục gốc với Node 24:

```sh
node --test tests/parser-regression.cjs tests/telegram-reconcile.test.cjs tests/telegram-region.test.cjs
```

Không dùng dữ liệu khách thật. Parser: 283 ca chuẩn hóa thuần, chưa kiểm tra toàn bộ cú pháp/lịch đài/tính tiền. Bộ gom: kiểm tra nguồn, xung đột, đơn vị, số thập phân, tài khoản và tải 60 nhóm. Phân miền Telegram: 14 assertion trong một file test.

330 mục test runner PASS tại bản nâng cấp ngày 24/10/2026. Đọc `docs/reconciliation-preview-20261024.md` về hợp đồng đầu vào và giới hạn trước tích hợp.
