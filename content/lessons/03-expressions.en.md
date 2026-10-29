# Calculate and compare

## Goal

Use arithmetic, comparisons, and parentheses to produce values.

## Explanation

An expression produces a value. Multiplication and division happen before addition and subtraction; parentheses choose a different order. Integer division discards the fractional part: 17 / 5 is 3. The remainder operator % gives 2. `==` compares values, while `=` assigns them. Comparisons return bool. Integer operations and conversions have runtime safety checks; division by zero is an error, not a useful result.

## Example

```kremen
package main
func main() {
    println(2 + 3 * 4)
    println((2 + 3) * 4)
    println(17 / 5, 17 % 5)
}
```

## Your task

A group of 23 learners needs tables seating 4. Print full tables, remaining learners, then whether everyone fits without a partial table: `5`, `3`, `false`. Use /, %, and ==.

## Starter code

```kremen
package main
func main() {
    const learners i64 = 23
    const seats i64 = 4
    println(learners)
    println(seats)
}
```
