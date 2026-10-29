# Name a calculation

## Goal

Separate a reusable function from the code that calls it.

## Explanation

A function groups instructions behind a name. Parameters are inputs local to that call. In `func twice(value i64) i64`, the last i64 is the return type. `return` computes a value and ends the call. Every path in a value-returning function must return a suitable value. A caller supplies arguments and must use the result. Local names do not leak into other functions.

## Example

```kremen
package main
func twice(value i64) i64 {
    return value * 2
}
func main() {
    println(twice(21))
}
```

## Your task

Implement square(value i64) i64. Use it to print square(3), square(5), and square(-4), one result per line: 9, 25, 16.

## Starter code

```kremen
package main
func square(value i64) i64 {
    return value
}
func main() {
    println(square(3))
    println(square(5))
    println(square(-4))
}
```
