import SwiftUI
import WebKit
import Network

@main
struct CuncunDirectPrintApp: App {
    var body: some Scene {
        WindowGroup { CuncunScreen() }
    }
}

struct CuncunScreen: View {
    @State private var status = "Sẵn sàng"
    @State private var showingPrint = false
    @State private var pendingText = ""
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Cuncun").bold()
                Spacer()
                Text(status).font(.caption).lineLimit(1)
            }.padding(10)
            CuncunWebView { text in
                pendingText = text
                showingPrint = true
            }
        }
        .confirmationDialog("In phiếu 80mm?", isPresented: $showingPrint) {
            Button("IN NGAY") {
                let text = pendingText
                status = "Đang kết nối máy in..."
                Task {
                    do {
                        try await ESCPosPrinter.printReceipt(text)
                        status = "Đã gửi dữ liệu in"
                    } catch {
                        status = "Lỗi in: \(error.localizedDescription)"
                    }
                }
            }
            Button("Hủy", role: .cancel) {}
        } message: {
            Text("Xprinter 192.168.1.159:9100 — chỉ in một lần khi xác nhận.")
        }
    }
}

struct CuncunWebView: UIViewRepresentable {
    let onPrint: (String) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(onPrint: onPrint) }
    func makeUIView(context: Context) -> WKWebView {
        let content = WKUserContentController()
        content.add(context.coordinator, name: "cuncunPrint")
        let web = WKWebView(frame: .zero, configuration: {
            let config = WKWebViewConfiguration()
            config.userContentController = content
            return config
        }())
        web.load(URLRequest(url: URL(string: "https://cuncun.icu")!))
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onPrint: (String) -> Void
        init(onPrint: @escaping (String) -> Void) { self.onPrint = onPrint }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "cuncunPrint", let text = message.body as? String else { return }
            DispatchQueue.main.async { self.onPrint(text) }
        }
    }
}
