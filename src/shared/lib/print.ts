/**
 * PDF ni chop etish: yashirin iframe ga blob URL yuklanadi va brauzer chop etish oynasi ochiladi.
 * Token URL ga yozilmaydi (fayl avval Authorization bilan olinadi). Iframe chop etolmasa
 * (masalan Safari) — yangi oynada ochiladi.
 */
type OpenHandler = (blob: Blob, filename: string) => Promise<void>

// Desktop (Tauri): webview PDF ni ichida ko'rsata olmaydi (WebKitGTK) — tizim dasturida ochiladi
let openHandler: OpenHandler | null = null

export function setOpenHandler(handler: OpenHandler) {
  openHandler = handler
}

export function printPdf(blob: Blob, filename = 'chek.pdf'): void {
  if (openHandler) {
    void openHandler(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.setAttribute('aria-hidden', 'true')
  frame.dataset.testid = 'print-frame'
  frame.src = url
  const cleanup = () => {
    frame.remove()
    URL.revokeObjectURL(url)
  }
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, '_blank', 'noopener')
    }
    // chop etish oynasi yopilgach ham PDF kerak bo'lishi mumkin — keyinroq tozalanadi
    setTimeout(cleanup, 60_000)
  }
  document.body.appendChild(frame)
}

export function openPdf(blob: Blob, filename = 'hujjat.pdf'): void {
  if (openHandler) {
    void openHandler(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
