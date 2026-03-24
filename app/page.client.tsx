export default function mount() {
  const copyBtn = document.getElementById('copy-install-btn') as HTMLButtonElement | null
  if (!copyBtn) return

  let resetTimer: ReturnType<typeof setTimeout> | null = null
  const original = copyBtn.textContent || '📋'

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText('npx geeksy')
      copyBtn.textContent = '✓ Copied'
      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => {
        copyBtn.textContent = original
      }, 1500)
    } catch {
      copyBtn.textContent = 'Copy failed'
      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => {
        copyBtn.textContent = original
      }, 1500)
    }
  }

  copyBtn.addEventListener('click', onClick)

  return () => {
    if (resetTimer) clearTimeout(resetTimer)
    copyBtn.removeEventListener('click', onClick)
  }
}
