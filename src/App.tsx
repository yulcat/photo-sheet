import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import './App.css'

const STORAGE_KEY = 'photo-sheet-work-v1'
const EXPORT_DPI = 300

type PaperPreset = {
  id: string
  name: string
  shortName: string
  widthIn: number
  heightIn: number
}

type LayoutCell = {
  x: number
  y: number
  width: number
  height: number
}

type LayoutPreset = {
  id: string
  name: string
  hint: string
  cells: LayoutCell[]
}

type PhotoAsset = {
  id: string
  name: string
  src: string
  width: number
  height: number
}

type CellState = {
  id: string
  photoId: string | null
  zoom: number
  offsetX: number
  offsetY: number
  rotation: number
}

type SheetState = {
  paperId: string
  layoutId: string
  marginMm: number
  gapMm: number
  rounded: boolean
  background: string
  autoFill: boolean
  photos: PhotoAsset[]
  cells: CellState[]
  activeCellId: string | null
}

type DragState = {
  cellId: string
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  width: number
  height: number
}

type StepId = 'photos' | 'layout' | 'adjust' | 'save'

type FlowStep = {
  id: StepId
  label: string
  summary: string
}

const paperPresets: PaperPreset[] = [
  {
    id: '4x6-portrait',
    name: '4x6 세로',
    shortName: '4x6',
    widthIn: 4,
    heightIn: 6,
  },
  {
    id: '4x6-landscape',
    name: '4x6 가로',
    shortName: '4x6',
    widthIn: 6,
    heightIn: 4,
  },
  {
    id: '5x7-portrait',
    name: '5x7 세로',
    shortName: '5x7',
    widthIn: 5,
    heightIn: 7,
  },
  {
    id: 'a4-portrait',
    name: 'A4 세로',
    shortName: 'A4',
    widthIn: 8.27,
    heightIn: 11.69,
  },
  {
    id: 'a4-landscape',
    name: 'A4 가로',
    shortName: 'A4',
    widthIn: 11.69,
    heightIn: 8.27,
  },
]

const grid = (columns: number, rows: number): LayoutCell[] =>
  Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)

    return {
      x: column / columns,
      y: row / rows,
      width: 1 / columns,
      height: 1 / rows,
    }
  })

const layoutPresets: LayoutPreset[] = [
  {
    id: 'one',
    name: '1컷',
    hint: '한 장을 크게',
    cells: grid(1, 1),
  },
  {
    id: 'two-vertical',
    name: '2컷 좌우',
    hint: '가로로 나란히',
    cells: grid(2, 1),
  },
  {
    id: 'two-horizontal',
    name: '2컷 상하',
    hint: '세로로 나누기',
    cells: grid(1, 2),
  },
  {
    id: 'four-grid',
    name: '4분할',
    hint: '정사각 느낌',
    cells: grid(2, 2),
  },
  {
    id: 'three-strip',
    name: '3단 스트립',
    hint: '길게 세 컷',
    cells: grid(1, 3),
  },
  {
    id: 'six-grid',
    name: '6분할',
    hint: '작은 사진 여섯 장',
    cells: grid(2, 3),
  },
]

const colorOptions = [
  { label: '화이트', value: '#ffffff' },
  { label: '연한 민트', value: '#eef8f4' },
  { label: '연한 코랄', value: '#fff0ee' },
  { label: '연한 라벤더', value: '#f3f1ff' },
  { label: '잉크', value: '#111827' },
]

const flowSteps: FlowStep[] = [
  {
    id: 'photos',
    label: '사진 담기',
    summary: '인화할 사진만 먼저 고르세요.',
  },
  {
    id: 'layout',
    label: '용지/레이아웃',
    summary: '용지와 칸 수를 정하세요.',
  },
  {
    id: 'adjust',
    label: '칸별 조정',
    summary: '칸을 누르고 사진을 맞추세요.',
  },
  {
    id: 'save',
    label: '저장',
    summary: 'PNG나 JPEG로 저장하세요.',
  },
]

const defaultState = (): SheetState => ({
  paperId: '4x6-portrait',
  layoutId: 'four-grid',
  marginMm: 4,
  gapMm: 3,
  rounded: false,
  background: '#ffffff',
  autoFill: true,
  photos: [],
  cells: createCells(layoutPresets[3].cells.length),
  activeCellId: null,
})

