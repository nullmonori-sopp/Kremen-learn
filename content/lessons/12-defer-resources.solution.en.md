# Finish what you open

## Hints

1. The cleanup and error propagation are already present. Change the bytes passed to fsWrite.

2. Five ASCII letters plus one newline occupy six bytes.

3. Use fsWrite(path, "hello\n") and keep defer fileClose(handle).

## Solution

```kremen
package main
func saveAndCount(path string) !i64 {
    var written = fsWrite(path, "hello\n")?
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

## Walkthrough

The write result is propagated and then asserted. After opening, cleanup is registered before the read can fail. The read result is propagated; len counts six bytes. Returning closes the file before main prints the count. The defer in main prints finished last. File errors are OS errno values, unlike lesson 11 reader codes.

## Connections to other languages

Go also has defer. Rust uses ownership and Drop, C++ uses RAII, and Python uses with/context managers. The shared goal is to tie cleanup to a well-defined scope rather than remembering every exit manually.
