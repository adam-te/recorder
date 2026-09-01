export { tryTo }

/**
 * Evaluates a function as a try expression, optionally catching an Error and always finalizing the evaluation.
 */
function tryTo<TryResult, CatchResult, FinallyResult = void>(tryFunction: () => TryResult, catchFunction: (error: Error) => CatchResult, finallyFunction?: () => FinallyResult, ...unexpectedAsyncCallbacks: AsyncCallbackArguments<TryResult, CatchResult | FinallyResult>): TryToResult<TryResult, CatchResult>
function tryTo<TryResult, FinallyResult>(tryFunction: () => TryResult, catchFunction: undefined, finallyFunction: () => FinallyResult, ...unexpectedAsyncCallbacks: AsyncCallbackArguments<TryResult, FinallyResult>): TryToResult<TryResult, never>
function tryTo(tryFunction: () => unknown, catchFunction: ((error: Error) => unknown) | undefined, finallyFunction?: () => unknown, ..._unexpectedAsyncCallbacks: never[]): unknown {
  let isAsynchronous = false
  let caughtSynchronously = false

  try {
    let result: unknown

    try {
      result = tryFunction()
    } catch (error: unknown) {
      caughtSynchronously = true
      result = catchError(error)
    }

    if (!isPromiseLike(result)) {
      return result
    }

    isAsynchronous = true
    const resultPromise = Promise.resolve(result)

    return (caughtSynchronously ? resultPromise : resultPromise.catch(catchError)).finally(finallyFunction)
  } finally {
    if (!isAsynchronous) {
      finallyFunction?.()
    }
  }

  function catchError(value: unknown): unknown {
    if (!Error.isError(value)) {
      throw new TypeError('tryTo caught a value that is not an Error.', { cause: value })
    }

    if (!catchFunction) {
      throw value
    }

    return catchFunction(value)
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return ((typeof value === 'object' && value !== null) || typeof value === 'function') && 'then' in value && typeof value.then === 'function'
}

type AsyncCallbackArguments<TryResult, OtherResult> = [TryResult] extends [never] ? (Extract<OtherResult, PromiseLike<unknown>> extends never ? [] : [never]) : TryResult extends PromiseLike<unknown> ? [] : Extract<OtherResult, PromiseLike<unknown>> extends never ? [] : [never]

type TryToResult<TryResult, CatchResult> = [TryResult] extends [never] ? CatchResult : TryResult extends PromiseLike<unknown> ? Promise<Awaited<TryResult> | Awaited<CatchResult>> : TryResult | CatchResult
