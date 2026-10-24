type SaveHandler = (blob: Blob, filename: string) => Promise<boolean>

// Desktop (Tauri) da tizimning saqlash oynasi — shared/platform/desktop.ts o'rnatadi
let saveHandler: SaveHandler | null = null

export function setSaveHandler(handler: SaveHandler) {
  saveHandler = handler
}

/**
 * Blob ni fayl sifatida saqlash (brauzer "yuklab olish"). Token URL ga yozilmaydi.
 * false — foydalanuvchi saqlash oynasini yopdi (desktop) yoki xato.
 */
export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
  if (saveHandler) return saveHandler(blob, filename)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}
