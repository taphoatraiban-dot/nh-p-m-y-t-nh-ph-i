# QR trên phiếu 80 mm — tích hợp an toàn

Mã hiển thị QR nằm trong `src/ios-share-phoi.js`, chỉ áp dụng cho chế độ `[[TABLE80]]`.

## Dữ liệu đầu vào
```js
const receipt = {
  title: "PHIẾU MUA HÀNG",
  code: "CQ-123",
  items: [],
  total: "576k",
  // Ma trận QR chuẩn từ thư viện tạo QR đã kiểm thử, KHÔNG phải hình QR giả.
  qrMatrix: [[/* mỗi hàng có cùng chiều dài, mỗi phần tử 0/1 */]],
};
const canvas = TSHIOSSharePhoi.render("[[TABLE80]]" + JSON.stringify(receipt), document);
```

**Lưu ý:** QR chỉ hiện khi `qrMatrix` hợp lệ (ma trận vuông 21–177 module); không tự biến mã phiếu thành QR và không tự tạo mã xác thực. Dữ liệu QR phải mã hóa URL xác thực trỏ tới trang xác thực thực tế. Cần tích hợp thư viện tạo QR, gọi API phát hành sau khi đã lưu phiếu vào `print_queue`, rồi truyền ma trận vào bản in. Không phát hành QR khi phiếu chưa được lưu trên máy chủ.

## Điều kiện trước khi triển khai
1. Sao lưu Supabase và kiểm tra migration.
2. Kiểm thử `receipt-verify` với JWT thật; kiểm thử phát hành, xác thực, xác nhận một lần và quét đồng thời.
3. Giới hạn tần suất quét, bảo vệ endpoint kiểm tra, không lộ dữ liệu nhạy cảm.
4. Tích hợp tạo ma trận QR thật, thử quét từ bản in Xprinter 80 mm.
5. Kiểm tra phiếu dài, đường viền, cắt giấy, và các chế độ in khác.

Không merge lên main cho tới khi hoàn thành các bước này.
