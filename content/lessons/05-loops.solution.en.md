# Repeat with a purpose

## Hints

1. Add to total only inside a conditional block.

2. An even number has remainder zero when divided by 2.

3. Wrap total += number in if number % 2 == 0.

## Solution

```kremen
package main
func main() {
    var total i64 = 0
    for number := 1; number <= 10; number++ {
        if number % 2 == 0 {
            total += number
        }
    }
    println(total)
}
```

## Walkthrough

The loop visits ten numbers and adds 2, 4, 6, 8, and 10. The invariant is that total contains the even values already visited. number grows each time, so the loop stops after 10.

## Connections to other languages

Accumulators and loop invariants underlie searching, parsing, and numerical algorithms in every language. Go uses a similar for syntax; Python often uses a range iterator.
