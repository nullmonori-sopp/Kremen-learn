# Name a calculation

## Hints

1. A square is the product of a number with itself.

2. The same expression must work for positive and negative inputs.

3. Replace return value with return value * value.

## Solution

```kremen
package main
func square(value i64) i64 {
    return value * value
}
func main() {
    println(square(3))
    println(square(5))
    println(square(-4))
}
```

## Walkthrough

Each call has its own value parameter. Multiplying two negative values gives a positive square. We changed one function body and all three calls use the same rule.

## Connections to other languages

Functions enable decomposition and independent testing in C, Go, Rust, Java, and Python. Explicit input and output types help make contracts visible.
