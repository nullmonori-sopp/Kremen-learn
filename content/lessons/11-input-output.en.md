# Read input carefully

## Goal

Read an integer while preserving failure information.

## Explanation

stdin is a stream of input bytes, stdout is the program’s normal output, and stderr carries diagnostics. `readIntResult()` returns a result instead of stopping on invalid input. Its domain codes are 1 for end of input, 2 for invalid format, 3 for out of i64 range, and 4 for stream failure. These are reader codes, not OS errno. In this application, fill stdin before running; tests supply their own input independently. Learn requires fallible integer input and handling both cases.

## Example

```kremen
package main
func main() {
    var input = readIntResult()
    match input {
        ok(number) => { println("Read:", number) }
        fail(code) => { println("Input error:", code) }
    }
}
```

## Your task

Read one integer. On success, print `Next:` followed by the integer plus one. On failure, print `Input error:` followed by the actual reader code. Do not print a prompt. The tests cover positive and negative values, malformed input, EOF, and range failure.

## Starter code

```kremen
package main
func main() {
    var input = readIntResult()
    match input {
        ok(number) => { println("Next:", number) }
        fail(code) => { println("Input error:", code) }
    }
}
```
