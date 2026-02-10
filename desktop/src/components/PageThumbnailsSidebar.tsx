interface PageThumbnailsSidebarProps {
  projectId: string
  pageCount: number
  selectedPage: number
  onPageSelect: (page: number) => void
}

export function PageThumbnailsSidebar({
  projectId,
  pageCount,
  selectedPage,
  onPageSelect,
}: PageThumbnailsSidebarProps) {
  return (
    <aside className="w-32 border-r bg-gray-50 overflow-y-auto p-2">
      {Array.from({ length: pageCount }).map((_, i) => (
        <button
          key={i}
          onClick={() => onPageSelect(i)}
          className={`w-full mb-2 p-1 rounded border-2 transition-colors ${
            selectedPage === i ? 'border-primary-500' : 'border-transparent hover:border-gray-300'
          }`}
        >
          <img
            src={`/projects/${projectId}/pages/${i}/thumbnail?kind=original`}
            alt={`Página ${i + 1}`}
            className="w-full aspect-[3/4] object-cover rounded bg-gray-200"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              ;(e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="aspect-[3/4] bg-gray-200 rounded flex items-center justify-center text-sm text-gray-500">${i + 1}</div>`
            }}
          />
        </button>
      ))}
    </aside>
  )
}
