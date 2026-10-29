# Закрывать то, что открыли

## Подсказки

1. Очистка и передача ошибки уже есть. Измените байты, переданные в fsWrite.

2. Пять букв ASCII и перевод строки занимают шесть байтов.

3. Используйте fsWrite(path, "hello\n") и сохраните defer fileClose(handle).

## Решение

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

## Разбор решения

Результат записи передаётся через ? и затем проверяется assert. После открытия очистка регистрируется до возможной ошибки чтения. Результат чтения передаётся через ?, len считает шесть байтов. При возврате файл закрывается до вывода количества в main. defer в main выводит finished последним. Файловые ошибки — OS errno, в отличие от кодов считывателя в уроке 11.

## Связь с другими языками

В Go тоже есть defer. Rust использует владение и Drop, C++ — RAII, Python — with и контекстные менеджеры. Общая цель — привязать очистку к определённой области, а не вручную помнить каждый выход.
