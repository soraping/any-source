import { extend } from "./util";
import { h } from "./h";

/**
 * 和 react.cloneElement 类似，是基于h函数实现
 * children.
 * @param {import('./vnode').VNode} 虚拟dom
 * @param {object} props 所传递属性
 * @param {Array<import('./vnode').VNode>} [rest] 第三个参数，类似与h函数的参数设置
 *  children.
 */
export function cloneElement(vnode, props) {
  return h(
    vnode.nodeName,
    extend(extend({}, vnode.attributes), props),
    arguments.length > 2 ? [].slice.call(arguments, 2) : vnode.children
  );
}
