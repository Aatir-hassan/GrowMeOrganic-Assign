import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataTable } from 'primereact/datatable'
import type { DataTablePageEvent } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { fetchArtworks } from './api'
import type { Artwork } from './api'
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './App.css'

type SelectionState = {
  selectedIds: Set<number>
  deselectedIds: Set<number>
}

function App() {
  const [rows, setRows] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectorValue, setSelectorValue] = useState('')

  // Persisted selection across pages by ID only
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedIds: new Set<number>(),
    deselectedIds: new Set<number>()
  })

  const loadPage = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetchArtworks(p)
      setRows(res.data)
      setTotalRecords(res.pagination?.total ?? res.data.length)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPage(1)
  }, [loadPage])

  const onPage = async (e: DataTablePageEvent) => {
    const newPage = Math.floor((e.first ?? 0) / (e.rows ?? 12)) + 1
    setPage(newPage)
    await loadPage(newPage)
  }

  // Table selection: controlled via a Set of IDs (no caching of rows)
  const selectedIds = selectionState.selectedIds
  const pageAllIds = useMemo(() => rows.map((r) => r.id), [rows])

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null)
  const pageSelectedCount = useMemo(() => pageAllIds.filter((id) => selectedIds.has(id)).length, [pageAllIds, selectedIds])
  const allOnPageSelected = pageAllIds.length > 0 && pageSelectedCount === pageAllIds.length
  const someOnPageSelected = pageSelectedCount > 0 && !allOnPageSelected

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someOnPageSelected
    }
  }, [someOnPageSelected, selectionVersion, pageAllIds])
  // removed unused onSelectionChange

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectionState((prev) => {
      const nextSelected = new Set(prev.selectedIds)
      const nextDeselected = new Set(prev.deselectedIds)

      if (checked) {
        pageAllIds.forEach((id) => {
          nextSelected.add(id)
          nextDeselected.delete(id)
        })
      } else {
        pageAllIds.forEach((id) => {
          nextSelected.delete(id)
          nextDeselected.add(id)
        })
      }
      return { selectedIds: nextSelected, deselectedIds: nextDeselected }
    })
    setSelectionVersion((v) => v + 1)
  }

  const isRowSelected = (id: number) => selectedIds.has(id)

  const onRowToggle = (id: number, checked: boolean) => {
    setSelectionState((prev) => {
      const nextSelected = new Set(prev.selectedIds)
      const nextDeselected = new Set(prev.deselectedIds)
      if (checked) {
        nextSelected.add(id)
        nextDeselected.delete(id)
      } else {
        nextSelected.delete(id)
        nextDeselected.add(id)
      }
      return { selectedIds: nextSelected, deselectedIds: nextDeselected }
    })
    setSelectionVersion((v) => v + 1)
  }

  return (
    <div className="p-4">
      <h2 className="mb-3">Art Institute of Chicago - Artworks</h2>

      <DataTable key={selectionVersion} value={rows}
        dataKey="id"
        loading={loading}
        paginator
        lazy
        rows={12}
        totalRecords={totalRecords}
        first={(page - 1) * 12}
        onPage={onPage}
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
      >
        <Column
          header={(
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(e) => toggleSelectAllOnPage(e.currentTarget.checked)}
                style={{ width: '20px', height: '20px', transform: 'translateY(1px)' }}
              />
              <i
                className="pi pi-list-check"
                style={{ fontSize: '18px', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectorOpen((o) => !o)
                }}
                title="Select rows..."
              />
              {selectorOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '26px',
                    left: 0,
                    background: 'var(--surface-0, #ffffff)',
                    border: '1px solid var(--surface-300, #d1d5db)',
                    borderRadius: '6px',
                    padding: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    zIndex: 10,
                    width: '260px'
                  }}
                >
                  <input
                    type="text"
                    placeholder="Select rows... e.g. 1,3,5"
                    value={selectorValue}
                    onChange={(e) => setSelectorValue(e.currentTarget.value)}
                    style={{ width: '100%', height: '36px', padding: '6px 8px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      className="p-button p-button-sm"
                      onClick={(e) => {
                        e.preventDefault()
                        const raw = selectorValue.trim()
                        let idsToSelect: number[] = []
                        // If a single number is provided, treat as "select first N rows on this page"
                        const singleNumber = raw.match(/^\d+$/)
                        if (singleNumber) {
                          const count = Math.min(parseInt(raw, 10), pageAllIds.length)
                          idsToSelect = pageAllIds.slice(0, Math.max(0, count))
                        } else {
                          // Otherwise support comma-separated indices and ranges (e.g., 1,3,5 or 2-6)
                          const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean)
                          const indices = new Set<number>()
                          for (const t of tokens) {
                            const range = t.match(/^([0-9]+)\s*-\s*([0-9]+)$/)
                            if (range) {
                              const start = Math.max(1, parseInt(range[1], 10))
                              const end = Math.min(pageAllIds.length, parseInt(range[2], 10))
                              if (!isNaN(start) && !isNaN(end) && start <= end) {
                                for (let i = start; i <= end; i++) indices.add(i)
                              }
                              continue
                            }
                            const n = parseInt(t, 10)
                            if (!isNaN(n) && n >= 1 && n <= pageAllIds.length) {
                              indices.add(n)
                            }
                          }
                          idsToSelect = Array.from(indices).map((n) => pageAllIds[n - 1])
                        }
                        setSelectionState((prev) => {
                          const nextSelected = new Set(prev.selectedIds)
                          const nextDeselected = new Set(prev.deselectedIds)
                          // first clear current page selections then apply chosen ones
                          pageAllIds.forEach((id) => {
                            nextSelected.delete(id)
                            nextDeselected.add(id)
                          })
                          idsToSelect.forEach((id) => {
                            nextSelected.add(id)
                            nextDeselected.delete(id)
                          })
                          return { selectedIds: nextSelected, deselectedIds: nextDeselected }
                        })
                        setSelectionVersion((v) => v + 1)
                        setSelectorOpen(false)
                      }}
                    >
                      submit
                    </button>
                    <button
                      className="p-button p-button-sm p-button-text"
                      onClick={() => setSelectorOpen(false)}
                    >
                      cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          body={(row: Artwork) => (
            <input
              type="checkbox"
              checked={isRowSelected(row.id)}
              onChange={(e) => onRowToggle(row.id, e.currentTarget.checked)}
              style={{ width: '20px', height: '20px', transform: 'translateY(1px)' }}
            />
          )}
          style={{ width: '3rem' }}
        />
        <Column field="id" header="Code" style={{ width: '8rem' }} />
        <Column field="title" header="Name" />
        <Column field="place_of_origin" header="Place of Origin" />
        <Column field="artist_display" header="Artist" />
        <Column field="inscriptions" header="Inscriptions" />
        <Column field="date_start" header="Date Start" style={{ width: '8rem' }} />
        <Column field="date_end" header="Date End" style={{ width: '8rem' }} />
      </DataTable>
    </div>
  )
}

export default App
