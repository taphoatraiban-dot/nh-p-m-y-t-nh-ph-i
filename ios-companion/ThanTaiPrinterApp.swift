import SwiftUI

@main
struct ThanTaiPrinterApp: App {
    @StateObject private var printer = BluetoothReceiptPrinter()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                VStack(spacing: 12) {
                    HStack {
                        Text(printer.status).font(.footnote)
                        Spacer()
                        Button("Tìm máy") { printer.scan() }
                    }
                    .padding(.horizontal)
                    if !printer.devices.isEmpty {
                        ScrollView(.horizontal) {
                            HStack {
                                ForEach(printer.devices) { device in
                                    Button(device.name) { printer.connect(to: device.id) }
                                        .buttonStyle(.bordered)
                                }
                            }.padding(.horizontal)
                        }
                    }
                    ReceiptWebView(printer: printer)
                }
                .navigationTitle("Thần Tài · In 80mm")
            }
        }
    }
}
