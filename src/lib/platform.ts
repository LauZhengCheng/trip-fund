export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}
