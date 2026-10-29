# A sequence in memory

## Hints

1. The loop already calculates the correct sum.

2. Change the copy after assigning var copy = values.

3. Insert copy[0] = 99 before printing.

## Solution

```kremen
package main
func main() {
    var values = [4]i64{3, 6, 9, 12}
    var total i64 = 0
    for index := 0; index < len(values); index++ {
        total += values[index]
    }
    var copy = values
    copy[0] = 99
    println("total:", total)
    println("original:", values[0], "copy:", copy[0])
}
```

## Walkthrough

The original elements sum to 30. Assignment creates an independent value. Only the first element of copy becomes 99, while values[0] remains 3.

## Connections to other languages

Kremen and Rust fixed arrays are values. Python lists and JavaScript arrays behave more like references. Always check whether assignment copies data or shares storage.
