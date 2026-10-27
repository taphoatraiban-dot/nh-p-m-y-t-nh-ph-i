import SwiftUI

@main
struct ThanTaiPrinterApp: App {
    @StateObject private var printer = BluetoothReceiptPrinter()
    @AppStorage("tsh.print.mode") private var printMode = "wifi"
    @AppStorage("tsh.print.ip") private var printerIP = "192.168.1.159"
    @AppStorage("tsh.print.port") private var printerPort = 9100
    @State private var lanTestStatus = ""

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                VStack(spacing: 12) {
                    Picker("Đường truyền", selection: $printMode) {
                        Text("Bluetooth").tag("bluetooth")
                        Text("Wi-Fi / IP").tag("wifi")
                    }.pickerStyle(.segmented).padding(.horizontal)
                    if printMode == "bluetooth" {
                        HStack {
                            Text(printer.status).font(.footnote)
                            Spacer()
                            Button("Tìm máy") { printer.scan() }
                        }.padding(.horizontal)
                        if !printer.devices.isEmpty {
                            ScrollView(.horizontal) {
                                HStack {
                                    ForEach(printer.devices) { device in
                                        Button(device.name) { printer.connect(to: device.id) }
                                            .buttonStyle(.bordered)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    } else {
                        HStack {
                            TextField("IP máy in: 192.168.1.100", text: $printerIP)
                                .keyboardType(.numbersAndPunctuation)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                            TextField("Cổng", value: $printerPort, format: .number)
                                .keyboardType(.numberPad)
                                .frame(width: 75)
                        }.textFieldStyle(.roundedBorder).padding(.horizontal)
                        Text("XP-Q809K phải nối LAN vào bộ phát Wi-Fi. iPhone cần ở cùng mạng nội bộ; 5G ở xa không kết nối trực tiếp bằng IP riêng.")
                            .font(.caption).foregroundStyle(.secondary).padding(.horizontal)
                        Button("🧾 IN THỬ QUA IP") {
                            lanTestStatus = "Đang gửi lệnh thử..."
                            WiFiReceiptPrinter.sendTest(to: printerIP, port: printerPort) { result in
                                switch result {
                                case .success: lanTestStatus = "Đã gửi lệnh. Hãy kiểm tra giấy đã ra chưa."
                                case .failure(let error): lanTestStatus = "Không gửi được: \(error.localizedDescription)"
                                }
                            }
                        }.buttonStyle(.borderedProminent)
                        if !lanTestStatus.isEmpty {
                            Text(lanTestStatus).font(.footnote).padding(.horizontal)
                        }
                    }
                    ReceiptWebView(printer: printer, route: printMode, host: printerIP, port: printerPort)
                }
                .navigationTitle("Thần Tài · In 80mm")
            }
        }
    }
}
