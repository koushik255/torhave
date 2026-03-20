<script>
  import { onDestroy, onMount } from 'svelte'

  /** @type {number} */
  export let durationSec
  /** @type {number} */
  export let startSec
  /** @type {number} */
  export let endSec
  /** @type {number} */
  export let currentTimeSec

  export let onChange = () => {}

  export let onClose = () => {}

  export let onPreview = () => {}

  export let onDragStateChange = () => {}

// When true, the start time is controlled by the paused video time (locked).
// UI disables dragging start; user edits end only.
export let startLocked = false

  const minGapSec = 0.05

  // Zoom/pan: only map the viewport to time (instead of mapping to full duration).
  let minSpanSec = 0.25
  let visibleSpanSec = 0
  let visibleStartSec = 0
  let lastPanCenterSec = 0

  /** @type {HTMLDivElement | null} */
  let barEl = null

  let dragMode = null
  let activePointerId = null

  let initialStart = 0
  let initialEnd = 0

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
  }

  function formatSeconds(sec) {
    if (!Number.isFinite(sec)) return ''
    return sec.toFixed(2)
  }

  function timeFromClientX(clientX) {
    const el = barEl
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const w = rect.width || 1
    const x = clientX - rect.left
    const ratio = clamp(x / w, 0, 1)
    const span = visibleSpanSec > 0 ? visibleSpanSec : durationSec
    return visibleStartSec + ratio * span
  }

  function panMaxFor(spanSec) {
    return Math.max(0, durationSec - spanSec)
  }

  function panToStart(nextStartSec) {
    visibleStartSec = clamp(nextStartSec, 0, panMaxFor(visibleSpanSec))
    lastPanCenterSec = visibleStartSec + visibleSpanSec / 2
  }

  function zoomToSpan(nextSpanSec) {
    const clamped = clamp(nextSpanSec, minSpanSec, durationSec)
    visibleSpanSec = clamped
    // Wheel zoom anchor should remain stable at the last panned center.
    visibleStartSec = clamp(
      lastPanCenterSec - visibleSpanSec / 2,
      0,
      panMaxFor(visibleSpanSec),
    )
  }

  function ensureTimeVisible(timeSec) {
    if (startLocked) return
    if (!Number.isFinite(visibleSpanSec) || visibleSpanSec <= 0) return
    const margin = visibleSpanSec * 0.07
    const visibleEnd = visibleStartSec + visibleSpanSec
    const panMax = panMaxFor(visibleSpanSec)

    if (timeSec < visibleStartSec + margin) {
      panToStart(clamp(timeSec - margin, 0, panMax))
    } else if (timeSec > visibleEnd - margin) {
      panToStart(clamp(timeSec + margin - visibleSpanSec, 0, panMax))
    }
  }

  /**
   * @param {WheelEvent} e
   */
  function onWheelZoom(e) {
    if (startLocked) return
    e.preventDefault()
    if (!durationSec || durationSec <= 0) return
    if (!visibleSpanSec || visibleSpanSec <= 0) return

    const zoomIn = e.deltaY < 0
    const factor = zoomIn ? 0.8 : 1.25
    zoomToSpan(visibleSpanSec * factor)
  }

  function spanFromZoom(z01) {
    // z01 in [0,1], maps to span in [minSpanSec, durationSec] with log scale.
    if (durationSec <= 0 || durationSec <= minSpanSec) return durationSec
    const ratio = durationSec / minSpanSec
    return minSpanSec * Math.pow(ratio, z01)
  }

  function zoomFromSpan(spanSec) {
    if (durationSec <= 0 || durationSec <= minSpanSec) return 0
    const ratio = durationSec / minSpanSec
    return Math.log(spanSec / minSpanSec) / Math.log(ratio)
  }

  function initView() {
    if (!durationSec || durationSec <= 0) return

    minSpanSec = Math.min(minSpanSec, durationSec)

    if (startLocked) {
      // When start is locked, keep it fixed visually by pinning the visible window to [start, duration].
      visibleStartSec = clamp(startSec, 0, durationSec)
      visibleSpanSec = clamp(durationSec - visibleStartSec, minSpanSec, durationSec)
      lastPanCenterSec = visibleStartSec + visibleSpanSec / 2
      return
    }

    const mid = (startSec + endSec) / 2
    const selLen = Math.max(minGapSec, endSec - startSec)

    // Start zoomed in around the current selection, but keep a sensible minimum.
    const span = Math.min(durationSec, Math.max(selLen * 4, durationSec / 10))
    visibleSpanSec = clamp(span, minSpanSec, durationSec)

    visibleStartSec = clamp(mid - visibleSpanSec / 2, 0, panMaxFor(visibleSpanSec))
    lastPanCenterSec = visibleStartSec + visibleSpanSec / 2
  }

  /**
   * @param {PointerEvent} e
   * @param {'start'|'end'} mode
   */
  function beginDrag(e, mode) {
    if (!durationSec || durationSec <= 0) return
    if (startLocked && mode === 'start') return

    e.preventDefault()
    e.stopPropagation()

    dragMode = mode
    activePointerId = e.pointerId

    initialStart = startSec
    initialEnd = endSec
    // Keep end constraints stable while dragging.

    onDragStateChange(true)
    if (typeof e.currentTarget?.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    updateFromPointer(e.clientX)
  }

  /**
   * @param {number} clientX
   */
  function updateFromPointer(clientX) {
    if (dragMode === null) return

    const t = timeFromClientX(clientX)

    if (dragMode === 'start') {
      const nextStart = clamp(t, 0, initialEnd - minGapSec)
      const nextEnd = initialEnd
      onChange(nextStart, nextEnd)
      ensureTimeVisible(nextStart)
      onPreview(nextStart)
      return
    }

    if (dragMode === 'end') {
      const nextStart = initialStart
      const nextEnd = clamp(t, initialStart + minGapSec, durationSec)
      onChange(nextStart, nextEnd)
      ensureTimeVisible(nextEnd)
      onPreview(nextEnd)
      return
    }

    // dragMode should only be 'start' or 'end' here.
  }

  function endDrag() {
    if (activePointerId === null) return
    activePointerId = null
    dragMode = null
    onDragStateChange(false)
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerMove(e) {
    if (activePointerId === null) return
    if (e.pointerId !== activePointerId) return
    updateFromPointer(e.clientX)
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerUp(e) {
    if (activePointerId === null) return
    if (e.pointerId !== activePointerId) return
    endDrag()
  }

  const pointerCaptureOpts = { capture: true }

  onMount(() => {
    initView()
    window.addEventListener('pointermove', onPointerMove, pointerCaptureOpts)
    window.addEventListener('pointerup', onPointerUp, pointerCaptureOpts)

    const onKeydown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('pointermove', onPointerMove, pointerCaptureOpts)
      window.removeEventListener('pointerup', onPointerUp, pointerCaptureOpts)
      window.removeEventListener('keydown', onKeydown)
    }
  })

  onDestroy(() => {
    endDrag()
  })

  $: visibleEndSec = visibleStartSec + visibleSpanSec
  $: panMax = panMaxFor(visibleSpanSec)

  $: overlayStartSec =
    durationSec > 0
      ? clamp(startSec, visibleStartSec, visibleEndSec)
      : 0
  $: overlayEndSec =
    durationSec > 0 ? clamp(endSec, visibleStartSec, visibleEndSec) : 0

  $: overlayWidthSec = Math.max(0, overlayEndSec - overlayStartSec)
  $: selectionLeftPercent =
    visibleSpanSec > 0 ? ((overlayStartSec - visibleStartSec) / visibleSpanSec) * 100 : 0
  $: selectionWidthPercent =
    visibleSpanSec > 0 ? (overlayWidthSec / visibleSpanSec) * 100 : 0

  $: startHandleLeftPercent =
    visibleSpanSec > 0
      ? clamp((startSec - visibleStartSec) / visibleSpanSec, 0, 1) * 100
      : 0
  $: endHandleLeftPercent =
    visibleSpanSec > 0
      ? clamp((endSec - visibleStartSec) / visibleSpanSec, 0, 1) * 100
      : 0

  $: playheadLeftPercent =
    visibleSpanSec > 0
      ? clamp((currentTimeSec - visibleStartSec) / visibleSpanSec, 0, 1) * 100
      : 0

  $: zoomSliderValue =
    durationSec > 0 && minSpanSec > 0 && durationSec > minSpanSec
      ? zoomFromSpan(visibleSpanSec)
      : 0

  $: panStep = visibleSpanSec > 0 ? Math.max(0.01, visibleSpanSec / 200) : 0.01
</script>

<div
  class="clip-modal-backdrop"
  role="button"
  tabindex="0"
  onclick={(e) => {
    // Only close when the user clicks on the backdrop itself.
    if (e.target === e.currentTarget) onClose()
  }}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') onClose()
  }}
