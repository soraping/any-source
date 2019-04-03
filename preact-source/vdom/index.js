import { extend } from "../util";

/**
 * Check if two nodes are equivalent.
 * @param {import('../dom').PreactElement} node DOM Node to compare
 * @param {import('../vnode').VNode} vnode Virtual DOM node to compare
 * @param {boolean} [hydrating=false] If true, ignores component constructors
 *  when comparing.
 * @private
 */
export function isSameNodeType(node, vnode, hydrating) {
  if (typeof vnode === "string" || typeof vnode === "number") {
    return node.splitText !== undefined;
  }
  if (typeof vnode.nodeName === "string") {
    return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
  }
  return hydrating || node._componentConstructor === vnode.nodeName;
}

/**
 * 判断虚拟dom中的元素类型与原先dom元素的类型是否相同
 * @param {*} node 已经存在页面上的旧dom
 * @param {*} nodeName 虚拟dom中的元素类型
 */
export function isNamedNode(node, nodeName) {
  return (
    node.normalizedNodeName === nodeName ||
    node.nodeName.toLowerCase() === nodeName.toLowerCase()
  );
}

/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {import('../vnode').VNode} vnode The VNode to get props for
 * @returns {object} The props to use for this VNode
 */

/**
 * 获取虚拟dom的属性以及默认属性
 * @param {*} vnode
 */
export function getNodeProps(vnode) {
  let props = extend({}, vnode.attributes);
  props.children = vnode.children;

  let defaultProps = vnode.nodeName.defaultProps;
  if (defaultProps !== undefined) {
    for (let i in defaultProps) {
      if (props[i] === undefined) {
        props[i] = defaultProps[i];
      }
    }
  }

  return props;
}
