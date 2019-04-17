import options from "./options";
import { defer } from "./util";
import { renderComponent } from "./vdom/component";

/**
 * 待渲染队列
 * @type {Array<import('./component').Component>}
 */
let items = [];

/**
 * 组件存入渲染队列
 * @param {import('./component').Component} component The component to rerender
 */
export function enqueueRender(component) {
  // component._dirty为false时才会将组件放入待渲染队列中，然后就将 component._dirty 设置为 true
  // 这样就能防止一个组件多次render
  if (
    !component._dirty &&
    (component._dirty = true) &&
    // 仅有一次放在render队列中
    items.push(component) == 1
  ) {
    // 异步的执行render，要执行render方法的component中的_dirty设为true
    (options.debounceRendering || defer)(rerender);
  }
}

/**
 * 逐一取出组件，一次调用 renderComponent 函数
 */
export function rerender() {
  let p;
  while ((p = items.pop())) {
    if (p._dirty) renderComponent(p);
  }
}