>
  <div class="clip-modal-panel" role="dialog" aria-modal="true">
    <div class="clip-modal-header">
      <div class="clip-modal-title">Edit clip range</div>
      <button type="button" class="clip-modal-close" onclick={onClose}>
        Close
      </button>
    </div>

    <div class="clip-modal-body">
      <div
        class="clip-modal-timeline"
        bind:this={barEl}
        aria-label="Clip range timeline"
        onwheel={onWheelZoom}
      >
        <div
          class="clip-modal-selection"
          style={`left: ${selectionLeftPercent}%; width: ${selectionWidthPercent}%;`}
          aria-hidden="true"
        ></div>

        <div
          class="clip-modal-playhead"
          style={`left: ${playheadLeftPercent}%;`}
        ></div>

        <button
          type="button"
          class="clip-modal-handle clip-modal-handle-start"
          style={`left: ${startHandleLeftPercent}%;`}
          disabled={startLocked}
          onpointerdown={startLocked ? undefined : (e) => beginDrag(e, 'start')}
          aria-label="Start time"
        ></button>
        <button
          type="button"
          class="clip-modal-handle clip-modal-handle-end"
          style={`left: ${endHandleLeftPercent}%;`}
          onpointerdown={(e) => beginDrag(e, 'end')}
          aria-label="End time"
        ></button>
      </div>

      {#if startLocked}
        <div class="clip-modal-controls">
          <div class="clip-modal-end-row">
            <span class="clip-modal-view-label">End</span>
            <span class="clip-modal-view-range">{formatSeconds(endSec)}s</span>
          </div>
          <input
            type="range"
            min={startSec + minGapSec}
            max={durationSec}
            step={minGapSec}
            value={endSec}
            disabled={durationSec <= 0}
            oninput={(e) => {
              const nextEnd = clamp(
                Number(e.currentTarget.value),
                startSec + minGapSec,
                durationSec,
              )
              onChange(startSec, nextEnd)
              onPreview(nextEnd)
              ensureTimeVisible(nextEnd)
            }}
          />
        </div>
      {:else}
        <div class="clip-modal-controls">
          <div class="clip-modal-view-row">
            <span class="clip-modal-view-label">View</span>
            <span class="clip-modal-view-range"
              >{formatSeconds(visibleStartSec)}s - {formatSeconds(visibleEndSec)}s</span
            >
          </div>

          <div class="clip-modal-zoom-row">
            <span class="clip-modal-control-label">Zoom</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={zoomSliderValue}
              oninput={(e) => {
                const z = Number(e.currentTarget.value)
                zoomToSpan(spanFromZoom(z))
              }}
            />
          </div>

          <div class="clip-modal-pan-row">
            <span class="clip-modal-control-label">Pan</span>
            <input
              type="range"
              min="0"
              max={panMax}
              step={panStep}
              value={visibleStartSec}
              disabled={panMax <= 0}
              oninput={(e) => {
                visibleStartSec = clamp(Number(e.currentTarget.value), 0, panMax)
                lastPanCenterSec = visibleStartSec + visibleSpanSec / 2
              }}
            />
          </div>
        </div>
      {/if}

      <div class="clip-modal-values">
        <div class="clip-modal-value">
          <span class="clip-modal-label">Start</span>
          <span class="clip-modal-number">{formatSeconds(startSec)}s</span>
        </div>
        <div class="clip-modal-value">
          <span class="clip-modal-label">End</span>
          <span class="clip-modal-number">{formatSeconds(endSec)}s</span>
        </div>
      </div>

      <div class="clip-modal-actions">
        <button type="button" class="clip-modal-done" onclick={onClose}>
          Done
        </button>
      </div>
    </div>
  </div>
</div>

