# Finish what you open

## Goal

Schedule cleanup and handle a file result without leaking a handle.

## Explanation

A resource such as an open file must be released. `defer fileClose(handle)` registers a void call now and runs it when the current block exits, including return or propagation with ?. Arguments are captured when registered. Multiple deferred calls run in reverse order. fsWrite creates or replaces a file and returns !bool; fsOpen returns !file; fsReadAll returns !string. ? propagates failures from a fallible function. OS file errors use errno and can be described by errorMessage. Cleanup cannot be guaranteed after forced process termination.

## Example

```kremen
package main
func main() {
    var value i64 = 1
    defer println("captured:", value)
    value = 2
    println("current:", value)
}
```

## Your task

Complete saveAndCount to write exactly `hello` plus a newline to note.txt. Keep the deferred close immediately after opening. The program must print `saved bytes: 6` and then `finished`. The test also checks note.txt inside its isolated working directory.

## Starter code

```kremen
package main
func saveAndCount(path string) !i64 {
    var written = fsWrite(path, "hi\n")?
    assert(written)
    var handle = fsOpen(path, "rb")?
    defer fileClose(handle)
    var contents = fsReadAll(handle)?
    return ok(len(contents))
}
func main() {
    defer println("finished")
    match saveAndCount("note.txt") {
        ok(count) => { println("saved bytes:", count) }
        fail(code) => { println("file error:", errorMessage(code)) }
    }
}
```
