export { matchBy, type MatchCases }

/**
 * Exhaustively dispatches a discriminated union through a lazily evaluated, narrowed case.
 */
function matchBy<Discriminant extends PropertyKey, Union extends Record<Discriminant, PropertyKey>, const Cases extends MatchCases<Union, Discriminant>>(
  value: Union,
  discriminant: Discriminant,
  cases: Cases,
  ...unexpectedCases: Exclude<keyof Cases, Union[Discriminant]> extends never ? [] : [never]
): MatchResult<Union, Discriminant, Cases>
function matchBy(value: object, discriminant: PropertyKey, cases: object): unknown {
  const discriminantValue = Reflect.get(value, discriminant) as unknown

  assert(typeof discriminantValue === 'string' || typeof discriminantValue === 'number' || typeof discriminantValue === 'symbol', `matchBy expected ${String(discriminant)} to be a property key.`)
  assert(Object.hasOwn(cases, discriminantValue), `matchBy received unsupported ${String(discriminant)} value: ${String(discriminantValue)}.`)

  const matchCase = Reflect.get(cases, discriminantValue) as unknown

  assert(typeof matchCase === 'function', `matchBy expected the ${String(discriminantValue)} case to be a function.`)

  return matchCase(value)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

type MatchCases<Union extends Record<Discriminant, PropertyKey>, Discriminant extends PropertyKey, Result = unknown> = {
  readonly [Value in Union[Discriminant]]: (value: Extract<Union, Record<Discriminant, Value>>) => Result
}

type MatchResult<Union extends Record<Discriminant, PropertyKey>, Discriminant extends PropertyKey, Cases extends MatchCases<Union, Discriminant>> = ReturnType<Cases[Union[Discriminant]]>
