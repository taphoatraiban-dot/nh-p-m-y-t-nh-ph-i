# Nhập tin → tiền xác và bảng đối soát mẫu (24/10/2026)

Mốc trước sửa: `546d635422c7d4b833cbb71668b2c9f9e66f1dad`.
Nhánh sao lưu: `backup/parser-money-preview-20261024`.

## Lỗi được tái hiện và sửa

`hn\n5645B12.đảo lô 1.` bị nhánh tách cặp trong `splitChainedSameNumbers` biến phần đảo thành `56bdao1` và `45bdao1`. Trước sửa tạo 3 dòng, tiền xác 294k. Đúng theo công thức hiện hành là 2 dòng giữ số `5645`: Bao 4 giá 20k x 12 điểm = 240k; Bao đảo có 12 hoán vị x 20k x 1 điểm = 240k; tổng 480k.

Thêm nhánh hẹp cho số 4 chữ số + B + BDAO/DAOB nối tiếp, trước nhánh tách cặp cũ. Giữ các quy ước DA+B và các cú pháp khác.

## Kiểm thử

- `tests/helpers/production-parser.cjs` tải trực tiếp vùng parser và hàm bung đài trong index.html vào VM; chỉ cấp ô bets/date và chặn khởi chạy DOM. Không dùng bản sao công thức parser, không đọc dữ liệu thật, không có mạng hoặc tài khoản.
- 75 ca mới từ chuỗi đầu vào đến tiền xác; trước sửa 63 PASS, 12 FAIL đúng biến thể lỗi; sau sửa 75 PASS.
- Có Bao 2/3/4, số 0 đầu, điểm thập phân, XC, DD, MN/MT/HN, lỗi độ dài/đá trùng/thiếu đài, lặp cược hợp lệ, nhiều đài và DA+B.
- Tổng bộ kiểm thử: 413 PASS, 0 FAIL trong môi trường local Node 24.
- 5 ca kiểm tra trang mẫu được sinh từ đúng mã hiện tại, số tiền từng tin khớp kỳ vọng viết riêng và phát lại không nhân tổng.
- Chưa bao phủ toàn bộ cú pháp, dò kết quả, lịch mở thưởng, giá nhận/hồi, thu/bù/trúng, hay giao diện MB riêng. Đây không phải xác nhận toàn bộ tính tiền end-to-end.

## Trang mẫu

`doi-soat-thu.html` là trang riêng, tự chứa, không gọi API và không cần đăng nhập. Tạo lại bằng `node scripts/build-reconcile-preview.cjs`.

Có lọc miền/nhóm, tổng thực tế/kỳ vọng/chênh lệch, bảng theo đài/kiểu chơi/nguồn, mở tin gốc và thử phát lại. Bộ mẫu gồm 5 tin hợp lệ (818.500đ tiền xác) và 1 tin lỗi bị loại toàn bộ. Đơn vị của trang là đồng; gross nội bộ parser là nghìn đồng nên chỉ chuyển đổi một lần khi tạo mẫu.

Không chèn trang mẫu vào phần tính tiền, không đọc Telegram thật, không thay đổi Supabase, bot, OTP hoặc VPS. Chưa tích hợp luồng đọc thật/phân trang/phiên bản toàn tin hoặc chốt đối soát.
