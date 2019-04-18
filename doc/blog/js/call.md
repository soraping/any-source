### 区别

call() 和 apply()的区别在于，call()方法接受的是若干个参数的列表，而 apply()方法接受的是一个包含多个参数的数组

```js
var func = function(arg1, arg2) {};

func.call(this, arg1, arg2); // 使用 call，参数列表
func.apply(this, [arg1, arg2]); // 使用 apply，参数数组
```

### 使用场景

#### 数组中最大值

```js
var numbers = [5, 458, 120, -215];
Math.max.apply(Math, numbers); //458
Math.max.call(Math, 5, 458, 120, -215); //458

// ES6
Math.max.call(Math, ...numbers); // 458
```

#### 验证是否是数组

```JS

function isArray(obj){
    return Object.prototype.toString.call(obj) === '[object Array]';
}
isArray([1, 2, 3]);
// true

// 直接使用 toString()
[1, 2, 3].toString(); 	// "1,2,3"
"123".toString(); 		// "123"
123.toString(); 		// SyntaxError: Invalid or unexpected token
Number(123).toString(); // "123"
Object(123).toString(); // "123"

```

可以通过 toString() 来获取每个对象的类型，但是不同对象的 toString()有不同的实现，所以通过 Object.prototype.toString() 来检测，需要以 call() / apply() 的形式来调用，传递要检查的对象作为第一个参数。

### 手写 call

```js
/**
    context 是改变this的目标对象，...args扩展符兼容多个参数
 */
Function.prototype.myCall = function(context, ...args) {
  // 此处的 this，指向了 say 方法，打印的结果就是 [Function: say]
  context.say = this;
  context.say(...args);
};
```

看上去是不是挺简单的，下面来试下这个方法

```js
let Person = {
  name: "zhangsan",
  say(age, className) {
    console.log(`your name ${this.name}, age ${age}, className ${className}`);
  }
};

let Person1 = {
  name: "lisi"
};

// your name lisi, age 12, className class1
Person.say.myCall(Person1, 12, "class1");
```

### 手写 apply

```js
Function.prototype.myApply = function(context, args) {
  context.speak = this;
  context.speak(args);
};
```

```js
let Person = {
  name: "zhangsan",
  say(age, className) {
    console.log(
      `say your name ${this.name}, age ${age}, className ${className}`
    );
  },
  speak([age, className]) {
    console.log(
      `speak your name ${this.name}, age ${age}, className ${className}`
    );
  }
};

let Person1 = {
  name: "lisi"
};

// speak your name lisi, age 20, className class2
Person.speak.myApply(Person1, [20, "class2"]);
```
