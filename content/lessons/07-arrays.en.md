# A sequence in memory

## Goal

Use zero-based indices and understand copying a fixed-size array.

## Explanation

An array stores a fixed number of values of one type. `[4]i64{3, 6, 9, 12}` has indices 0 through 3. len returns its length. Access at len is already out of bounds, so a traversal uses index < len(values). Kremen checks bounds. Assigning an array copies its elements: changing the copy leaves the original unchanged. Slices, a later topic, describe shared storage instead.

## Example

```kremen
package main
func main() {
    var values = [3]i64{2, 4, 6}
    var copy = values
    copy[0] = 9
    println(values[0], copy[0])
}
```

## Your task

Sum [3, 6, 9, 12]. Copy the array, change copy[0] to 99, then print `total: 30` and `original: 3 copy: 99`.

## Starter code

```kremen
package main
func main() {
    var values = [4]i64{3, 6, 9, 12}
    var total i64 = 0
    for index := 0; index < len(values); index++ {
        total += values[index]
    }
    var copy = values
    println("total:", total)
    println("original:", values[0], "copy:", copy[0])
}
```
