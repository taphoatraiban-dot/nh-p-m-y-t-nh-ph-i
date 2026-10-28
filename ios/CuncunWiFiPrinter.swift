import Foundation
import UIKit
import Network

/// Direct LAN ESC/POS printing for an explicitly configured 80 mm printer.
/// Add this source to the iOS Xcode app target; it does not change the web print modes.
final class CuncunWiFiPrinter {
    enum PrintError: LocalizedError {
        case invalidImage, imageTooLarge, invalidEndpoint, disconnected
        var errorDescription: String? {
            switch self {
            case .invalidImage: return "Ảnh phiếu in không hợp lệ."
            case .imageTooLarge: return "Phiếu in quá lớn."
            case .invalidEndpoint: return "Địa chỉ hoặc cổng máy in không hợp lệ."
            case .disconnected: return "Máy in ngắt kết nối trước khi gửi xong."
            }
        }
    }

    private let queue = DispatchQueue(label: "icu.cuncun.wifi-printer")

    /// Completion means bytes were handed to the TCP stack, not that paper was printed.
    func printPNG(_ png: Data, host: String, port: UInt16 = 9100,
                  paperWidthDots: Int = 576, cut: Bool = true,
                  completion: @escaping (Result<Void, Error>) -> Void) {
        guard !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              port > 0 else { completion(.failure(PrintError.invalidEndpoint)); return }
        guard paperWidthDots == 576 || paperWidthDots == 512 || paperWidthDots == 384 else {
            completion(.failure(PrintError.invalidEndpoint)); return
        }
        guard png.count <= 12_000_000, let image = UIImage(data: png),
              let cg = image.cgImage else { completion(.failure(PrintError.invalidImage)); return }
        let payload: Data
        do { payload = try Self.escposRaster(cg, targetWidth: paperWidthDots, cut: cut) }
        catch { completion(.failure(error)); return }
        let connection = NWConnection(host: NWEndpoint.Host(host),
                                      port: NWEndpoint.Port(rawValue: port)!, using: .tcp)
        let lock = NSLock()
        var finished = false
        func finish(_ result: Result<Void, Error>) {
            lock.lock()
            let shouldFinish = !finished
            finished = true
            lock.unlock()
            guard shouldFinish else { return }
            connection.cancel()
            DispatchQueue.main.async { completion(result) }
        }
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                connection.send(content: payload, completion: .contentProcessed { error in
                    if let error = error { finish(.failure(error)) }
                    else { finish(.success(())) }
                })
            case .failed(let error): finish(.failure(error))
            case .cancelled: finish(.failure(PrintError.disconnected))
            default: break
            }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 20) {
            finish(.failure(NWError.posix(.ETIMEDOUT)))
        }
    }

    /// GS v 0 raster image, split into strips to avoid large printer buffers.
    private static func escposRaster(_ image: CGImage, targetWidth: Int, cut: Bool) throws -> Data {
        let targetHeight = Int((Double(image.height) * Double(targetWidth) / Double(image.width)).rounded())
        guard targetHeight > 0 && targetHeight <= 16000 else { throw PrintError.imageTooLarge }
        let bytesPerRow = targetWidth * 4
        var pixels = [UInt8](repeating: 255, count: bytesPerRow * targetHeight)
        let ok = pixels.withUnsafeMutableBytes { raw -> Bool in
            guard let base = raw.baseAddress,
                  let context = CGContext(data: base, width: targetWidth, height: targetHeight,
                    bitsPerComponent: 8, bytesPerRow: bytesPerRow,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.interpolationQuality = .high
            context.setFillColor(UIColor.white.cgColor)
            context.fill(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
            context.draw(image, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
            return true
        }
        guard ok else { throw PrintError.invalidImage }
        let widthBytes = (targetWidth + 7) / 8
        var out = Data([0x1B, 0x40, 0x1B, 0x33, 0x00]) // init, zero line spacing
        let stripHeight = 192
        for startY in stride(from: 0, to: targetHeight, by: stripHeight) {
            let rows = min(stripHeight, targetHeight - startY)
            out.append(contentsOf: [0x1D, 0x76, 0x30, 0x00,
                UInt8(widthBytes & 255), UInt8((widthBytes >> 8) & 255),
                UInt8(rows & 255), UInt8((rows >> 8) & 255)])
            for y in startY..<(startY + rows) {
                for xb in 0..<widthBytes {
                    var packed: UInt8 = 0
                    for bit in 0..<8 {
                        let x = xb * 8 + bit
                        if x >= targetWidth { continue }
                        let p = (y * targetWidth + x) * 4
                        let luminance = (Int(pixels[p]) * 299 + Int(pixels[p+1]) * 587 +
                                         Int(pixels[p+2]) * 114) / 1000
                        if luminance < 160 { packed |= (0x80 >> bit) }
                    }
                    out.append(packed)
                }
            }
        }
        out.append(contentsOf: [0x1B, 0x32, 0x0A, 0x0A, 0x0A])
        if cut { out.append(contentsOf: [0x1D, 0x56, 0x00]) }
        return out
    }
}
