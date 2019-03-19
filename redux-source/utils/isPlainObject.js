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
