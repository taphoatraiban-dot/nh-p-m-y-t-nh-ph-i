# Kiểm thử độc lập

Chạy ở thư mục gốc với Node 24:

```sh
node --test tests/parser-regression.cjs tests/telegram-reconcile.test.cjs tests/telegram-region.test.cjs tests/parser-money.test.cjs tests/reconcile-preview.test.cjs
```

413 mục test runner PASS tại đợt cập nhật 24/10/2026. Không dùng dữ liệu khách thật.

- Parser regression: 283 ca chuẩn hóa thuần.
- Parser money: 75 ca chạy parser sản xuất đến tiền xác, gồm lỗi Bao 4 nối tiếp Bao đảo.
- Telegram reconcile: chống trùng, xung đột, đơn vị, số thập phân, tài khoản và tải 60 nhóm.
- Telegram region: 14 assertion trong một file test.
- Preview: 5 ca kiểm tra dữ liệu mẫu và bản HTML sinh ra khớp mã hiện tại.

Tạo lại trang mẫu: `node scripts/build-reconcile-preview.cjs`.

Chưa bao phủ toàn bộ lịch đài, dò giải, giá nhận/hồi và thu/bù/trúng. Đọc `docs/parser-money-preview-20261024.md` và `docs/reconciliation-preview-20261024.md` trước tích hợp.
