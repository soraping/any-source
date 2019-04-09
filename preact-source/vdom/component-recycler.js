import { Component } from "../component";

/**
 * 保留一些组件，以便以后使用
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
   * 如果组件是向上面那样创建的，继承 Component 父类，则App的实例就会又render方法
   *
   * 这就解释了就算没有继承 Component 父类且通过函数创建的无状态函数组件（PFC）.
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
    /**
     * PFC类型组件处理
     * 1. 实例化 Component 类
     * 2. 实例化对象的构造器指向传入的PFC组件函数
     * 3. 添加render方法
     */
    inst = new Component(props, context);
    // constructor 如果不赋值，则默认指向 Component 类，重新赋值了，则指向了新的对象
    inst.constructor = Ctor;
    inst.render = doRender;
  }

  while (i--) {
    // 回收组件中存在之前创建过的 PFC 组件
    if (recyclerComponents[i].constructor === Ctor) {
      // nextBase 属性记录的是该组件之前渲染的实例
      inst.nextBase = recyclerComponents[i].nextBase;
      // 在组件回收站中删除这个组件
      recyclerComponents.splice(i, 1);
      return inst;
    }
  }
  // 返回这个组件实例
  return inst;
}

/**
 * 该方法，会将传入的函数 Ctor 的返回的 vnode 作为结果返回
 *
 * @param {*} props
 * @param {*} state
 * @param {*} context
 */
function doRender(props, state, context) {
  return this.constructor(props, context);
}