function App() {
  const [state, setState] = useState<SheetState>(() => loadState())
  const [step, setStep] = useState<StepId>(() =>
    hasStoredPhotos() ? 'layout' : 'photos',
  )
  const [storageMessage, setStorageMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const storageMessageRef = useRef('')

  const paper = useMemo(
    () =>
      paperPresets.find((preset) => preset.id === state.paperId) ??
      paperPresets[0],
    [state.paperId],
  )
  const layout = useMemo(
    () =>
      layoutPresets.find((preset) => preset.id === state.layoutId) ??
      layoutPresets[0],
    [state.layoutId],
  )
  const activeCell = useMemo(
    () => state.cells.find((cell) => cell.id === state.activeCellId) ?? null,
    [state.activeCellId, state.cells],
  )
  const activeIndex = activeCell
    ? state.cells.findIndex((cell) => cell.id === activeCell.id)
    : -1
  const activePhoto = activeCell
    ? getPhotoForCell(activeCell, activeIndex, state)
    : null

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      if (storageMessageRef.current) {
        window.setTimeout(() => {
          storageMessageRef.current = ''
          setStorageMessage('')
        }, 0)
      }
    } catch {
      const message =
        '브라우저 저장 공간이 부족해 현재 작업을 자동 저장하지 못했어요. 사진 수를 줄이면 다시 저장됩니다.'
      if (storageMessageRef.current !== message) {
        window.setTimeout(() => {
          storageMessageRef.current = message
          setStorageMessage(message)
        }, 0)
      }
    }
  }, [state])

  const updateState = (updater: (current: SheetState) => SheetState) => {
    setState((current) => ensureActiveCell(updater(current)))
  }

  const setPaper = (paperId: string) => {
    updateState((current) => ({ ...current, paperId }))
  }

  const setLayout = (layoutId: string) => {
    updateState((current) => {
      const nextLayout =
        layoutPresets.find((preset) => preset.id === layoutId) ??
        layoutPresets[0]

      return {
        ...current,
        layoutId,
        cells: resizeCells(current.cells, nextLayout.cells.length),
      }
    })
  }

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    )

    if (files.length === 0) {
      return
    }

    const photos = await Promise.all(files.map(readPhotoFile))

    updateState((current) => {
      const nextPhotos = [...current.photos, ...photos]
      const nextCells = current.cells.map((cell, index) => {
        if (cell.photoId) {
          return cell
        }

        const photo = photos[index % photos.length]
        return photo ? { ...cell, photoId: photo.id } : cell
      })

      return {
        ...current,
        photos: nextPhotos,
        cells: nextCells,
        activeCellId: current.activeCellId ?? nextCells[0]?.id ?? null,
      }
    })

    setStep('layout')
    event.target.value = ''
  }

  const addSamples = async () => {
    const samples = await createSamplePhotos()

    updateState((current) => {
      const nextCells = current.cells.map((cell, index) =>
        cell.photoId
          ? cell
          : { ...cell, photoId: samples[index % samples.length]?.id ?? null },
      )

      return {
        ...current,
        photos: [...current.photos, ...samples],
        cells: nextCells,
        activeCellId: current.activeCellId ?? nextCells[0]?.id ?? null,
      }
    })
    setStep('layout')
  }

  const removePhoto = (photoId: string) => {
    const removingLastPhoto =
      state.photos.length <= 1 && state.photos.some((photo) => photo.id === photoId)

    updateState((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.id !== photoId),
      cells: current.cells.map((cell) =>
        cell.photoId === photoId ? { ...cell, photoId: null } : cell,
      ),
    }))

    if (removingLastPhoto) {
      setStep('photos')
    }
  }

  const assignPhoto = (photoId: string) => {
    if (!activeCell) {
      return
    }

    updateState((current) => ({
      ...current,
      cells: current.cells.map((cell) =>
        cell.id === activeCell.id
          ? {
              ...cell,
              photoId,
              zoom: 1,
              offsetX: 0,
              offsetY: 0,
              rotation: 0,
            }
          : cell,
      ),
    }))
  }

  const updateActiveCell = (updates: Partial<CellState>) => {
    if (!activeCell) {
      return
    }

    updateState((current) => ({
      ...current,
      cells: current.cells.map((cell) =>
        cell.id === activeCell.id ? { ...cell, ...updates } : cell,
      ),
    }))
  }

  const swapActiveCell = (direction: -1 | 1) => {
    if (activeIndex < 0) {
      return
    }

    const targetIndex = activeIndex + direction
    if (targetIndex < 0 || targetIndex >= state.cells.length) {
      return
    }

    updateState((current) => {
      const cells = [...current.cells]
      const source = cells[activeIndex]
      const target = cells[targetIndex]
      cells[activeIndex] = { ...target, id: source.id }
      cells[targetIndex] = { ...source, id: target.id }

      return { ...current, cells, activeCellId: target.id }
    })
  }

  const clearWork = () => {
    updateState(() => defaultState())
    localStorage.removeItem(STORAGE_KEY)
    setStep('photos')
  }

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    cell: CellState,
    index: number,
  ) => {
    updateState((current) => ({ ...current, activeCellId: cell.id }))

    if (!getPhotoForCell(cell, index, state)) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      cellId: cell.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cell.offsetX,
      originY: cell.offsetY,
      width: bounds.width,
      height: bounds.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const nextX = clamp(
      drag.originX + ((event.clientX - drag.startX) / drag.width) * 100,
      -100,
      100,
    )
    const nextY = clamp(
      drag.originY + ((event.clientY - drag.startY) / drag.height) * 100,
      -100,
      100,
    )

    updateState((current) => ({
      ...current,
      cells: current.cells.map((cell) =>
        cell.id === drag.cellId
          ? { ...cell, offsetX: nextX, offsetY: nextY }
          : cell,
      ),
    }))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const handleWheel = (
    event: WheelEvent<HTMLDivElement>,
    cell: CellState,
    index: number,
  ) => {
    if (!getPhotoForCell(cell, index, state)) {
      return
    }

    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.06 : 0.06
    updateState((current) => ({
      ...current,
      activeCellId: cell.id,
      cells: current.cells.map((item) =>
        item.id === cell.id
          ? { ...item, zoom: clamp(round(item.zoom + delta, 2), 0.5, 4) }
          : item,
      ),
    }))
  }

  const exportImage = async (mimeType: 'image/png' | 'image/jpeg') => {
    setExporting(true)
    try {
      const canvas = await renderSheetToCanvas(state, paper, layout, mimeType)
      const link = document.createElement('a')
      const extension = mimeType === 'image/png' ? 'png' : 'jpg'
      link.href = canvas.toDataURL(mimeType, 0.92)
      link.download = `photo-sheet-${paper.id}-${layout.id}.${extension}`
      link.click()
    } finally {
      setExporting(false)
    }
  }

  const sheetStyle = {
    aspectRatio: `${paper.widthIn} / ${paper.heightIn}`,
    background: state.background,
  }
  const currentStepIndex = flowSteps.findIndex((item) => item.id === step)
  const currentStep = flowSteps[currentStepIndex] ?? flowSteps[0]
  const selectedLabel = activeIndex >= 0 ? `${activeIndex + 1}번 칸` : '선택 없음'
  const primaryLabel =
    step === 'photos'
      ? state.photos.length > 0
        ? '다음: 용지/레이아웃'
        : '사진 선택하기'
      : step === 'layout'
        ? '다음: 칸별 조정'
        : step === 'adjust'
          ? '다음: 저장'
          : exporting
            ? '저장 중'
            : 'PNG 저장'
  const primaryDisabled = step === 'save' && (exporting || state.photos.length === 0)

  const goToPreviousStep = () => {
    const previous = flowSteps[currentStepIndex - 1]
    if (previous) {
      setStep(previous.id)
    }
  }

  const runPrimaryAction = () => {
    if (step === 'photos') {
      if (state.photos.length === 0) {
        fileInputRef.current?.click()
        return
      }
      setStep('layout')
      return
    }

    if (step === 'layout') {
      setStep('adjust')
      return
    }

    if (step === 'adjust') {
      setStep('save')
      return
    }

    void exportImage('image/png')
  }

  const selectCell = (cellId: string) => {
    updateState((current) => ({ ...current, activeCellId: cellId }))
  }

  const renderStepPanel = () => {
    if (step === 'photos') {
      return (
        <div className="step-content">
          <section className="flow-section">
            <div className="section-heading">
              <h2>사진 담기</h2>
              <span>{state.photos.length}장</span>
            </div>
            <p className="helper-text">
              인화할 사진을 여러 장 한 번에 고르세요. 사진은 서버로 올라가지
              않고 이 브라우저에만 남습니다.
            </p>
            {state.photos.length > 0 ? (
              <div className="photo-count-card">
                <strong>{state.photos.length}장 담김</strong>
                <span>다음 단계에서 용지와 배치를 고르면 자동으로 채워집니다.</span>
              </div>
            ) : (
              <div className="quiet-box">
                <strong>먼저 사진만 담으면 돼요.</strong>
                <span>세부 조정은 뒤 단계에서 필요할 때만 열립니다.</span>
              </div>
            )}
            <div className="secondary-actions">
              {state.photos.length > 0 ? (
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  사진 더 담기
                </button>
              ) : null}
              <button type="button" onClick={() => void addSamples()}>
                샘플로 보기
              </button>
            </div>
          </section>
        </div>
      )
    }

    if (step === 'layout') {
      return (
        <div className="step-content">
          <section className="flow-section">
            <div className="section-heading">
              <h2>용지</h2>
              <span>{paper.name}</span>
            </div>
            <div className="preset-grid">
              {paperPresets.map((preset) => (
                <button
                  className={
                    preset.id === paper.id ? 'preset selected' : 'preset'
                  }
                  key={preset.id}
                  type="button"
                  onClick={() => setPaper(preset.id)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </section>

          <section className="flow-section">
            <div className="section-heading">
              <h2>레이아웃</h2>
              <span>{layout.cells.length}칸</span>
            </div>
            <div className="layout-list">
              {layoutPresets.map((preset) => (
                <button
                  className={
                    preset.id === layout.id
                      ? 'layout-option selected'
                      : 'layout-option'
                  }
                  key={preset.id}
                  type="button"
                  onClick={() => setLayout(preset.id)}
                >
                  <span>{preset.name}</span>
                  <small>{preset.hint}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="flow-section compact-options">
            <div className="section-heading">
              <h2>간격</h2>
              <span>mm</span>
            </div>
            <RangeControl
              label="바깥 여백"
              max={20}
              min={0}
              step={1}
              value={state.marginMm}
              onChange={(value) =>
                updateState((current) => ({ ...current, marginMm: value }))
              }
            />
            <RangeControl
              label="사진 사이"
              max={16}
              min={0}
              step={1}
              value={state.gapMm}
              onChange={(value) =>
                updateState((current) => ({ ...current, gapMm: value }))
              }
            />
            <div className="toggle-grid">
              <label className="switch-row">
                <input
                  checked={state.rounded}
                  type="checkbox"
                  onChange={(event) =>
                    updateState((current) => ({
                      ...current,
                      rounded: event.target.checked,
                    }))
                  }
                />
                모서리 둥글게
              </label>
              <label className="switch-row">
                <input
                  checked={state.autoFill}
                  type="checkbox"
                  onChange={(event) =>
                    updateState((current) => ({
                      ...current,
                      autoFill: event.target.checked,
                    }))
                  }
                />
                빈 칸은 사진 반복
              </label>
            </div>
            <div className="color-row">
              <span>배경</span>
              <div>
                {colorOptions.map((option) => (
                  <button
                    aria-label={option.label}
                    className={
                      option.value === state.background
                        ? 'color-chip selected'
                        : 'color-chip'
                    }
                    key={option.value}
                    style={{ background: option.value }}
                    type="button"
                    onClick={() =>
                      updateState((current) => ({
                        ...current,
                        background: option.value,
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (step === 'adjust') {
      return (
        <div className="step-content">
          <section className="flow-section">
            <div className="section-heading">
              <h2>칸 선택</h2>
              <span>{selectedLabel}</span>
            </div>
            <div className="cell-picker" aria-label="칸 선택">
              {state.cells.map((cell, index) => (
                <button
                  className={cell.id === activeCell?.id ? 'selected' : ''}
                  key={cell.id}
                  type="button"
                  onClick={() => selectCell(cell.id)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <p className="helper-text">
              미리보기의 칸을 끌어도 사진 위치가 바뀝니다.
            </p>
          </section>

          <section className="flow-section">
            <div className="section-heading">
              <h2>사진함</h2>
              <span>{state.photos.length}장</span>
            </div>
            {state.photos.length > 0 ? (
              <div className="photo-tray">
                {state.photos.map((photo) => (
                  <div className="thumb-wrap" key={photo.id}>
                    <button
                      className={
                        activeCell?.photoId === photo.id ? 'thumb selected' : 'thumb'
                      }
                      type="button"
                      title="선택한 칸에 넣기"
                      onClick={() => assignPhoto(photo.id)}
                    >
                      <img alt={photo.name} src={photo.src} />
                    </button>
                    <button
                      className="remove-thumb"
                      type="button"
                      aria-label={`${photo.name} 삭제`}
                      onClick={() => removePhoto(photo.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper-text">사진 담기 단계에서 사진을 먼저 골라주세요.</p>
            )}
          </section>

          <section className="flow-section">
            <div className="section-heading">
              <h2>미세 조정</h2>
              <span>{activePhoto ? activePhoto.name : '-'}</span>
            </div>
            {activeCell && activePhoto ? (
              <div className="edit-stack">
                <RangeControl
                  label="확대"
                  max={4}
                  min={0.5}
                  step={0.05}
                  value={activeCell.zoom}
                  onChange={(value) => updateActiveCell({ zoom: value })}
                />
                <RangeControl
                  label="좌우 이동"
                  max={100}
                  min={-100}
                  step={1}
                  value={activeCell.offsetX}
                  onChange={(value) => updateActiveCell({ offsetX: value })}
                />
                <RangeControl
                  label="상하 이동"
                  max={100}
                  min={-100}
                  step={1}
                  value={activeCell.offsetY}
                  onChange={(value) => updateActiveCell({ offsetY: value })}
                />
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveCell({
                        rotation: (activeCell.rotation + 90) % 360,
                      })
                    }
                  >
                    90° 회전
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveCell({
                        zoom: 1,
                        offsetX: 0,
                        offsetY: 0,
                        rotation: 0,
                      })
                    }
                  >
                    맞춤 초기화
                  </button>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => swapActiveCell(-1)}
                  >
                    앞으로
                  </button>
                  <button
                    type="button"
                    disabled={activeIndex >= state.cells.length - 1}
                    onClick={() => swapActiveCell(1)}
                  >
                    뒤로
                  </button>
                </div>
              </div>
            ) : (
              <p className="helper-text">
                칸을 고른 뒤 사진함의 썸네일을 누르면 조정할 수 있어요.
              </p>
            )}
          </section>
        </div>
      )
    }

    return (
      <div className="step-content">
        <section className="flow-section">
          <div className="section-heading">
            <h2>저장</h2>
            <span>300 DPI</span>
          </div>
          <div className="save-summary">
            <strong>
              {paper.name} · {layout.name}
            </strong>
            <span>{state.photos.length}장 사진으로 만든 한판입니다.</span>
          </div>
          <p className="print-hint">
            프린터 설정에서 용지를 {paper.name}로 맞추고, 여백 없음 또는 실제 크기
            100%를 선택하면 잘림을 줄일 수 있어요.
          </p>
          <button
            className="secondary-save"
            type="button"
            disabled={exporting || state.photos.length === 0}
            onClick={() => void exportImage('image/jpeg')}
          >
            JPEG 저장
          </button>
        </section>

        <section className="flow-section">
          <div className="section-heading">
            <h2>작업</h2>
            <span>자동 저장</span>
          </div>
          <p className="helper-text">
            새로고침해도 현재 배치가 복원됩니다. 공용 PC에서는 출력 후 작업을
            지워주세요.
          </p>
          <button className="danger" type="button" onClick={clearWork}>
            작업 지우기
          </button>
        </section>
      </div>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">브라우저 안에서만 작업</p>
          <h1>사진 한판</h1>
          <p className="intro">
            사진 담기부터 저장까지 한 단계씩 진행해요.
          </p>
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
        />
      </header>

      <nav className="stepper" aria-label="작업 단계">
        {flowSteps.map((item, index) => {
          const locked = state.photos.length === 0 && index > 0

          return (
            <button
              aria-current={item.id === step ? 'step' : undefined}
              className={item.id === step ? 'active' : ''}
              disabled={locked}
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
            >
              <span>{index + 1}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <section className="workspace" aria-label="사진 한판 편집기">
        <section className="preview-column" aria-label="미리보기">
          <div className="preview-toolbar">
            <div>
              <h2>미리보기</h2>
              <p>
                {paper.name} · {layout.name} · 300 DPI 출력
              </p>
            </div>
            <button
              className="preview-step-link"
              type="button"
              disabled={state.photos.length === 0}
              onClick={() => setStep('save')}
            >
              저장으로
            </button>
          </div>

          <div className="sheet-stage">
            <div
              className={state.rounded ? 'sheet rounded' : 'sheet'}
              style={sheetStyle}
            >
              {layout.cells.map((layoutCell, index) => {
                const cell = state.cells[index] ?? createCell(index)
                const photo = getPhotoForCell(cell, index, state)
                const selected = activeCell?.id === cell.id
                const rect = getCssRect(layoutCell, paper, state)

                return (
                  <div
                    aria-label={`${index + 1}번 칸`}
                    className={selected ? 'photo-cell selected' : 'photo-cell'}
                    key={cell.id}
                    role="button"
                    style={rect}
                    tabIndex={0}
                    onClick={() =>
                      selectCell(cell.id)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectCell(cell.id)
                      }
                    }}
                    onPointerDown={(event) =>
                      handlePointerDown(event, cell, index)
                    }
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onWheel={(event) => handleWheel(event, cell, index)}
                  >
                    {photo ? (
                      <img
                        alt=""
                        draggable={false}
                        src={photo.src}
                        style={getImageStyle(photo, cell, layoutCell, paper)}
                      />
                    ) : (
                      <div className="empty-cell">
                        <strong>{index + 1}</strong>
                        <span>사진을 넣어주세요</span>
                      </div>
                    )}
                    <span className="cell-number">{index + 1}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="preview-note">{currentStep.summary}</p>

          {storageMessage ? (
            <p className="storage-warning">{storageMessage}</p>
          ) : null}
        </section>

        <aside className="step-panel" aria-label={currentStep.label}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">현재 단계</p>
              <h2>{currentStep.label}</h2>
            </div>
            <span>
              {currentStepIndex + 1}/{flowSteps.length}
            </span>
          </div>
          {renderStepPanel()}
          <div className="stage-actions">
            <button
              className="ghost-action"
              type="button"
              disabled={currentStepIndex === 0}
              onClick={goToPreviousStep}
            >
              이전
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={primaryDisabled}
              onClick={runPrimaryAction}
            >
              {primaryLabel}
            </button>
          </div>
        </aside>
      </section>
    </main>
  )
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <strong>{Number.isInteger(value) ? value : value.toFixed(2)}</strong>
      </span>
      <input
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function loadState(): SheetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return ensureActiveCell(defaultState())
    }

    const parsed = JSON.parse(raw) as Partial<SheetState>
    const fallback = defaultState()
    const paperId =
      typeof parsed.paperId === 'string' &&
      paperPresets.some((preset) => preset.id === parsed.paperId)
        ? parsed.paperId
        : fallback.paperId
    const layout =
      layoutPresets.find((preset) => preset.id === parsed.layoutId) ??
      layoutPresets[3]

    return ensureActiveCell({
      ...fallback,
      ...parsed,
      paperId,
      layoutId: layout.id,
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      cells: resizeCells(
        Array.isArray(parsed.cells) ? parsed.cells : fallback.cells,
        layout.cells.length,
      ),
    })
  } catch {
    return ensureActiveCell(defaultState())
  }
}

function hasStoredPhotos(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return false
    }

    const parsed = JSON.parse(raw) as Partial<SheetState>
    return Array.isArray(parsed.photos) && parsed.photos.length > 0
  } catch {
    return false
  }
}

function ensureActiveCell(state: SheetState): SheetState {
  if (state.cells.length === 0) {
    return { ...state, activeCellId: null }
  }

  if (state.activeCellId && state.cells.some((cell) => cell.id === state.activeCellId)) {
    return state
  }

  return { ...state, activeCellId: state.cells[0].id }
}

function createCells(count: number): CellState[] {
  return Array.from({ length: count }, (_, index) => createCell(index))
}

function createCell(index: number): CellState {
  return {
    id: `cell-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    photoId: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
  }
}

function resizeCells(cells: CellState[], count: number): CellState[] {
  const next = cells.slice(0, count)
  while (next.length < count) {
    next.push(createCell(next.length))
  }
  return next
}

function getPhotoForCell(
  cell: CellState,
  index: number,
  state: SheetState,
): PhotoAsset | null {
  const directPhoto = state.photos.find((photo) => photo.id === cell.photoId)
  if (directPhoto) {
    return directPhoto
  }

  if (!state.autoFill || state.photos.length === 0) {
    return null
  }

  return state.photos[index % state.photos.length] ?? null
}

function getCssRect(
  cell: LayoutCell,
  paper: PaperPreset,
  state: SheetState,
): {
  height: string
  left: string
  top: string
  width: string
} {
  const paperWidthMm = paper.widthIn * 25.4
  const paperHeightMm = paper.heightIn * 25.4
  const marginX = (state.marginMm / paperWidthMm) * 100
  const marginY = (state.marginMm / paperHeightMm) * 100
  const gapX = (state.gapMm / paperWidthMm) * 100
  const gapY = (state.gapMm / paperHeightMm) * 100
  const innerWidth = Math.max(100 - marginX * 2, 1)
  const innerHeight = Math.max(100 - marginY * 2, 1)
  const leftGap = cell.x > 0 ? gapX / 2 : 0
  const rightGap = cell.x + cell.width < 0.999 ? gapX / 2 : 0
  const topGap = cell.y > 0 ? gapY / 2 : 0
  const bottomGap = cell.y + cell.height < 0.999 ? gapY / 2 : 0

  return {
    left: `${marginX + cell.x * innerWidth + leftGap}%`,
    top: `${marginY + cell.y * innerHeight + topGap}%`,
    width: `${cell.width * innerWidth - leftGap - rightGap}%`,
    height: `${cell.height * innerHeight - topGap - bottomGap}%`,
  }
}

function getImageStyle(
  photo: PhotoAsset,
  cell: CellState,
  layoutCell: LayoutCell,
  paper: PaperPreset,
): {
  height: string
  left: string
  top: string
  transform: string
  width: string
} {
  const frameAspect =
    (layoutCell.width * paper.widthIn) / (layoutCell.height * paper.heightIn)
  const rotated = cell.rotation % 180 !== 0
  const imageAspect = rotated
    ? photo.height / photo.width
    : photo.width / photo.height
  const coverByHeight = imageAspect > frameAspect

  return {
    left: `${50 + cell.offsetX}%`,
    top: `${50 + cell.offsetY}%`,
    width: coverByHeight ? 'auto' : '100%',
    height: coverByHeight ? '100%' : 'auto',
    transform: `translate(-50%, -50%) rotate(${cell.rotation}deg) scale(${cell.zoom})`,
  }
}

async function readPhotoFile(file: File): Promise<PhotoAsset> {
  const src = await readFileAsDataUrl(file)
  const dimensions = await getImageDimensions(src)

  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    src,
    width: dimensions.width,
    height: dimensions.height,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight }),
    )
    image.addEventListener('error', () => reject(new Error('이미지를 읽지 못했어요.')))
    image.src = src
  })
}

async function renderSheetToCanvas(
  state: SheetState,
  paper: PaperPreset,
  layout: LayoutPreset,
  mimeType: 'image/png' | 'image/jpeg',
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(paper.widthIn * EXPORT_DPI)
  canvas.height = Math.round(paper.heightIn * EXPORT_DPI)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('캔버스를 만들 수 없어요.')
  }

  context.fillStyle = mimeType === 'image/jpeg' ? state.background : state.background
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (const [index, layoutCell] of layout.cells.entries()) {
    const cell = state.cells[index]
    if (!cell) {
      continue
    }

    const photo = getPhotoForCell(cell, index, state)
    if (!photo) {
      continue
    }

    const image = await loadImage(photo.src)
    const rect = getCanvasRect(layoutCell, canvas, state)
    drawPhoto(context, image, photo, cell, rect, state.rounded)
  }

  return canvas
}

function getCanvasRect(
  cell: LayoutCell,
  canvas: HTMLCanvasElement,
  state: SheetState,
): { height: number; width: number; x: number; y: number } {
  const maxMargin = Math.min(canvas.width, canvas.height) * 0.45
  const margin = Math.min((state.marginMm / 25.4) * EXPORT_DPI, maxMargin)
  const gap = (state.gapMm / 25.4) * EXPORT_DPI
  const innerWidth = Math.max(canvas.width - margin * 2, 1)
  const innerHeight = Math.max(canvas.height - margin * 2, 1)
  const leftGap = cell.x > 0 ? gap / 2 : 0
  const rightGap = cell.x + cell.width < 0.999 ? gap / 2 : 0
  const topGap = cell.y > 0 ? gap / 2 : 0
  const bottomGap = cell.y + cell.height < 0.999 ? gap / 2 : 0

  return {
    x: margin + cell.x * innerWidth + leftGap,
    y: margin + cell.y * innerHeight + topGap,
    width: cell.width * innerWidth - leftGap - rightGap,
    height: cell.height * innerHeight - topGap - bottomGap,
  }
}

function drawPhoto(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  photo: PhotoAsset,
  cell: CellState,
  rect: { height: number; width: number; x: number; y: number },
  rounded: boolean,
) {
  context.save()
  if (rounded) {
    roundedRect(context, rect.x, rect.y, rect.width, rect.height, EXPORT_DPI * 0.04)
    context.clip()
  } else {
    context.beginPath()
    context.rect(rect.x, rect.y, rect.width, rect.height)
    context.clip()
  }

  const rotated = cell.rotation % 180 !== 0
  const sourceWidth = photo.width
  const sourceHeight = photo.height
  const rotatedWidth = rotated ? sourceHeight : sourceWidth
  const rotatedHeight = rotated ? sourceWidth : sourceHeight
  const coverScale =
    Math.max(rect.width / rotatedWidth, rect.height / rotatedHeight) * cell.zoom

  context.translate(
    rect.x + rect.width / 2 + (cell.offsetX / 100) * rect.width,
    rect.y + rect.height / 2 + (cell.offsetY / 100) * rect.height,
  )
  context.rotate((cell.rotation * Math.PI) / 180)
  context.drawImage(
    image,
    (-sourceWidth * coverScale) / 2,
    (-sourceHeight * coverScale) / 2,
    sourceWidth * coverScale,
    sourceHeight * coverScale,
  )
  context.restore()
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('이미지를 읽지 못했어요.')))
    image.src = src
  })
}

async function createSamplePhotos(): Promise<PhotoAsset[]> {
  const sampleNames = ['샘플 낮잠', '샘플 손잡기', '샘플 가족', '샘플 미소']
  const palettes = [
    ['#ffd9d1', '#8fcfbd', '#334155'],
    ['#dff5ee', '#f6b7a9', '#1f2937'],
    ['#e8edff', '#9fd4c8', '#374151'],
    ['#fff3b8', '#95c8d8', '#1f2937'],
  ]

  return Promise.all(
    sampleNames.map(async (name, index) => {
      const src = createSampleDataUrl(name, palettes[index])
      const dimensions = await getImageDimensions(src)

      return {
        id: `sample-${Date.now()}-${index}`,
        name,
        src,
        width: dimensions.width,
        height: dimensions.height,
      }
    }),
  )
}

function createSampleDataUrl(name: string, palette: string[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1600
  const context = canvas.getContext('2d')

  if (!context) {
    return ''
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, palette[0])
  gradient.addColorStop(1, palette[1])
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'rgba(255, 255, 255, 0.72)'
  context.beginPath()
  context.ellipse(600, 680, 310, 360, 0, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = 'rgba(255, 255, 255, 0.86)'
  context.beginPath()
  context.arc(600, 500, 150, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = palette[2]
  context.beginPath()
  context.arc(545, 480, 12, 0, Math.PI * 2)
  context.arc(655, 480, 12, 0, Math.PI * 2)
  context.fill()
  context.lineWidth = 12
  context.lineCap = 'round'
  context.beginPath()
  context.arc(600, 530, 44, 0.1 * Math.PI, 0.9 * Math.PI)
  context.stroke()

  context.fillStyle = 'rgba(255, 255, 255, 0.78)'
  context.fillRect(170, 1170, 860, 140)
  context.fillStyle = palette[2]
  context.font = '700 58px system-ui, sans-serif'
  context.textAlign = 'center'
  context.fillText(name, 600, 1260)

  return canvas.toDataURL('image/png')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export default App
