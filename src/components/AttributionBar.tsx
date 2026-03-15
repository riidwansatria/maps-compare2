export function AttributionBar() {
  return (
    <div className="flex h-9 items-center justify-between border-b bg-background px-4">
      <a
        href="https://ridwansatria.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ridwansatria.com
      </a>
      <span className="text-xs text-muted-foreground">
        航空写真比較ツール
      </span>
    </div>
  )
}
