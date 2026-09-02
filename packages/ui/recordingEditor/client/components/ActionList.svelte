<script lang="ts">
  import { resolveThousandEyesScreenshotBoundary, type RecordedMarker, type Recording } from '@te/recorder-recording'

  import { actionKindLabel, summarizeAction } from '#ui/recordingEditor/client/presentation.ts'

  interface Props {
    onSelect: (actionIndex: number) => void
    onUpdateThousandEyes: (thousandEyes: Recording['thousandEyes']) => void
    recording: Recording
    selectedActionIndex: number
  }

  interface MarkerSelection {
    markerIndex?: number
    start?: number
  }

  interface MarkerPresentation {
    lane: number
    marker: RecordedMarker
    markerIndex: number
  }

  const markerColors = ['#7c3aed', '#0891b2', '#d97706', '#db2777', '#16a34a', '#dc2626']
  const markerLanesWithinExistingGutter = 3

  let { onSelect, onUpdateThousandEyes, recording, selectedActionIndex }: Props = $props()
  let editedMarkerIndex = $state<number>()
  let editedMarkerName = $state('')
  let editedMarkerTop = $state<number>()
  let focusedMarkerIndex = $state<number>()
  let markerSelection = $state<MarkerSelection>()
  let markerSelectionHover = $state<number>()
  let markerTooltipOffset = $state(22)
  let markerPresentations = $derived.by(() => {
    const laneEnds: number[] = []

    return recording.thousandEyes.markers
      .map((marker, markerIndex) => ({ marker, markerIndex }))
      .sort((left, right) => left.marker.start - right.marker.start || left.marker.end - right.marker.end || left.markerIndex - right.markerIndex)
      .map(({ marker, markerIndex }) => {
        const availableLane = laneEnds.findIndex(end => end <= marker.start)
        const lane = availableLane < 0 ? laneEnds.length : availableLane
        laneEnds[lane] = marker.end

        return { lane, marker, markerIndex }
      })
  })
  let markerLaneCount = $derived(Math.max(0, ...markerPresentations.map(marker => marker.lane + 1)))
  let markerGutterWidth = $derived(Math.min(44, 12 + Math.max(0, markerLaneCount - markerLanesWithinExistingGutter) * 7))
  let markerNameIsDuplicate = $derived(recording.thousandEyes.markers.some((marker, markerIndex) => markerIndex !== editedMarkerIndex && marker.name === editedMarkerName.trim()))
  let markerNameIsValid = $derived(Boolean(editedMarkerName.trim() && !markerNameIsDuplicate))

  function toggleScreenshot(at: number): void {
    const resolvedAt = resolveThousandEyesScreenshotBoundary(at, recording)

    onUpdateThousandEyes({
      ...recording.thousandEyes,
      screenshots: recording.thousandEyes.screenshots.some(screenshot => resolveThousandEyesScreenshotBoundary(screenshot.at, recording) === resolvedAt)
        ? recording.thousandEyes.screenshots.filter(screenshot => resolveThousandEyesScreenshotBoundary(screenshot.at, recording) !== resolvedAt)
        : [...recording.thousandEyes.screenshots, { at: resolvedAt }].sort((left, right) => left.at - right.at),
    })
  }

  function hasScreenshot(at: number): boolean {
    return recording.thousandEyes.screenshots.some(screenshot => resolveThousandEyesScreenshotBoundary(screenshot.at, recording) === at)
  }

  function chooseMarkerStep(actionIndex: number): void {
    if (!markerSelection) {
      if (recording.thousandEyes.markers.length >= 200) return

      editedMarkerIndex = undefined
      editedMarkerTop = undefined
      markerSelection = { start: actionIndex }
      markerSelectionHover = actionIndex
      return
    }

    if (markerSelection.start === undefined) {
      markerSelection = { ...markerSelection, start: actionIndex }
      markerSelectionHover = actionIndex
      return
    }

    const marker = {
      end: Math.max(markerSelection.start, actionIndex) + 1,
      name: markerSelection.markerIndex === undefined ? nextMarkerName() : recording.thousandEyes.markers[markerSelection.markerIndex].name,
      start: Math.min(markerSelection.start, actionIndex),
    }

    onUpdateThousandEyes({
      ...recording.thousandEyes,
      markers:
        markerSelection.markerIndex === undefined
          ? [...recording.thousandEyes.markers, marker]
          : recording.thousandEyes.markers.map((current, markerIndex) => (markerIndex === markerSelection?.markerIndex ? marker : current)),
    })
    cancelMarkerSelection()
  }

  function nextMarkerName(): string {
    const names = new Set(recording.thousandEyes.markers.map(marker => marker.name))

    for (let suffix = recording.thousandEyes.markers.length + 1; ; suffix += 1) {
      if (!names.has(`Marker ${suffix}`)) return `Marker ${suffix}`
    }
  }

  function cancelMarkerSelection(): void {
    markerSelection = undefined
    markerSelectionHover = undefined
  }

  function openMarker(markerIndex: number, event: MouseEvent): void {
    cancelMarkerSelection()
    const isOpen = editedMarkerIndex === markerIndex
    editedMarkerIndex = isOpen ? undefined : markerIndex
    editedMarkerName = recording.thousandEyes.markers[markerIndex].name
    editedMarkerTop = isOpen ? undefined : (event.currentTarget as HTMLButtonElement).offsetTop + (event.detail ? markerPointerOffset(event) : 22)
  }

  function saveMarkerName(): void {
    if (editedMarkerIndex === undefined || !markerNameIsValid) return

    onUpdateThousandEyes({
      ...recording.thousandEyes,
      markers: recording.thousandEyes.markers.map((marker, markerIndex) => (markerIndex === editedMarkerIndex ? { ...marker, name: editedMarkerName.trim() } : marker)),
    })
    editedMarkerIndex = undefined
    editedMarkerTop = undefined
  }

  function deleteMarker(markerIndex: number): void {
    onUpdateThousandEyes({ ...recording.thousandEyes, markers: recording.thousandEyes.markers.filter((_, currentMarkerIndex) => currentMarkerIndex !== markerIndex) })
    editedMarkerIndex = undefined
    editedMarkerTop = undefined
    focusedMarkerIndex = undefined
  }

  function reselectMarker(markerIndex: number): void {
    markerSelection = { markerIndex }
    markerSelectionHover = undefined
    editedMarkerIndex = undefined
    editedMarkerTop = undefined
    focusedMarkerIndex = undefined
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return

    if (markerSelection) cancelMarkerSelection()
    else {
      editedMarkerIndex = undefined
      editedMarkerTop = undefined
    }
  }

  function includesAction(marker: RecordedMarker, actionIndex: number): boolean {
    return marker.start <= actionIndex && actionIndex < marker.end
  }

  function markerIsPreviewed(actionIndex: number): boolean {
    if (markerSelection?.start === undefined) return false

    return Math.min(markerSelection.start, markerSelectionHover ?? markerSelection.start) <= actionIndex && actionIndex <= Math.max(markerSelection.start, markerSelectionHover ?? markerSelection.start)
  }

  function markerButtonLabel(actionIndex: number): string {
    if (!markerSelection) return `Start marker at step ${actionIndex + 1}`
    if (markerSelection.start === undefined) return `Start ${recording.thousandEyes.markers[markerSelection.markerIndex!].name} at step ${actionIndex + 1}`

    return `End marker at step ${actionIndex + 1}`
  }

  function markerStyle(marker: MarkerPresentation): string {
    return `--marker-color: ${markerColors[marker.lane % markerColors.length]}; --marker-lane: ${marker.lane}; --marker-start: ${marker.marker.start}; --marker-length: ${marker.marker.end - marker.marker.start}; --marker-tooltip-offset: ${markerTooltipOffset}px`
  }

  function markerColor(markerIndex: number): string {
    return markerColors[(markerPresentations.find(marker => marker.markerIndex === markerIndex)?.lane ?? 0) % markerColors.length]
  }

  function markerEmphasisStyle(actionIndex: number): string | undefined {
    const markerIndex = focusedMarkerIndex ?? editedMarkerIndex
    if (markerIndex === undefined || !recording.thousandEyes.markers[markerIndex] || !includesAction(recording.thousandEyes.markers[markerIndex], actionIndex)) return undefined

    return `--marker-emphasis-color: ${markerColor(markerIndex)}`
  }

  function previewBoundary(edge: 'start' | 'end'): number | undefined {
    if (markerSelection?.start === undefined) return undefined

    return edge === 'start' ? Math.min(markerSelection.start, markerSelectionHover ?? markerSelection.start) : Math.max(markerSelection.start, markerSelectionHover ?? markerSelection.start)
  }

  function previewStyle(): string | undefined {
    if (markerSelection?.start === undefined) return undefined

    return `--marker-lane: ${markerLaneCount}; --marker-start: ${previewBoundary('start')}; --marker-length: ${(previewBoundary('end') ?? markerSelection.start) - (previewBoundary('start') ?? markerSelection.start) + 1}`
  }

  function hoverMarker(markerIndex: number, event: PointerEvent): void {
    focusedMarkerIndex = markerIndex
    markerTooltipOffset = markerPointerOffset(event)
  }

  function markerPointerOffset(event: MouseEvent | PointerEvent): number {
    const marker = event.currentTarget as HTMLButtonElement

    return Math.max(16, Math.min(marker.offsetHeight - 16, event.clientY - marker.getBoundingClientRect().top))
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<nav class="action-sidebar" aria-label="Recording steps">
  <div class="action-sidebar-heading">
    <h2 class="section-heading">Steps</h2>
    <div class="annotation-actions">
      <span>{recording.thousandEyes.markers.length} {recording.thousandEyes.markers.length === 1 ? 'marker' : 'markers'}</span>
      <span class:over-limit={recording.thousandEyes.screenshots.length > 3} class="screenshot-count">{recording.thousandEyes.screenshots.length}/3 screenshots</span>
    </div>
  </div>

  {#if recording.thousandEyes.screenshots.length > 3}
    <p class="annotation-notice">ThousandEyes results retain only the last three screenshots.</p>
  {/if}

  <div class="action-list-stack" style={`--marker-gutter-width: ${markerGutterWidth}px`}>
    <ol class="action-list">
      {#each recording.actions as action, actionIndex}
        <li
          class="action-item"
          class:marker-emphasized={Boolean(markerEmphasisStyle(actionIndex))}
          class:marker-preview={markerIsPreviewed(actionIndex)}
          style={markerEmphasisStyle(actionIndex)}
          onpointerenter={() => markerSelection?.start !== undefined && (markerSelectionHover = actionIndex)}
        >
          <div class="action-row" class:selected={actionIndex === selectedActionIndex}>
            <button class="action-select" type="button" onclick={() => onSelect(actionIndex)}>
              <span class="action-number">{actionIndex + 1}</span>
              <span class="action-kind kind-{action.kind}">{actionKindLabel(action.kind)}</span>
              <span class="action-summary">{summarizeAction(action)}</span>
            </button>
            <button
              class="marker-toggle"
              class:pending={markerSelection?.start === actionIndex}
              type="button"
              aria-label={markerButtonLabel(actionIndex)}
              disabled={!markerSelection && recording.thousandEyes.markers.length >= 200}
              title={markerButtonLabel(actionIndex)}
              onclick={() => chooseMarkerStep(actionIndex)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 21V4"></path>
                <path class="marker-flag" d="M7 5h10l-2.5 3L17 11H7z"></path>
              </svg>
            </button>
            <button
              class="screenshot-toggle"
              class:active={hasScreenshot(actionIndex + 1)}
              type="button"
              aria-label={hasScreenshot(actionIndex + 1) ? `Remove screenshot after step ${actionIndex + 1}` : `Take screenshot after step ${actionIndex + 1}`}
              aria-pressed={hasScreenshot(actionIndex + 1)}
              title={hasScreenshot(actionIndex + 1) ? 'Remove screenshot' : 'Take screenshot after this step'}
              onclick={() => toggleScreenshot(actionIndex + 1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path class="camera-body" d="M8.5 6 10 4h4l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
                <circle cx="12" cy="12.5" r="3.5"></circle>
              </svg>
            </button>
          </div>
        </li>
      {/each}
    </ol>

    <div class="marker-overlay">
      {#each markerPresentations as marker}
        <button
          class="marker-rail"
          class:marker-single={marker.marker.end - marker.marker.start === 1}
          class:emphasized={focusedMarkerIndex === marker.markerIndex || editedMarkerIndex === marker.markerIndex}
          type="button"
          aria-expanded={editedMarkerIndex === marker.markerIndex}
          aria-label={`${marker.marker.name}, steps ${marker.marker.start + 1}–${marker.marker.end}`}
          style={markerStyle(marker)}
          onclick={event => openMarker(marker.markerIndex, event)}
          onfocus={() => ((focusedMarkerIndex = marker.markerIndex), (markerTooltipOffset = 22))}
          onblur={() => (focusedMarkerIndex = undefined)}
          onpointerenter={event => hoverMarker(marker.markerIndex, event)}
          onpointerleave={() => (focusedMarkerIndex = undefined)}
        >
          <span class="marker-stroke"></span>
          <span class="marker-tooltip">
            <strong>{marker.marker.name}</strong>
            <small>Steps {marker.marker.start + 1}–{marker.marker.end}</small>
          </span>
        </button>
      {/each}

      {#if previewStyle()}
        <span class="marker-preview-rail" class:marker-single={previewBoundary('start') === previewBoundary('end')} style={previewStyle()}></span>
      {/if}

      {#if editedMarkerIndex !== undefined && editedMarkerTop !== undefined && recording.thousandEyes.markers[editedMarkerIndex]}
        <form
          class="marker-editor-popover"
          style={`--marker-editor-top: ${editedMarkerTop}px; --marker-emphasis-color: ${markerColor(editedMarkerIndex)}`}
          aria-label={`Edit ${recording.thousandEyes.markers[editedMarkerIndex].name}`}
          onsubmit={event => (event.preventDefault(), saveMarkerName())}
        >
          <div class="marker-editor-heading">
            <strong>Marker</strong>
            <button type="button" aria-label="Close marker editor" onclick={() => ((editedMarkerIndex = undefined), (editedMarkerTop = undefined))}>×</button>
          </div>
          <label>
            Name
            <input aria-label="Marker name" required maxlength="200" bind:value={editedMarkerName} />
          </label>
          {#if markerNameIsDuplicate}<small class="field-error">Marker names must be unique.</small>{/if}
          <div class="marker-editor-actions">
            <button class="button small" type="submit" disabled={!markerNameIsValid}>Save</button>
            <button class="button small" type="button" onclick={() => reselectMarker(editedMarkerIndex!)}>Reselect</button>
            <button class="button small danger" type="button" onclick={() => deleteMarker(editedMarkerIndex!)}>Delete</button>
          </div>
        </form>
      {/if}
    </div>
  </div>
</nav>
