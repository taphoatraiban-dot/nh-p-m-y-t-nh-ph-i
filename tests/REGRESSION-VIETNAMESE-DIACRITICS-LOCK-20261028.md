# Khóa hồi quy: chuẩn hóa tiếng Việt có dấu (28/10/2026)

Người dùng đã xác nhận bản chính thức hoạt động đúng sau commit c0f62378fd9b60994451bf4d3ae0e62663b1d4a2.

## Đầu vào / đầu ra bắt buộc
- `Bạc Liêu\n58 đầu 50.\n59 đầu 10.` → đài `blieu`, cược `58dau50.` và `59dau10.`
- `Bạc Liêu58 đầu 60\n59 đầu 20` → đài `blieu`, cược `58dau60.` và `59dau20.`; không được nhận thành Bến Tre.
- `Bến Tre\n48 đầu 10.` → đài `btre`, cược `48dau10.`
- `Vũng Tàu\n59 đuôi 20.` → đài `vtau`, cược `59duoi20.`
- `đảo lô 1n` → `bdao1n`; `đảo xc 10n` → `xdao10n`.
- Không đổi số, dấu phẩy thập phân, thứ tự cược, hoặc nội dung gốc đang hiển thị.

## Không được làm hỏng các mốc đã xác nhận
- `300.033bdao1.xdao10.`: cả `300` và `033` DAO XC phải được tính đúng một lần.
- Mẫu 2DMN đầy đủ: 1152k; mẫu rút gọn: 848k.
- 13 tin Telegram: Nam 2044k, Trung 3252k, Bắc 2603k, tổng 7899k.
- `148.348.848xc3.xduoi10.`: ba XC và ba XC-ĐUÔI, không thiếu hoặc trùng.

## Trạng thái
Nhánh snapshot: `locked/vietnamese-diacritics-verified-20261028`.
Đây là tài liệu chốt nghiệm thu và snapshot, KHÔNG phải kiểm thử tự động hay branch protection. Khi sửa parser, phải chạy kiểm thử hồi quy trước khi phát hành.
