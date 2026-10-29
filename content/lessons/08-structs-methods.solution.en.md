# Data and its behavior

## Hints

1. Assignment replaces the field; addition should retain its previous value.

2. Use the same += operator as for an ordinary variable.

3. The method body is counter.value += amount.

## Solution

```kremen
package main
type Counter struct {
    value i64
}
func (counter &mut Counter) add(amount i64) {
    counter.value += amount
}
func main() {
    var counter = Counter{value: 10}
    counter.add(7)
    counter.add(5)
    println("counter:", counter.value)
}
```

## Walkthrough

The &mut receiver changes the original field. The first call makes 17; the second makes 22. Replacing += with = would leave only the last amount.

## Connections to other languages

Structs resemble records in C and Rust. Methods attach behavior as in Go or Rust. This is composition of data and functions; Kremen does not provide inheritance or interfaces.
