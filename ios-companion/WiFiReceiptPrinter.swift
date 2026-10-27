import Foundation
import Network

// Native iPhone TCP printing. This is not browser fetch() and not AirPrint.
// Printer must accept raw ESC/POS on LAN port 9100 (to be verified on XP-Q809K).
enum WiFiReceiptPrinter {
    enum Error: LocalizedError {
        case invalidAddress, invalidPort, unreachable
        var errorDescription: String? {
            switch self {
            case .invalidAddress: return "Nhập IP riêng của máy in, ví dụ 192.168.1.100"
            case .invalidPort: return "Cổng máy in không hợp lệ"
            case .unreachable: return "Không kết nối được máy in qua Wi-Fi/LAN"
            }
        }
    }

    static func privateIPv4(_ host: String) -> Bool {
        let fields = host.split(separator: ".", omittingEmptySubsequences: false)
        guard fields.count == 4 else { return false }
        let ints = fields.compactMap { UInt8(String($0)) }
        guard ints.count == 4 else { return false }
        return ints[0] == 10 || (ints[0] == 172 && (16...31).contains(ints[1])) ||
               (ints[0] == 192 && ints[1] == 168)
    }

    static func sendPNG(_ image: Data, to host: String, port: Int,
                        completion: @escaping (Result<Void, Swift.Error>) -> Void) {
        guard privateIPv4(host) else { completion(.failure(Error.invalidAddress)); return }
        guard (1...65535).contains(port), let endpointPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
            completion(.failure(Error.invalidPort)); return
        }
        let bytes: Data
        do { bytes = try BluetoothReceiptPrinter.escposRaster(image) }
        catch { completion(.failure(error)); return }
        let connection = NWConnection(host: NWEndpoint.Host(host), port: endpointPort, using: .tcp)
        let queue = DispatchQueue(label: "vn.cuncun.receipt.wifi")
        var finished = false
        func finish(_ result: Result<Void, Swift.Error>) {
            guard !finished else { return }
            finished = true
            connection.cancel()
            DispatchQueue.main.async { completion(result) }
        }
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                connection.send(content: bytes, completion: .contentProcessed { error in
                    if let error { finish(.failure(error)) }
                    else { finish(.success(())) }
                })
            case .failed(let error): finish(.failure(error))
            default: break
            }
        }
        queue.asyncAfter(deadline: .now() + .seconds(8)) {
            if !finished { finish(.failure(Error.unreachable)) }
        }
        connection.start(queue: queue)
    }
}
