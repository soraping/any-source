/**
 * 可以用 Object.assign
 * @param {*} obj
 * @param {*} props
 */
export function extend(obj, props) {
  for (let i in props) obj[i] = props[i];
  return obj;
}

/**
 * 对第一个参数 ref 进行类型判断
 * 如果是一个执行函数，则执行 ref 这个函数，value就是其参数
 * 如果是一个字面量，就追加一个 current 属性，并将value赋值
 * @param {*} ref
 * @param {*} value
 */
export function applyRef(ref, value) {
  if (ref) {
    if (typeof ref == "function") ref(value);
    else ref.current = value;
  }
}

/**
 * defer是一个用于异步执行的函数变量
 * promise或者是定时器
 * 在某种浏览器中，上述的三元未必成立，所以就做了这个判断
 * 而且，promise 是 microtask，在事件循环的最末尾处，触发的事件比 settimeout快
 */
export const defer =
  typeof Promise == "function"
    ? Promise.resolve().then.bind(Promise.resolve())
    : setTimeout;
