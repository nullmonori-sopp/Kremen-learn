# Repeat with a purpose

## Goal

Trace a loop and accumulate an answer without losing its boundary.

## Explanation

A for loop repeats a block. Its three parts initialize a counter, test a bool before each iteration, and update the counter afterward. In `for number := 1; number <= 5; number++`, := declares the counter and ++ adds one. A running total is an accumulator. Write its starting value before the loop. Ask what stays true before every iteration and why the loop eventually stops.

## Example

```kremen
package main
func main() {
    var total i64 = 0
    for number := 1; number <= 3; number++ {
        total += number
    }
    println(total)
}
```

## Your task

Sum all even integers from 1 through 10 inclusive. Print only `30`. Use a loop and test number % 2 == 0.

## Starter code

```kremen
package main
func main() {
    var total i64 = 0
    for number := 1; number <= 10; number++ {
        total += number
    }
    println(total)
}
```
