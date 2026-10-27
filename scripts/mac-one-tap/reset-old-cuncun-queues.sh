#!/bin/sh
# Run on the customer's Mac Mini, not on the website/server.
# Only known old Cuncun queues are candidates; other printers are untouched.
set -eu

echo 'Các hàng đợi máy in hiện có:'
lpstat -p || true
echo
echo 'Chỉ các tên sau có thể được gỡ:'
echo '  _192_168_1_159'
echo '  CUNCUN_ESCPOS_AIRPRINT'
echo '  Printer_POS_80_4'
echo
echo 'Chưa gỡ gì. Muốn tiếp tục, nhập đúng: XOA-CUNCUN'
read -r answer
[ "$answer" = 'XOA-CUNCUN' ] || { echo 'Đã hủy; không thay đổi gì.'; exit 0; }

backup_dir=$(mktemp -d "${TMPDIR:-/tmp}/cuncun-printers.XXXXXX")
lpstat -p > "$backup_dir/printers.txt" 2>&1 || true
lpstat -v > "$backup_dir/devices.txt" 2>&1 || true
echo "Đã lưu danh sách máy in trước khi gỡ: $backup_dir"

for printer in _192_168_1_159 CUNCUN_ESCPOS_AIRPRINT Printer_POS_80_4; do
  if lpstat -p "$printer" >/dev/null 2>&1; then
    echo "Đang gỡ hàng đợi Cuncun cũ: $printer"
    sudo lpadmin -x "$printer"
  else
    echo "Không tồn tại: $printer — bỏ qua."
  fi
done

echo 'Đã xử lý xong hàng đợi Cuncun cũ. Các hàng đợi khác được giữ nguyên.'
echo 'Máy in vật lý Xprinter không bị xóa/cài lại firmware.'
