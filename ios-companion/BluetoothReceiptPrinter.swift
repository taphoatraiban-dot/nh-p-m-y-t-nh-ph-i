import Foundation
import CoreBluetooth
import UIKit
import CoreGraphics

struct DetectedPrinter: Identifiable {
    let id: UUID
    let name: String
}

// BLE prototype: the XP-Q809K variant must expose a writable GATT characteristic.
// Bluetooth Classic/SPP variants need the manufacturer's iOS SDK instead.
final class BluetoothReceiptPrinter: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    @Published private(set) var devices: [DetectedPrinter] = []
    @Published private(set) var status = "Đang khởi tạo Bluetooth"

    private var central: CBCentralManager!
    private var discovered: [UUID: CBPeripheral] = [:]
    private var selected: CBPeripheral?
    private var writer: CBCharacteristic?
    private var queue = Data()
    private var offset = 0
    private var finish: ((Result<Void, Error>) -> Void)?

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        status = central.state == .poweredOn ? "Bluetooth đã bật — chọn Tìm máy" : "Hãy bật Bluetooth"
    }

    func scan() {
        guard central.state == .poweredOn else { status = "Bluetooth chưa sẵn sàng"; return }
        devices = []
        discovered = [:]
        status = "Đang tìm máy in BLE…"
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? ""
        guard !name.isEmpty, discovered[peripheral.identifier] == nil else { return }
        discovered[peripheral.identifier] = peripheral
        devices.append(DetectedPrinter(id: peripheral.identifier, name: name))
    }

    func connect(to id: UUID) {
        guard let device = discovered[id] else { return }
        central.stopScan()
        selected = device
        writer = nil
        device.delegate = self
        status = "Đang kết nối \(device.name ?? "máy in")…"
        central.connect(device, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        status = "Đang tìm cổng nhận lệnh in…"
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        status = "Không kết nối được: \(error?.localizedDescription ?? "không rõ lỗi")"
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        writer = nil
        status = "Máy in đã ngắt kết nối"
        if finish != nil { complete(.failure(PrintError.disconnected)) }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil else { status = "Không đọc được dịch vụ BLE"; return }
        peripheral.services?.forEach { peripheral.discoverCharacteristics(nil, for: $0) }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil else { return }
        // Deliberately never guesses proprietary command formats.
        let candidates = service.characteristics?.filter {
            $0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse)
        } ?? []
        // Common ESC/POS BLE UART services. Other printers need vendor SDK/UUID confirmation.
        let knownServices = ["FFE0", "FF00", "18F0"]
        guard knownServices.contains(service.uuid.uuidString.uppercased()),
              let characteristic = candidates.first else { return }
        writer = characteristic
        status = "Đã nối BLE: \(peripheral.name ?? "máy in")"
    }

    func sendPNG(_ data: Data, completion: @escaping (Result<Void, Error>) -> Void) {
        guard finish == nil else { completion(.failure(PrintError.busy)); return }
        guard let peripheral = selected, peripheral.state == .connected, let characteristic = writer else {
            completion(.failure(PrintError.unsupported)); return
        }
        do { queue = try Self.escposRaster(data); offset = 0; finish = completion; pump(peripheral, characteristic) }
        catch { completion(.failure(error)) }
    }

    private func pump(_ peripheral: CBPeripheral, _ characteristic: CBCharacteristic) {
        let useResponse = characteristic.properties.contains(.write)
        let type: CBCharacteristicWriteType = useResponse ? .withResponse : .withoutResponse
        let chunkSize = min(180, peripheral.maximumWriteValueLength(for: type))
        guard chunkSize > 0 else { complete(.failure(PrintError.unsupported)); return }
        if offset >= queue.count { complete(.success(())); return }
        if !useResponse && !peripheral.canSendWriteWithoutResponse { return }
        let end = min(offset + chunkSize, queue.count)
        peripheral.writeValue(queue.subdata(in: offset..<end), for: characteristic, type: type)
        offset = end
        if !useResponse {
            // Pace BLE UART printers. A successful write is NOT a paper-output acknowledgement.
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(20)) { [weak self] in
                self?.pump(peripheral, characteristic)
            }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error { complete(.failure(error)) }
        else { pump(peripheral, characteristic) }
    }

    func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        if let writer, finish != nil { pump(peripheral, writer) }
    }

    private func complete(_ result: Result<Void, Error>) {
        let callback = finish
        finish = nil
        queue = Data()
        offset = 0
        callback?(result)
    }

    static func escposRaster(_ png: Data) throws -> Data {
        guard let source = UIImage(data: png)?.cgImage else { throw PrintError.invalidImage }
        let width = 576
        let height = Int((Double(source.height) * Double(width) / Double(source.width)).rounded())
        guard height > 0, height <= 3000 else { throw PrintError.invalidImage }
        var pixels = [UInt8](repeating: 255, count: width * height)
        let gray = CGColorSpaceCreateDeviceGray()
        let rendered = pixels.withUnsafeMutableBytes { bytes -> Bool in
            guard let ctx = CGContext(data: bytes.baseAddress, width: width, height: height,
                                      bitsPerComponent: 8, bytesPerRow: width,
                                      space: gray, bitmapInfo: CGImageAlphaInfo.none.rawValue) else {
                return false
            }
            ctx.setFillColor(gray: 1, alpha: 1)
            ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard rendered else { throw PrintError.invalidImage }
        var data = Data([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00,
                         UInt8((width / 8) & 0xff), UInt8(((width / 8) >> 8) & 0xff),
                         UInt8(height & 0xff), UInt8((height >> 8) & 0xff)])
        for y in 0..<height {
            for bx in 0..<(width / 8) {
                var value: UInt8 = 0
                for bit in 0..<8 where pixels[y * width + bx * 8 + bit] < 150 {
                    value |= 0x80 >> bit
                }
                data.append(value)
            }
        }
        data.append(contentsOf: [0x0a, 0x0a, 0x0a])
        return data
    }
}

enum PrintError: LocalizedError {
    case invalidImage, unsupported, disconnected, busy
    var errorDescription: String? {
        switch self {
        case .invalidImage: return "Ảnh phiếu không hợp lệ hoặc quá dài"
        case .unsupported: return "Máy chưa mở cổng BLE ESC/POS tương thích; cần SDK của Xprinter"
        case .disconnected: return "Mất kết nối máy in"
        case .busy: return "Đang gửi một phiếu khác"
        }
    }
}
