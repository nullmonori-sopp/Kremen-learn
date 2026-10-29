# Закрывать то, что открыли

## Цель

Планировать очистку и обрабатывать файловый результат, не теряя дескриптор.

## Объяснение

Ресурс, например открытый файл, нужно освободить. `defer fileClose(handle)` регистрирует вызов без результата сейчас, а выполняет при выходе из текущего блока, в том числе через return или ?. Аргументы фиксируются при регистрации. Несколько defer выполняются в обратном порядке. fsWrite создаёт или заменяет файл и возвращает !bool, fsOpen — !file, fsReadAll — !string. ? передаёт ошибки из функции с результатом. Файловые ошибки ОС используют errno, и их описывает errorMessage. При принудительном завершении процесса очистка не гарантируется.

## Пример

```kremen
package main
func main() {
    var value i64 = 1
    defer println("captured:", value)
    value = 2
    println("current:", value)
}
```

## Задание

Допишите saveAndCount: запишите в note.txt ровно `hello` и перевод строки. Сохраните defer закрытия сразу после открытия. Программа должна вывести `saved bytes: 6`, затем `finished`. Тест также проверяет note.txt внутри отдельного рабочего каталога.

## Стартовый код

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
