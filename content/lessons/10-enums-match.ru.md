# Представить возможные случаи

## Цель

Моделировать взаимоисключающие состояния через enum и полный match.

## Объяснение

enum — значение с ровно одним активным вариантом. Вариант может нести данные: Value(number i64). Даже вариант без данных создают со скобками: Reading.Missing(). match выбирает вариант и даёт вложенному значению локальное имя. В Learn перечисляйте все варианты явно. Тогда добавление нового случая потребует пересмотреть каждое место принятия решения. Вложенные шаблоны, guards и шаблоны литералов в этой версии не поддерживаются.

## Пример

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

## Задание

Представьте сигнал светофора вариантами Stop, Wait и Go. Пусть show выводит `stop`, `wait` или `go` для своего аргумента. Вызовите все три варианта в этом порядке.

## Стартовый код

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
