# Ошибка как значение

## Цель

Явно обрабатывать успешный результат и ошибку.

## Объяснение

`!i64` — результат, содержащий либо i64, либо положительный код ошибки. Функция возвращает `ok(value)` при успехе или `fail(code)` при неудаче. match проверяет случай и связывает вложенное значение с именем. В Learn нужно перечислить ok и fail и использовать код ошибки. Значение предметных кодов определяет программа; это не автоматически OS errno. `?` может передать ошибку из функции с результатом; здесь используем явный match, чтобы увидеть оба пути.

## Пример

```kremen
package main
func doubled(value i64) !i64 {
    if value < 0 {
        return fail(1001)
    }
    return ok(value * 2)
}
func main() {
    match doubled(-1) {
        ok(answer) => { println(answer) }
        fail(code) => { println("error:", code) }
    }
}
```

## Задание

Допишите checkedSquare: отрицательный вход даёт предметную ошибку 1001, иначе верните квадрат числа. Сохраните оба вызова и выведите `square: 9`, затем `error: 1001`.

## Стартовый код

```kremen
package main
func checkedSquare(value i64) !i64 {
    return ok(value * value)
}
func show(value i64) {
    match checkedSquare(value) {
        ok(answer) => { println("square:", answer) }
        fail(code) => { println("error:", code) }
    }
}
func main() {
    show(3)
    show(-2)
}
```
