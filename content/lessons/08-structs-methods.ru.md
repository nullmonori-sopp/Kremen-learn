# Данные и их поведение

## Цель

Объединять связанные поля и менять структуру через метод.

## Объяснение

Структура даёт имя группе полей. В литерале каждое поле указывают ровно один раз. Метод — функция с получателем перед именем. `counter &mut Counter` временно заимствует счётчик вызывающего кода и разрешает изменения. Обычный `counter Counter` получает копию. Компилятор проверяет конфликты заимствований. Здесь заимствование ограничено коротким вызовом метода; ссылки и время жизни подробно появятся позже.

## Пример

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

## Задание

Допишите add, чтобы метод увеличивал счётчик. Начните с 10, прибавьте 7 и затем 5. Выведите `counter: 22`.

## Стартовый код

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
