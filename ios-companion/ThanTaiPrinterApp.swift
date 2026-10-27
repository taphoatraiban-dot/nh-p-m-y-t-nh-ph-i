import SwiftUI

@main
struct ThanTaiPrinterApp: App {
    @StateObject private var printer = BluetoothReceiptPrinter()
    @AppStorage("tsh.print.mode") private var printMode = "bluetooth"
    @AppStorage("tsh.print.ip") private var printerIP = ""
    @AppStorage("tsh.print.port") private var printerPort = 9100

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
                    }
                    ReceiptWebView(printer: printer, route: printMode, host: printerIP, port: printerPort)
                }
                .navigationTitle("Thần Tài · In 80mm")
            }
        }
    }
}
