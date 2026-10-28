import Foundation
import Network

enum PrintError: LocalizedError {
    case connection, timeout, encoding
    var errorDescription: String? {
        switch self {
        case .connection: return "Không kết nối được Xprinter"
        case .timeout: return "Hết thời gian chờ máy in"
        case .encoding: return "Nội dung chưa thể chuyển sang mã in"
        }
    }
}

enum ESCPosPrinter {
    static func printReceipt(_ text: String, host: String = "192.168.1.159", port: UInt16 = 9100) async throws {
        // ESC/POS text mode is deliberately limited to ASCII until a
        // verified Vietnamese raster renderer is implemented.
        // Reject rather than silently print garbled Vietnamese text.
        guard let data = text.data(using: .ascii), !text.isEmpty else {
            throw PrintError.encoding
        }
        var bytes = Data([0x1B, 0x40, 0x1B, 0x61, 0x00])
        bytes.append(data)
        bytes.append(contentsOf: [0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00])
        let connection = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!, using: .tcp)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let queue = DispatchQueue(label: "cuncun.directprint")
            var completed = false
            func finish(_ result: Result<Void, Error>) {
                guard !completed else { return }
                completed = true
                connection.stateUpdateHandler = nil
                connection.cancel()
                continuation.resume(with: result)
            }
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    connection.send(content: bytes, completion: .contentProcessed { error in
                        if let error { finish(.failure(error)) }
                        else { finish(.success(())) }
                    })
                case .failed(let error): finish(.failure(error))
                case .cancelled: finish(.failure(PrintError.connection))
                default: break
                }
            }
            connection.start(queue: queue)
            queue.asyncAfter(deadline: .now() + 8) {
                finish(.failure(PrintError.timeout))
            }
        }
    }
}
