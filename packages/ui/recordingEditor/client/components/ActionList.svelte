<script lang="ts">
  import { getActionSteps, insertAnnotationStep, readStepAnnotations, removeMarkerSteps, renameMarkerSteps, type RecordingSteps, type StepMarker } from '@te/recorder-recording'

  import { actionKindLabel, summarizeAction } from '#ui/recordingEditor/client/presentation.ts'

  interface Props {
    onSelect: (actionIndex: number) => void
    onUpdateStepAnnotations: (steps: RecordingSteps) => void
    selectedActionIndex: number
    steps: RecordingSteps
  }

  interface MarkerSelection {
    markerIndex?: number
    start?: number
  }

  interface MarkerPresentation extends StepMarker {
    lane: number
    markerIndex: number
  }

  const markerColors = ['#7c3aed', '#0891b2', '#d97706', '#db2777', '#16a34a', '#dc2626']
  const markerLanesWithinExistingGutter = 3

  let { onSelect, onUpdateStepAnnotations, selectedActionIndex, steps }: Props = $props()
  let editedMarkerIndex = $state<number>()
  let editedMarkerName = $state('')
  let editedMarkerTop = $state<number>()
  let focusedMarkerIndex = $state<number>()
  let markerSelection = $state<MarkerSelection>()
  let markerSelectionHover = $state<number>()
  let markerTooltipOffset = $state(22)
  let actions = $derived(getActionSteps(steps))
  let annotations = $derived(readStepAnnotations(steps))
  let markerPresentations = $derived.by(() => {
    const laneEnds: number[] = []

    return annotations.markers
      .map((marker, markerIndex) => ({ ...marker, markerIndex }))
      .sort((left, right) => left.start - right.start || left.end - right.end || left.markerIndex - right.markerIndex)
      .map(marker => {
        const availableLane = laneEnds.findIndex(end => end <= marker.start)
        const lane = availableLane < 0 ? laneEnds.length : availableLane
        laneEnds[lane] = marker.end

        return { ...marker, lane }
      })
  })
  let markerLaneCount = $derived(Math.max(0, ...markerPresentations.map(marker => marker.lane + 1)))
  let markerGutterWidth = $derived(Math.min(44, 12 + Math.max(0, markerLaneCount - markerLanesWithinExistingGutter) * 7))
  let markerNameIsDuplicate = $derived(annotations.markers.some((marker, markerIndex) => markerIndex !== editedMarkerIndex && marker.name === editedMarkerName.trim()))
  let markerNameIsValid = $derived(Boolean(editedMarkerName.trim() && !markerNameIsDuplicate))

  function toggleScreenshot(at: number): void {
    const screenshot = annotations.screenshots.find(current => current.at === at)

    onUpdateStepAnnotations(screenshot ? steps.filter((_, stepIndex) => stepIndex !== screenshot.stepIndex) : insertAnnotationStep(steps, at, { kind: 'screenshot' }))
  }

  function hasScreenshot(at: number): boolean {
    return annotations.screenshots.some(screenshot => screenshot.at === at)
  }

  function chooseMarkerStep(actionIndex: number): void {
    if (!markerSelection) {
      if (annotations.markers.length >= 200) return

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
      name: markerSelection.markerIndex === undefined ? nextMarkerName() : annotations.markers[markerSelection.markerIndex].name,
      start: Math.min(markerSelection.start, actionIndex),
    }
    const withoutReselectedMarker = markerSelection.markerIndex === undefined ? steps : removeMarkerSteps(steps, annotations.markers[markerSelection.markerIndex])

    onUpdateStepAnnotations(insertAnnotationStep(insertAnnotationStep(withoutReselectedMarker, marker.start, { kind: 'marker-start', name: marker.name }), marker.end, { kind: 'marker-end', name: marker.name }))
    cancelMarkerSelection()
  }

  function nextMarkerName(): string {
    const names = new Set(annotations.markers.map(marker => marker.name))

    for (let suffix = annotations.markers.length + 1; ; suffix += 1) {
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
    editedMarkerName = annotations.markers[markerIndex].name
    editedMarkerTop = isOpen ? undefined : (event.currentTarget as HTMLButtonElement).offsetTop + (event.detail ? markerPointerOffset(event) : 22)
  }

  function saveMarkerName(): void {
    if (editedMarkerIndex === undefined || !markerNameIsValid) return

    const marker = annotations.markers[editedMarkerIndex]
    onUpdateStepAnnotations(renameMarkerSteps(steps, marker, editedMarkerName.trim()))
    editedMarkerIndex = undefined
    editedMarkerTop = undefined
  }

  function deleteMarker(markerIndex: number): void {
    onUpdateStepAnnotations(removeMarkerSteps(steps, annotations.markers[markerIndex]))
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

  function includesAction(marker: MarkerPresentation, actionIndex: number): boolean {
    return marker.start <= actionIndex && actionIndex < marker.end
  }

  function markerIsPreviewed(actionIndex: number): boolean {
    if (markerSelection?.start === undefined) return false

    return Math.min(markerSelection.start, markerSelectionHover ?? markerSelection.start) <= actionIndex && actionIndex <= Math.max(markerSelection.start, markerSelectionHover ?? markerSelection.start)
  }

  function markerButtonLabel(actionIndex: number): string {
    if (!markerSelection) return `Start marker at step ${actionIndex + 1}`
    if (markerSelection.start === undefined) return `Start ${annotations.markers[markerSelection.markerIndex!].name} at step ${actionIndex + 1}`

    return `End marker at step ${actionIndex + 1}`
  }

  function markerStyle(marker: MarkerPresentation): string {
    return `--marker-color: ${markerColors[marker.lane % markerColors.length]}; --marker-lane: ${marker.lane}; --marker-start: ${marker.start}; --marker-length: ${marker.end - marker.start}; --marker-tooltip-offset: ${markerTooltipOffset}px`
  }

  function markerColor(markerIndex: number): string {
    return markerColors[(markerPresentations.find(marker => marker.markerIndex === markerIndex)?.lane ?? 0) % markerColors.length]
  }

  function markerEmphasisStyle(actionIndex: number): string | undefined {
    const markerIndex = focusedMarkerIndex ?? editedMarkerIndex
    if (markerIndex === undefined || !annotations.markers[markerIndex] || !includesAction(markerPresentations.find(marker => marker.markerIndex === markerIndex)!, actionIndex)) return undefined

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
      <span>{annotations.markers.length} {annotations.markers.length === 1 ? 'marker' : 'markers'}</span>
      <span class:over-limit={annotations.screenshots.length > 3} class="screenshot-count">{annotations.screenshots.length}/3 screenshots</span>
    </div>
  </div>

  {#if annotations.screenshots.length > 3}
    <p class="annotation-notice">ThousandEyes results retain only the last three screenshots.</p>
  {/if}

  <div class="action-list-stack" style={`--marker-gutter-width: ${markerGutterWidth}px`}>
    <ol class="action-list">
      {#each actions as action, actionIndex}
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
              disabled={!markerSelection && annotations.markers.length >= 200}
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
          class:marker-single={marker.end - marker.start === 1}
          class:emphasized={focusedMarkerIndex === marker.markerIndex || editedMarkerIndex === marker.markerIndex}
          type="button"
          aria-expanded={editedMarkerIndex === marker.markerIndex}
          aria-label={`${marker.name}, steps ${marker.start + 1}–${marker.end}`}
          style={markerStyle(marker)}
          onclick={event => openMarker(marker.markerIndex, event)}
          onfocus={() => ((focusedMarkerIndex = marker.markerIndex), (markerTooltipOffset = 22))}
          onblur={() => (focusedMarkerIndex = undefined)}
          onpointerenter={event => hoverMarker(marker.markerIndex, event)}
          onpointerleave={() => (focusedMarkerIndex = undefined)}
        >
          <span class="marker-stroke"></span>
          <span class="marker-tooltip">
            <strong>{marker.name}</strong>
            <small>Steps {marker.start + 1}–{marker.end}</small>
          </span>
        </button>
      {/each}

      {#if previewStyle()}
        <span class="marker-preview-rail" class:marker-single={previewBoundary('start') === previewBoundary('end')} style={previewStyle()}></span>
      {/if}

      {#if editedMarkerIndex !== undefined && editedMarkerTop !== undefined && annotations.markers[editedMarkerIndex]}
        <form
          class="marker-editor-popover"
          style={`--marker-editor-top: ${editedMarkerTop}px; --marker-emphasis-color: ${markerColor(editedMarkerIndex)}`}
          aria-label={`Edit ${annotations.markers[editedMarkerIndex].name}`}
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
