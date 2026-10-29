# Your first program

## Hints

1. Add a call inside the braces of main.

2. Use a separate println for each line.

3. The second call is println("I can program.").

## Solution

```kremen
package main
func main() {
    println("Hello, Kremen!")
    println("I can program.")
}
```

## Walkthrough

The first call prints a greeting and a newline. The second prints the next sentence. No manual newline escape is needed. An extra blank line would fail the exact-output test.

## Connections to other languages

Most languages have an entry point and output functions: main in C, println! in Rust, and print in Python. Function names and punctuation differ; execution order remains the same.
