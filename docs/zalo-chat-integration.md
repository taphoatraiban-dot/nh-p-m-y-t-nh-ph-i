# Tích hợp Zalo Chat demo vào CUNCUN (nhánh thử nghiệm)

## Trạng thái
Đã có:
- `experiments/zalo-chat/index.html`: giao diện độc lập, dữ liệu mẫu.
- `assets/zalo-chat/launcher.js`: nút mở/đóng giao diện, gắn sau `#ottChat` hoặc `#tgMemberInbox` hoặc `#tgForwardInbox`.
- `tests/zalo-chat/demo.test.cjs`: kiểm tra tách biệt, iframe sandbox, không kết nối mạng.

**Chưa nạp launcher vào `index.html`**. File `index.html` của dự án quá lớn đối với lần đọc qua connector hiện tại (trả nội dung rỗng); không được ghi đè file khi chưa có bản đầy đủ. Không tuyên bố nút đã xuất hiện trong CUNCUN.

## Tích hợp an toàn khi có mã đầy đủ
Ở nhánh thử nghiệm, thêm trước thẻ đóng `</body>` trong `index.html`:

```html
<script src="assets/zalo-chat/launcher.js" defer></script>
```

Sau đó xác minh launcher chỉ được tải một lần và các anchor Telegram tồn tại trên giao diện cần mở. Không chèn trực tiếp vào `main`. Nếu ứng dụng có CSP, kiểm tra chính sách cho script và iframe cùng origin; không nới CSP toàn cục chỉ để demo.

## Kiểm thử trước khi merge
1. Chạy `node --test tests/zalo-chat/demo.test.cjs`.
2. Mở trang trên iPhone; kiểm tra tab Cá nhân/Nhóm/Tất cả, tìm kiếm, mở hội thoại, quay lại, chọn, chọn tất cả, sao chép, xóa demo.
3. Kiểm tra `Gửi` vẫn disabled, không có request Zalo và không có truy cập Telegram endpoint.
4. Kiểm tra dữ liệu mẫu không tự động nhập vào phơi hoặc in; iframe sandbox không có `allow-same-origin` và không được truy cập DOM cha.
5. Kiểm tra mở/đóng demo không làm thay đổi chức năng Telegram, PIN, in ấn và đăng xuất.

## Bảo mật
Không dùng cookie đăng nhập Zalo, QR session không chính thức, hoặc khóa riêng trong trình duyệt. Không lấy quyền Zalo OA làm quyền đọc tài khoản cá nhân. Khi chưa có phương án kết nối được phép, UI luôn hiện `Chưa kết nối`.
