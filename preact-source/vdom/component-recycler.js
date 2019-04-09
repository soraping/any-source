import { Component } from "../component";

/**
 * Retains a pool of Components for re-use.
 * @type {Component[]}
 * @private
 */
export const recyclerComponents = [];

/**
 * 创建组件实例
 * 参数props与context分别对应的是组件的中属性和context
 * Components.
 * @param {function} Ctor Ctor组件则是需要创建的组件类型(函数或者是类)
 * @param {object} props 组件属性
 * @param {object} context 上下文环境
 * @returns {import('../component').Component}
 */
export function createComponent(Ctor, props, context) {
  let inst,
    i = recyclerComponents.length;

  /**
   * class App extends Component{}
   * 如果组件是向上面那样创建的，则App的实例就会又render方法
   */
  if (Ctor.prototype && Ctor.prototype.render) {
    // inst 是 组件实例，将props和context传入
    inst = new Ctor(props, context);
    /**
     * 如果没有给父级构造函数super传入props和context，
     * 那么inst中的props和context的属性为undefined,
     * 通过强制调用Component.call(inst, props, context)可以给inst中props、context进行初始化赋值。
     */
    Component.call(inst, props, context);
  } else {
    inst = new Component(props, context);
    inst.constructor = Ctor;
    inst.render = doRender;
  }

  while (i--) {
    if (recyclerComponents[i].constructor === Ctor) {
      inst.nextBase = recyclerComponents[i].nextBase;
      recyclerComponents.splice(i, 1);
      return inst;
    }
  }

  return inst;
}

/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
  return this.constructor(props, context);
}
