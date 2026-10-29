# Failure as a value

## Goal

Handle both success and failure explicitly using a result.

## Explanation

`!i64` is a result containing either an i64 or a positive error code. A function returns `ok(value)` for success or `fail(code)` for failure. match inspects the case and binds its payload. In Learn, list both ok and fail and use the bound error code. Application codes have meanings chosen by your program. They are not automatically OS errno values. `?` can propagate a result in a fallible function; this exercise uses explicit match to show both paths.

## Example

```kremen
package main
func doubled(value i64) !i64 {
    if value < 0 {
        return fail(1001)
    }
    return ok(value * 2)
}
func main() {
    match doubled(-1) {
        ok(answer) => { println(answer) }
        fail(code) => { println("error:", code) }
    }
}
```

## Your task

Complete checkedSquare: negative input fails with application code 1001; otherwise return its square. Keep both calls and print `square: 9` then `error: 1001`.

## Starter code

```kremen
package main
func checkedSquare(value i64) !i64 {
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
