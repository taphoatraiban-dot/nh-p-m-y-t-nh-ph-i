# CUNCUN iPhone – LAN direct print (prototype)

Native SwiftUI WKWebView app for iPhone. Loads https://cuncun.icu and exposes the existing `TSHNativePrintBridge` interface. The website's **native** printer mode sends the calculated receipt to Xprinter over local Wi-Fi using TCP 9100, without AirPrint, Mac Mini or the iOS Share Sheet.

## Build
1. On a Mac with Xcode, create an iOS App (SwiftUI) named CuncunPrinter.
2. Replace the generated app source with `CuncunPrinterApp.swift`.
3. In the app target Info settings, add `NSLocalNetworkUsageDescription`: `CUNCUN cần kết nối máy in nhiệt trong mạng Wi-Fi nội bộ.`
4. Sign with your Apple development team and run on an iPhone on the same LAN as the printer.
5. In CUNCUN printer settings select the **native app / Wi-Fi IP** mode, IP `192.168.1.159`, port `9100`. Calculate with OK before printing.

## Limits / validation before production
- This is a source prototype, not a compiled or installed iPhone app.
- Current ESC/POS renderer uses text transliteration; accented Vietnamese may not print faithfully. Implement printer-compatible bitmap text rendering for production.
- TCP completion means bytes were sent, **not** that paper was printed; the app must not claim confirmed print.
- Verify cut commands and 80mm width on the actual printer.
- Add idempotency/reprint controls and app lifecycle handling before enabling auto-print on OK.
- Requires iOS local-network permission. Safari alone cannot open raw TCP sockets.
- Existing CUNCUN website, Telegram, Supabase and Mac queue are unchanged.
