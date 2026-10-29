# Calculate and compare

## Hints

1. Quotient and remainder answer different questions.

2. Print learners / seats, then learners % seats.

3. Compare the remainder with zero using ==.

## Solution

```kremen
package main
func main() {
    const learners i64 = 23
    const seats i64 = 4
    println(learners / seats)
    println(learners % seats)
    println(learners % seats == 0)
}
```

## Walkthrough

23 = 5 × 4 + 3. Five tables are full, with three learners left. Since the remainder is not zero, the final comparison is false.

## Connections to other languages

Integer division, remainders, precedence, and boolean comparisons appear in C, Java, Go, and Rust. Python uses // for integer division, so syntax must be checked when switching languages.
