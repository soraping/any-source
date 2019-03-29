import { diff } from "./vdom/diff";

/**
 * Render JSX into a `parent` Element.
 * @param {import('./vnode').VNode} vnode h 函数生成的虚拟dom
 * @param {import('./dom').PreactElement} parent  该虚拟 dom 生成的真实 dom 将要挂载的父节点
 * @param {import('./dom').PreactElement} [merge] Attempt to re-use an existing DOM tree rooted at
 *  `merge`
 * @public
 *
 * @example
 * // render a div into <body>:
 * render(<div id="hello">hello!</div>, document.body);
 *
 * @example
 * // render a "Thing" component into #foo:
 * const Thing = ({ name }) => <span>{ name }</span>;
 * render(<Thing name="one" />, document.querySelector('#foo'));
 */
export function render(vnode, parent, merge) {
  return diff(merge, vnode, {}, false, parent, false);
}
