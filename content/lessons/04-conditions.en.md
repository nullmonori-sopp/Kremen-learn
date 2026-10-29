# Choose a path

## Goal

Make mutually exclusive decisions using boolean conditions.

## Explanation

An if block runs only when its condition is true. else if tests another condition when the first failed; else handles the remaining cases. Conditions must have type bool. `>=` means at least. `&&` combines requirements, `||` accepts either, and `!` negates a bool. Order your cases carefully: a broad first condition can hide a more specific later one.

## Example

```kremen
package main
func main() {
    const temperature i64 = 12
    if temperature < 0 {
        println("freezing")
    } else {
        println("above freezing")
    }
}
```

## Your task

For score 82, print `excellent` at 90 or above, `passed` at 60 or above, otherwise `try again`. Only one line should print. Keep all three branches.

## Starter code

```kremen
package main
func main() {
    const score i64 = 82
    if score >= 90 {
        println("excellent")
    } else {
        println("try again")
    }
}
```
