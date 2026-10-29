# Represent the possibilities

## Goal

Model exclusive states with an enum and an exhaustive match.

## Explanation

An enum is a value with exactly one active variant. A variant can carry data: Value(number i64). Even a variant without data uses parentheses when constructed, as in Reading.Missing(). match chooses the variant and gives its payload a local name. In Learn, enumerate all variants explicitly. This makes adding a new case visible at every decision site. Nested patterns, guards, and literal patterns are not supported in this version.

## Example

```kremen
package main
type Reading enum {
    Missing
    Value(number i64)
}
func main() {
    var reading = Reading.Value(42)
    match reading {
        Missing => { println("missing") }
        Value(number) => { println(number) }
    }
}
```

## Your task

Represent a traffic signal with Stop, Wait, and Go. Make show print `stop`, `wait`, or `go` for its argument. Call all three variants in that order.

## Starter code

```kremen
package main
type Signal enum {
    Stop
    Wait
    Go
}
func show(signal Signal) {
    match signal {
        Stop => { println("stop") }
        Wait => { println("stop") }
        Go => { println("stop") }
    }
}
func main() {
    show(Signal.Stop())
    show(Signal.Wait())
    show(Signal.Go())
}
```
