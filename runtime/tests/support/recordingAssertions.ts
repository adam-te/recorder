import type { RecordedAction, Recording } from '@te/recorder-core'

export { getOnlyAction }

function getOnlyAction<Kind extends RecordedAction['kind']>(recording: Pick<Recording, 'actions'>, kind: Kind): Extract<RecordedAction, { kind: Kind }> {
  const matchingActions = recording.actions.filter(action => action.kind === kind)

  if (matchingActions.length !== 1) {
    throw new Error(`Expected exactly one "${kind}" action, received ${matchingActions.length}.`)
  }

  return matchingActions[0] as Extract<RecordedAction, { kind: Kind }>
}
