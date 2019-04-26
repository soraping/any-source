### javascript constructor, prototype and new

> 写多了 `react` 是不是已经忘记了什么是原型链了，是不是已经忘记了那个纯真骚年的那份初心了，前端，写多了高大上的代码，是不是应该静下心来，好好学习下基础，下面慢慢回溯下几个常识点：

- constructor 构造器
- prototype 原型链
- new 一个对象到底发生了什么

#### constructor 构造器

`constructor` 是每个**实例对象**都会拥有的一个属性，而且这个属性的实在意义在于一个指针，它指向了创建当前这个实例对象的类。

```js
function Person() {}
let p = new Person();
// ƒ Person() {}
console.log(p.constructor);
```

控制台打印结果可以看出，`p.constructor` 指向的是 `Person` 对象，后面会详解 `new` 的过程。

`constructor` 的属性值是可以随时改变的，如果不赋值，那就默认指向了创建这个实例对象的类，如果赋值了，那就会指向所赋值。

在一般开发中，我们是不是很少用到这个属性啊，下面我就上点干货，来看看 `Preact` 源码里是怎么使用这个属性来解决业务场景的。

`Preact` 组件有两种创建方式，一种是利用类创建，继承 `Preact.Component` 父类或者不继承，拥有这个父类的 `render` 方法等属性，另一种是通过 `function` 创建的无状态组件（PFC），下面我就来说下 `Preact` 中是怎么使用 `constructor` 属性来处理的。

- 创建一个无状态组件

```js
// 函数创建的无状态组件
const Foo = () => {
  return <div>Foo</div>;
};

// 常见的容器组件创建方式
class App extends Preact.Component {
  render() {
    return (
      <div>
        <Foo />
      </div>
    );
  }
}
```

- babel 转码

```js
// 上述组件经过babel后转码后的虚拟dom生成函数
Preact.createElement(
  "div",
  null,
  React.createElement("p", null, "hahahaha"),
  React.createElement(Foo, null)
);

// 该函数返回的是一个虚拟dom
var Foo = function Foo() {
  return Preact.createElement("div", null, "Foo");
};
```

- 虚拟 dom 中的类型判断

```js
if(typeof type === 'function'){
    ...
}
```

上述代码中，`Preact.createElement` 方法中的第一个参数就是 `type`，其中 `Foo` 就是 `function` 类型。

- `Foo` 函数的两种形式

```js
if (Foo.prototype && Foo.prototype.render) {
}
```

在代码中会判断 `Foo` 函数是否能访问 `render` 方法，首次渲染肯定是没有的，所有，上述的判断会判定 `false`，关键点来了，下面来看看如果处理的：

首先来看下 `Preact.Component` 代码的实现：

```js
function Component(props, context) {
  this.context = context;
  this.props = props;
  this.state = this.state || {};
  // ...
}
Object.assign(Component.prototype, {
  setState(state, callback) {},
  forceUpdate(callback) {},
  render() {}
});
```

可以看出，如果是容器组件，继承了父类 `Preact.Component` ，就能够访问 `render` 方法，那么如果是无状态组件，怎样让这个组件拥有 `render` 方法：

```js
let inst = new Preact.Component(props, context);
inst.constructor = Foo;
inst.render = function(props, state, context) {
  return this.constructor(props, context);
};
```

起初看这个寥寥几行代码，包含了不少细致的东西。

首先，它定义了 `Preact.Component` 这个类的实例对象 `inst`，此时，这个 `inst` 的 `constructor` 默认指向 `Preact.Component` 这个类，接下来，给 `inst` 的 `constructor` 这个属性赋值了，改变指向函数 `Foo`，最后给这个实例对象 `inst` 添加一个 `render` 方法，核心就在这个方法，这个方法执行了 `this.constructor` ，其实就是执行了 `Foo` 方法，而 `Foo` 方法最终返回的就是一个虚拟 dom。

现在就说通了，其实，无状态组件最终也会拥有一个 `render` 方法，触发后会返回一个虚拟 dom 或者是子组件。

```js
let inst = new Preact.Component(props, context);
inst.render = function(props, state, context) {
  return Foo(props, context);
};
```

或许你可以说完全可以不用 `constructor` 的也能实现啊，这就是 `preact` 的精妙之处了，在源码中会有一个数组队列 `recyclerComponents`，这是专门用来回收销毁组件的，它的判断依据也是利用 `constructor` 属性：

