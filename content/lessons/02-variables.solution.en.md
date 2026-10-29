# Values with names

## Hints

1. Update notebooks before printing.

2. Use += to add the new notebooks.

3. Insert notebooks += 3 before the first println.

## Solution

```kremen
package main
func main() {
    var notebooks i64 = 4
    const price i64 = 6
    notebooks += 3
    println("notebooks:", notebooks)
    println("cost:", notebooks * price)
}
```

## Walkthrough

notebooks changes from 4 to 7. price stays 6. Multiplication reads the current value of notebooks, so the cost is 42. Assigning to price would be a compile error.

## Connections to other languages

This corresponds to mutable and immutable bindings in Rust, let and const in JavaScript, and ordinary variables with explicit types in C. Explicit integer widths matter when exchanging binary data.
