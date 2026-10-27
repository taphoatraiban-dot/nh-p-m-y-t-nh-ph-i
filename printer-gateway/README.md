# Bộ chuyển tiếp in Wi-Fi/LAN — bản thử nghiệm

Chạy trên một thiết bị điều khiển riêng (ví dụ Raspberry Pi) cùng mạng với máy
in XP-Q809K, **không cần Mac Mini**. Máy in phải nối tới mạng LAN và chấp nhận
lệnh ESC/POS TCP ở cổng 9100. Chưa kiểm chứng trên phần cứng thực tế.

`gateway.cjs` chỉ phục vụ thử gửi văn bản ESC/POS qua mạng; **chưa in ảnh/QR**,
chưa phải driver AirPrint và chưa nối website sản xuất.

Yêu cầu Node.js 20+; không cài thêm package. Cấu hình tối thiểu:

- `TSH_PRINTER_IP`: IP nội bộ cố định của máy XP-Q809K.
- `TSH_GATEWAY_TOKEN`: chuỗi bí mật ngẫu nhiên ít nhất 32 ký tự.
- `TSH_GATEWAY_BIND`: mặc định `127.0.0.1`, không mở công khai.
- `TSH_GATEWAY_PORT`: mặc định `8788`.

**Bảo mật:** Không đưa token vào `index.html` hoặc GitHub; không mở cổng 8788
ra Internet. Khi iPhone dùng 5G, phải có HTTPS relay/VPN được kiểm soát truy cập.
Không gọi HTTP nội bộ trực tiếp từ trang HTTPS vì trình duyệt có thể chặn mixed
content và thiết bị ở 5G không nằm trong mạng LAN. Không lưu lịch sử phiếu lên
bộ chuyển tiếp nếu không có lý do vận hành.

Nhãn trả về `queued:true, printed:false` chỉ xác nhận đã gửi dữ liệu qua TCP,
**không có nghĩa giấy đã ra**. Chưa dùng cho phiếu thật trước kiểm thử.
