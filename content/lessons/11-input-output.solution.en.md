# Read input carefully

## Hints

1. Only the successful arm needs arithmetic.

2. Keep fail(code) and print code directly.

3. Use println("Next:", number + 1) in the ok arm.

## Solution

```kremen
package main
func main() {
    var input = readIntResult()
    match input {
        ok(number) => { println("Next:", number + 1) }
        fail(code) => { println("Input error:", code) }
    }
}
```

## Walkthrough

Valid input binds number; adding one gives the requested next value. Failed input binds its reader code, which is printed unchanged. No OS errorMessage conversion occurs. The stream-error code 4 is documented but is not simulated by the portable stdin fixtures.

## Connections to other languages

Every language must distinguish data from input failures. Rust parsing returns a Result; Go scanners expose errors; Python may raise conversion exceptions. The error transport differs, but validation and EOF handling remain necessary.
