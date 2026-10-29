# Represent the possibilities

## Hints

1. Each arm should print the word for its own variant.

2. Change the Wait arm to println("wait").

3. Change the Go arm to println("go") and keep all three arms.

## Solution

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
        Wait => { println("wait") }
        Go => { println("go") }
    }
}
func main() {
    show(Signal.Stop())
    show(Signal.Wait())
    show(Signal.Go())
}
```

## Walkthrough

The type permits exactly three states. Each call selects one arm; no integer magic numbers or inconsistent combinations of booleans are needed. Explicit coverage satisfies the Learn L004 requirement.

## Connections to other languages

Tagged unions in Rust, discriminated unions in TypeScript, and algebraic data types express this pattern. Exhaustive decisions are useful for network messages, editor states, and parsed syntax.
