# Data and its behavior

## Goal

Group related fields and mutate a struct through a method.

## Explanation

A struct names a collection of fields. Its literal supplies every field exactly once. A method is a function with a receiver before its name. `counter &mut Counter` temporarily borrows the caller’s counter and permits changes. A plain `counter Counter` receives a copy. The compiler checks borrow conflicts. This lesson uses a short method call; references and lifetimes receive their own later module.

## Example

```kremen
package main
type Counter struct {
    value i64
}
func (counter &mut Counter) add(amount i64) {
    counter.value += amount
}
func main() {
    var counter = Counter{value: 0}
    counter.add(2)
    println(counter.value)
}
```

## Your task

Complete add so it increases the counter. Starting from 10, add 7 and then 5. Print `counter: 22`.

## Starter code

```kremen
package main
type Counter struct {
    value i64
}
func (counter &mut Counter) add(amount i64) {
    counter.value = amount
}
func main() {
    var counter = Counter{value: 10}
    counter.add(7)
    counter.add(5)
    println("counter:", counter.value)
}
```
