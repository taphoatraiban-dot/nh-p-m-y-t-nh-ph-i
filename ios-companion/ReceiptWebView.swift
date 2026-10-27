import SwiftUI
import WebKit

struct ReceiptWebView: UIViewRepresentable {
    let printer: BluetoothReceiptPrinter

    func makeCoordinator() -> Coordinator { Coordinator(printer: printer) }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "tshPrinter")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        let web = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.web = web
        web.navigationDelegate = context.coordinator
        web.load(URLRequest(url: URL(string: "https://cuncun.icu/")!))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let printer: BluetoothReceiptPrinter
        weak var web: WKWebView?

        init(printer: BluetoothReceiptPrinter) { self.printer = printer }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let url = action.request.url
            let allowed = url?.scheme == "https" && url?.host == "cuncun.icu"
            decisionHandler(allowed ? .allow : .cancel)
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            // Accept commands only from the primary, first-party HTTPS page.
            guard message.name == "tshPrinter", message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == "cuncun.icu",
                  let body = message.body as? [String: Any],
                  let id = body["id"] as? Int, id > 0,
                  let raw = body["png"] as? String,
                  raw.hasPrefix("data:image/png;base64,"), raw.count <= 2_000_000,
                  let png = Data(base64Encoded: String(raw.dropFirst("data:image/png;base64,".count)))
            else { return }
            printer.sendPNG(png) { [weak self] result in
                switch result {
                case .success: self?.reply(id: id, ok: true, error: "")
                case .failure(let error): self?.reply(id: id, ok: false, error: error.localizedDescription)
                }
            }
        }

        private func reply(id: Int, ok: Bool, error: String) {
            let safeError = (try? JSONSerialization.data(withJSONObject: ["error": error]))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
            let script = "window.TSHNativePrintBridge?.resolve(\(id), {ok:\(ok ? "true" : "false"), error:(\(safeError)).error});"
            DispatchQueue.main.async { [weak self] in self?.web?.evaluateJavaScript(script, completionHandler: nil) }
        }
    }
}
