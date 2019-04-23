import isPlainObject from "./isPlainObject";
import warning from "./warning";

/**
 * 判定纯对象异常方法
 * 在redux中，没有这样的优化
 * 值得学习
 * @param {*} value
 * @param {*} displayName
 * @param {*} methodName
 */
export default function verifyPlainObject(value, displayName, methodName) {
  if (!isPlainObject(value)) {
    warning(
      `${methodName}() in ${displayName} must return a plain object. Instead received ${value}.`
    );
  }
}