```js
if (recyclerComponents[i].constructor === Foo) {
  // ...
}
```

#### prototype 原型链

js 每个对象都会拥有一个原型对象，即 `prototype`属性。

```js
function Person() {}
```

`Person` 对象的原型对象就是 `Person.prototype` 对象：

![原型](https://ws1.sinaimg.cn/large/e221b779gy1g1yhihnk6qj20nw0aqab1.jpg)

`Person.prototype` 对象里有那些属性：

![原型属性](https://ws1.sinaimg.cn/large/e221b779gy1g1yixxn42mj20r6050dgd.jpg)

可以看出这个对象默认拥有两个原生属性 `constructor` 和 `__proto__`。

`constructor` 上面说过了，所有的对象都会有，那么 `__proto__` 也是所有的对象都会有，它是一个内建属性，通过它可以访问到对象内部的 `[[Prototype]]` ，它的值可以是一个对象，也可以是 `null`。

那么 `__proto__` 到底是什么呢：

```js
function Person() {}
let p1 = new Person();
```

![__proto__](https://ws1.sinaimg.cn/large/e221b779gy1g1yj5fpxwfj20om0qgwhh.jpg)

图中的两个红框可以看出，`p1.__proto__` 和 `Person.prototype` 指向了同一个对象。

```js
// true
p1.__proto__ === Person.prototype;
```

![三者关系](https://ws1.sinaimg.cn/large/e221b779gy1g1yjcvh225j20qs0hkwgb.jpg)

`Person` 对象可以从这个原型对象上继承其方法和属性，所以 `Person` 对象的实例也能访问原型对象的属性和方法，但是这些属性和方法不会挂载在这个实例对象本身上，而是原型对象的构造器的原型 `prototype` 属性上。

那么，`Person.prototype` 的 `__proto__` 又指向哪里呢？

![__proto__](https://ws1.sinaimg.cn/large/e221b779gy1g234lulansj21cm0jiwhw.jpg)

看上图，可以看出 `p1.__proto__.__proto__` 指向了 `Object.prototype`，`p1.__proto__.__proto__.__proto__` 最后指向了 null，由此可以看出了构建了一条**原型链**。

**原型链的构建依赖于实例对象的 `__proto__` ，并不是原对象的 `prototype`**

ES6 设置获取原型的方法：

```js
// 给p1原型设置属性
Object.setPrototypeOf(p1, { name: "zhangsan" });

// zhangsan
console.log(p1.name);

// {name: "zhangsan"}
Object.getPrototypeOf(p1);
```

![Object.setPrototypeOf](https://ws1.sinaimg.cn/large/e221b779gy1g235e0gp27j20om0qgwhh.jpg)

上图红框可以看出，`Object.setPrototypeOf` 其实就是新的语法糖，相当于给 `P1.__proto__` 这个属性赋值。

一个简单的案例:

![另一个案例](https://ws1.sinaimg.cn/large/e221b779gy1g23616fpnkj20he0dq0tq.jpg)

经典的原型链图示：

![原型链](https://ws1.sinaimg.cn/large/e221b779gy1g234o1x3cuj20h60lpjsi.jpg)

举例，如何用原生 js 实现 `Student` 继承 `Person`：

```js
function Person(name) {
  this.name = name;
}
Person.prototype.getName = function() {
  return this.name;
};

function Student(name, age) {
  this.name = name;
  this.age = age;
}
Student.prototype.getInfo = function() {
  return `${this.name} and ${this.age}`;
};
```

实现继承，即要 `Student` 的实例能够访问 `Person` 的属性和方法，也要能访问 `Person` 原型上的方法 `getName`。

首先来看下 es6 的继承：

```js
class Person {
    public name: string
    constructor(name) {
        this.name = name
    }
    getName(){
        return this.name
    }
}

class Student extends Person {
    public age: number
    constructor(name, age) {
        super(name)
    }

    getAge() {
        return this.age
    }
}

let s = new Student('zhangsan', 20)

// zhangsan
s.name
// zhangsan
s.getName()
// 20
s.getAge()

```

那么，用原生 js 怎么做呢，下面来一步一步的实现。

- `call` 实现函数上下文继承

```js
function Person(name) {
  this.name = name;
}
Person.prototype.getName = function() {
  return this.name;
};

function Student(name, age) {
  Person.call(this, name);
  this.age = age;
}
Student.prototype.getInfo = function() {
  return `${this.name} and ${this.age}`;
};

let s = Student("zhangsan", 20);

// zhangsan
s.name;

// error
s.getName();
```

`call` 方法只是改变了 `Person` 中函数体内的 `this` 指向，并不能改变它的原型，所以无法访问 `Person` 方法的原型。

- 原型链实现原型继承

```js
function Person(name) {
  this.name = name;
}
Person.prototype.getName = function() {
  return this.name;
};

function Student(age) {
  this.age = age;
}
Student.prototype.getInfo = function() {
  return this.age;
};

Student.prototype = new Person("zhangsan");

let s = new Student(20);

// zhangsan
s.getName();
```

`Student.prototype` 的值设置为父类的实例对象，这样就能很简单的实现 `Student` 的实例对象能访问到 `Person` 的原型，但是这也是也有问题的，与其说继承的是 `Person` 这个类，不如说是继承的是这个类的实例对象，就是 `name = zhangsan` 这个实例，和 `oop` 的思想有背。

- 上面两种方式的结合，完美解决这个问题

```js
/**
 * 继承函数的核心方法
 */
function _extends(child, parent) {
  // 定义一个中间函数，并设置它的 constructor
  function __() {
    this.constructor = child;
  }
  // 这个函数的原型指向父类的原型
  __.prototype = parent.prototype;
  // 子类的原型窒息那个这个中间函数的实例对象
  child.prototype = new __();
}
```

这个 `_extends` 方法，是实现的核心，两个知识点，一是定义了一个无参数的中间函数，并设置它的 `constructor`；第二个就是对原型链的使用。

```js
function Person(name) {
  this.name = name;
  this.getName1 = function() {
    console.log("Person", this.name);
  };
}

Person.prototype.getName = function() {
  console.log("Person prototype", this.name);
};

// 这个方法一定要在定义子类原型之前调用
_extends(Student, Person);

function Student(name, age) {
  this.age = age;
  Person.call(this, name);
}
Student.prototype.getInfo = function() {
  console.log("Student", this.age);
};

let s = new Student("zhangsan", 12);

// Person prototype zhangsan
s.getName();
// Student 12
s.getInfo();
```

这样，就能简单是实现了继承，并且多重继承也是支持的

```js
// 多重继承
_extends(MidStudent, Student);
function MidStudent(name, age, className) {
  this.className = className;
  Student.call(this, name, age);
}

let mids = new MidStudent("lisi", 16, "class1");
// Person prototype lisi
mids.getName();
// Student 16
mids.getInfo();
```

**有兴趣可以多多研究研究，网上有不少精品案例，这个是 js 的基础，肯定比整天调用 api 有意思的多，收获的也会更多。**

#### 最后说下 new 一个对象到底发生了什么

俗话说，没有女朋友的你可以`new` 一个对象，那么这个 `new` 一下，到底经历了什么呢。

```js
let p1 = new Person();
```

> step1 让变量`p1`指向一个空对象

```js
let p1 = {};
```

> step2 让 `p1` 这个对象的 `__proto__` 属性指向 `Person` 对象的原型对象

```js
p1.__proto__ = Person.prototype;
```

> step3 让 `p1` 来执行 `Person` 方法

```js
Person.call(p1);
```

现在看这个流程，是不是很简单，是不是有种豁然开朗的感觉！

那要如何实现一个自己的 `new` 呢？

```js
/**
 * Con 目标对象
 * args 参数
 */
function myNew(Con, ...args) {
  // 创建一个空的对象
  let obj = {};
  // 链接到原型，obj 可以访问到构造函数原型中的属性
  // obj.__proto__ = Con.prototype;
  Object.setPrototypeOf(obj, Con.prototype);
  // 绑定 this 实现继承，obj 可以访问到构造函数中的属性
  let ret = Con.call(obj, ...args);
  // 优先返回构造函数返回的对象
  return ret instanceof Object ? ret : obj;
}
```

来测试下：

```js
function Person(name) {
  this.name = name;
}

Person.prototype.getName = function() {
  console.log(`your name is ${this.name}`);
};

let p2 = myNew(Person, "lisi");

// your name is lisi
p2.getName();
```

完美实现了！
