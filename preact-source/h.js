import { VNode } from "./vnode";
import options from "./options";

// 将从第3位起的参数收集起来(其实就是一堆 h 方法的执行函数)
const stack = [];

// 定义一个初始子组件空数组
const EMPTY_CHILDREN = [];

/**
 * 虚拟dom生成方法
 * `<div id="foo" name="bar">Hello!</div>`
 * `h('div', { id: 'foo', name : 'bar' }, 'Hello!');`
 *
 * @param {*} nodeName       元素标签名 例如: `div`, `a`, `span`, etc.
 * @param {*} attributes     jsx上面的属性
 * @param {*} [rest]         剩下的参数都是子组件
 * @return    VNode实例
 */
export function h(nodeName, attributes) {
  let children = EMPTY_CHILDREN,
    lastSimple,
    child,
    simple,
    i;
  // 遍历h函数的参数，从第三个参数开始就是子组件
  for (i = arguments.length; i-- > 2; ) {
    // 将从第3位起的参数收集起来(其实就是一堆 h方法的执行函数)
    stack.push(arguments[i]);
  }
  // jsx属性存在
  if (attributes && attributes.children != null) {
    // 挂载了children属性，也把这个children属性值压在stack数组内，之后再删除这个children属性
    if (!stack.length) stack.push(attributes.children);
    delete attributes.children;
  }
  // 遍历子组件
  while (stack.length) {
    // 取出子组件数组中最后一个元素，且处理子组件如果返回的是数组的情况
    if ((child = stack.pop()) && child.pop !== undefined) {
      for (i = child.length; i--; ) stack.push(child[i]);
    } else {
      /**
       * h函数会根据子组件的不同类型进行封装
       * - bool 返回 null
       * - null 返回 ""
       * - number 返回 String(number)
       * child 就是 h 函数从第3个起的参数
       */
      if (typeof child === "boolean") child = null;

      // 如果 nodeName 是一个简单元素标签，不是一个嵌套组件的 h 函数
      if ((simple = typeof nodeName !== "function")) {
        if (child == null) child = "";
        else if (typeof child === "number") child = String(child);
        // 如果这个 参数 不是一个简单类型的，设置标志位值
        else if (typeof child !== "string") simple = false;
      }

      // 将各种情况的child存进children中
      if (simple && lastSimple) {
        children[children.length - 1] += child;
      } else if (children === EMPTY_CHILDREN) {
        children = [child];
      } else {
        children.push(child);
      }

      lastSimple = simple;
    }
  }

  /**
   * 输出虚拟dom，VNode实例对象
   */
  let p = new VNode();
  // 标签或者 h 执行函数
  p.nodeName = nodeName;
  // 子组件组成的数组，每一项也是一个vnode
  p.children = children;
  // jsx 属性
  p.attributes = attributes == null ? undefined : attributes;
  // 组件唯一key
  p.key = attributes == null ? undefined : attributes.key;

  // 对最终生成的虚拟DOM进行扩展，如果扩展 options 对象 vnode 值不为 undefined，options的vnode方法会处理这个实例对象
  if (options.vnode !== undefined) options.vnode(p);

  return p;
}
