# Failure as a value

## Hints

1. Validate before computing the successful result.

2. For a negative value, return fail(1001).

3. Insert if value < 0 { return fail(1001) } before return ok(...).

## Solution

```kremen
package main
func checkedSquare(value i64) !i64 {
    if value < 0 {
        return fail(1001)
    }
    return ok(value * value)
}
func show(value i64) {
    match checkedSquare(value) {
        ok(answer) => { println("square:", answer) }
        fail(code) => { println("error:", code) }
    }
}
func main() {
    show(3)
    show(-2)
}
```

## Walkthrough

3 reaches ok(9), while -2 returns fail(1001) before multiplication. match reads the appropriate payload in each call. Error code 1001 belongs to this exercise’s contract. Do not describe it with errorMessage, which expects OS errno values.

## Connections to other languages

Rust Result and tagged error values in other languages represent the same idea: expected failure participates in ordinary control flow. Go uses a separate error return value; the responsibility to handle failure is similar.
