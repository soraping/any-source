/**
 * 从右至左来组合多个函数
 * 最右边的参数可以接收多个参数，因为它将为由此产生的函数提供签名
 *
 * 从右至左把接收到的函数合成后的最终函数
 * compose(f,g,h) 类似于 (...args) => f(g(h(...args)))
 *
 * @param  {...any} funcs
 */
export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
