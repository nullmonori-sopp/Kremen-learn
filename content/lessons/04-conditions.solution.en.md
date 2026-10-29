# Choose a path

## Hints

1. 82 lies between 60 and 89.

2. Insert else if between the first if and the final else.

3. Use else if score >= 60 { println("passed") }.

## Solution

```kremen
package main
func main() {
    const score i64 = 82
    if score >= 90 {
        println("excellent")
    } else if score >= 60 {
        println("passed")
    } else {
        println("try again")
    }
}
```

## Walkthrough

82 fails the first comparison and passes the second, so only passed prints. Test the boundary values 59, 60, 89, and 90 yourself to understand why the order matters.

## Connections to other languages

Branching is shared by most languages. This classification pattern also appears in validation rules, UI state transitions, and protocol handlers. Boundary testing transfers directly to larger software.
