# Values with names

## Goal

Declare typed variables and distinguish mutable values from constants.

## Explanation

A variable names a stored value. In `var apples i64 = 3`, i64 is a signed 64-bit integer type and 3 is the initial value. `var` permits reassignment; `const` does not. `+=` adds to an existing value. `bool` stores true or false and `string` stores text bytes. Learn mode asks you to initialize every local variable explicitly. Unused names are errors, so use each value you declare.

## Example

```kremen
package main
func main() {
    var apples i64 = 3
    const price i64 = 4
    apples += 2
    println("cost:", apples * price)
}
```

## Your task

Start with 4 notebooks, add 3, and print their total price at 6 per notebook. Output exactly `notebooks: 7` and `cost: 42` on separate lines. Keep price constant.

## Starter code

```kremen
package main
func main() {
    var notebooks i64 = 4
    const price i64 = 6
    println("notebooks:", notebooks)
    println("cost:", notebooks * price)
}
```
