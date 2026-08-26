# When Chatting

- Always be concise and direct with your responses unless more detail is requested
- Use ASCII diagrams, JavaSscript-style psuedocode, and minimal bulleted lists when applicable to express your ideas more succicnctly

# When Coding

- These conventions apply to first-party, hand-written source. Do not edit vendored, generated, or compiled output to enforce them
- Always use the `matchBy` function over `switch` statements
- Always use truthy/falsy checks over strict equality when it doesn't change the result
- Always use early returns for negative conditions if applicable
- Avoid one-off variables; Prefer nesting expressions and functions over many one-off variables

# When Testing

- Only write top-level integration style tests unless specifically requested otherwise
- Never write low value tests that assert trivial conditions or otherwise assert something non-core to the project
