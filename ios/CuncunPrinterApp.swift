import SwiftUI
import WebKit
import Network

@main struct CuncunPrinterApp: App {
    var body: some Scene { WindowGroup { CuncunWebView() } }
}
struct CuncunWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "cuncunPrint")
        controller.addUserScript(WKUserScript(source: Self.bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        let web = WKWebView(frame: .zero, configuration: config)
        context.coordinator.web = web
        web.load(URLRequest(url: URL(string: "https://cuncun.icu")!))
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static let bridge = """
    (function(){
      const pending=new Map();
      window.TSHNativePrintBridge={
        available:()=>!!window.webkit?.messageHandlers?.cuncunPrint,
        send:function(text){
          if(typeof text!=='string'||!text.trim())return Promise.reject(Error('Phiếu trống'));
          const cfg=JSON.parse(localStorage.getItem('TSH_PRINTER_LAN_V1')||'{}');
          const id=String(Date.now())+'-'+Math.random().toString(36).slice(2);
          return new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Hết thời gian kết nối máy in'));},20000);
            pending.set(id,{resolve,reject,timeout});
            window.webkit.messageHandlers.cuncunPrint.postMessage({id,text,ip:cfg.ip||'192.168.1.159',port:cfg.port||9100});
          });
        }
      };
      window.__cuncunPrintResult=function(id,ok,message){
        const job=pending.get(id);if(!job)return;
        clearTimeout(job.timeout);pending.delete(id);
        if(ok)job.resolve({sent:true});else job.reject(Error(message||'In thất bại'));
      };
    })();
    """
    final class Coordinator: NSObject, WKScriptMessageHandler {
        weak var web: WKWebView?
        private var inFlight = Set<String>()
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let web, web.url?.host == "cuncun.icu",
                  let body=message.body as? [String:Any],
                  let id=body["id"] as? String, id.count < 100,
                  let text=body["text"] as? String, !text.isEmpty, text.utf8.count < 16000,
                  let ip=body["ip"] as? String,
                  let port=body["port"] as? Int, (1...65535).contains(port),
                  Self.validPrivateIPv4(ip), !inFlight.contains(id) else { return }
            inFlight.insert(id)
            let data=Self.receipt(text)
            let connection=NWConnection(host:NWEndpoint.Host(ip),port:NWEndpoint.Port(integerLiteral:UInt16(port)),using:.tcp)
            let lock=NSLock()
            var completed=false
            let finish: (Bool,String)->Void = { [weak self,weak web] ok,error in
                lock.lock();defer{lock.unlock()}
                guard !completed else{return};completed=true
                connection.cancel()
                DispatchQueue.main.async {
                    self?.inFlight.remove(id)
                    guard let web else{return}
                    let quotedID=Self.jsonString(id),quotedError=Self.jsonString(error)
                    web.evaluateJavaScript("window.__cuncunPrintResult(\(quotedID),\(ok ? "true":"false"),\(quotedError))",completionHandler:nil)
                }
            }
            connection.stateUpdateHandler={ state in
                switch state {
                case .ready:
                    connection.send(content:data,completion:.contentProcessed { error in
                        if let error {finish(false,error.localizedDescription)}
                        else {finish(true,"Đã gửi dữ liệu đến máy in; cần kiểm tra giấy thực tế")}
                    })
                case .failed(let error):finish(false,error.localizedDescription)
                default:break
                }
            }
            connection.start(queue:DispatchQueue(label:"cuncun.lan.print"))
            DispatchQueue.global().asyncAfter(deadline:.now()+12){finish(false,"Kết nối máy in quá thời gian")}
        }
        static func validPrivateIPv4(_ ip:String)->Bool {
            let parts=ip.split(separator:".")
            guard parts.count==4 else{return false}
            let nums=parts.compactMap{UInt8($0)}
            guard nums.count==4 else{return false}
            return nums[0]==10 || (nums[0]==192 && nums[1]==168) ||
                (nums[0]==172 && (16...31).contains(Int(nums[1])))
        }
        static func jsonString(_ value:String)->String {
            let data=try! JSONSerialization.data(withJSONObject:[value],options:[])
            let arr=String(data:data,encoding:.utf8)!
            return String(arr.dropFirst().dropLast())
        }
        static func receipt(_ text:String)->Data {
            var bytes=Data([0x1b,0x40,0x1b,0x61,0x00])
            for line in text.components(separatedBy:.newlines) {
                // ESC/POS plain text mode: Vietnamese diacritics require a printer-specific code page.
                let plain=line.folding(options:[.diacriticInsensitive,.widthInsensitive],locale:Locale(identifier:"vi_VN"))
                bytes.append(contentsOf:plain.utf8)
                bytes.append(0x0a)
            }
            bytes.append(contentsOf:[0x0a,0x0a,0x0a,0x1d,0x56,0x00])
            return bytes
        }
    }
}
