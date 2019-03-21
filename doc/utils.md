### actionTypes.js

```js
/**
 * 随机字符串，36进制，取6位，'.'间隔
 */
const randomString = () =>
  Math.random()
    .toString(36)
    .substring(7)
    .split("")
    .join(".");

/**
 * 内置ActionTypes，开发者在外部不要使用
 */
const ActionTypes = {
  INIT: `@@redux/INIT${randomString()}`,
  REPLACE: `@@redux/REPLACE${randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
};

export default ActionTypes;
```

### isPlainObject.js

> `Object.getPrototypeOf(obj)` 是 es6 新增的扩展方法，能够获取目标对象的原型对象。

```js
/**
 * 判断一个函数是否是简单对象，可以理解为简单的json对象，不是promise
 * @param {any} obj 目标对象
 * @returns {boolean}
 */
export default function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null) return false;

  let proto = obj;
  // 追溯这个对象的原型链，直到尽头null
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  // 如果这个一个对象的原型链上的开始和结尾都相同，则推断是 plain object
  return Object.getPrototypeOf(obj) === proto;
}
```

使用

```js
let obj = {
  name: "zhangsan"
};

let proto = Object.getPrototypeOf(obj);

// null
Object.getPrototypeOf(proto);

// true
isPlainObject(obj);

// 重新设置原型，深层理解下 Object.getPrototypeOf 方法
// 获取 obj 原型
let proto1 = Object.getPrototypeOf(obj);

Object.setPrototypeOf(proto1, { age: 10 });

// {age: 10}
let proto2 = Object.getPrototypeOf(proto1);

Object.setPrototypeOf(proto2, { nickname: "vivi" });

// {nickname: "vivi"}
let proto3 = Object.getPrototypeOf(proto2);

// null
Object.getPrototypeOf(proto3);

// false
proto1 === proto3;

// false
isPlainObject(obj);
```

### warning.js

```js
/**
 * 接收一个string message ,类似于直接在控制台 console.warn 方法
 * @param {*} message
 */
export default function warning(message) {
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error(message);
  }
  // 如果console被关闭或者不存在，则直接抛出异常
  try {
    throw new Error(message);
  } catch (e) {}
}
```
