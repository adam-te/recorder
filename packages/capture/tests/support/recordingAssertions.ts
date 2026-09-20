import type { RawEvent } from '@te/recorder-recording'

export { getOnlyEvent }

function getOnlyEvent<Event extends RawEvent, Kind extends Event['kind']>(recording: { events: readonly Event[] }, kind: Kind): Extract<Event, { kind: Kind }> {
  const matchingActions = recording.events.filter(action => action.kind === kind)

  if (matchingActions.length !== 1) {
    throw new Error(`Expected exactly one "${kind}" action, received ${matchingActions.length}.`)
  }

  return matchingActions[0] as Extract<Event, { kind: Kind }>
}
