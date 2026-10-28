# Cuncun native iPhone printing prototype

This is an **unshipped, incomplete prototype**, isolated from production. It is NOT yet a working Vietnamese receipt printer.

## Status and safety
- Opens https://cuncun.icu in a native WKWebView.
- Receives a receipt only when the website explicitly calls `window.webkit.messageHandlers.cuncunPrint.postMessage(receiptText)`. **The existing IN NGAY button is not wired yet.**
- Asks for confirmation before sending one job to 192.168.1.159:9100.
- ESC/POS cut command is sent at the end. Printer may require a different cut command.
- ASCII-only for now: rejects Vietnamese and other non-ASCII text rather than producing unreadable garbage.
- No background worker, Supabase queue or Mac needed during printing.
- Sending bytes successfully is not proof that paper was printed or cut.

## To run
1. On Mac, open Xcode and create a new iOS App project (SwiftUI, Swift).
2. Replace the generated App source with `CuncunDirectPrintApp.swift`; add `ESCPosPrinter.swift`.
3. Add `NSLocalNetworkUsageDescription` to Info.plist: `Cuncun kết nối máy in Xprinter trong mạng Wi-Fi nội bộ.`
4. Set signing to your Apple team; install on a connected iPhone.
5. Connect iPhone to the same Wi-Fi as the printer; confirm printer IP.
6. Test ASCII receipt with a temporary test action before integrating production.
7. Implement a Vietnamese-to-raster ESC/POS renderer and bridge the existing website print action on a separate test branch, then test cutting and long receipts.

No changes to production website or database are included.
