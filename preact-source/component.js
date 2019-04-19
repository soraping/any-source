import { FORCE_RENDER } from "./constants";
import { extend } from "./util";
import { renderComponent } from "./vdom/component";
import { enqueueRender } from "./render-queue";

/**
 * 定义组件的父类 Component
 * 所写的react组件都会继承这个类，这样就能用得上这个父类的属性和方法了
 *
 * @example
 * class MyFoo extends Component {
 *   render(props, state) {
 *     return <div />;
 *   }
 * }
 *
 * @param {*} props
 * @param {*} context
 */
export function Component(props, context) {
  /**
   * 用来表示存在脏数据(即数据与存在的对应渲染不一致)，
   * 例如多次在组件实例调用setState，使得_dirty为true，
   * 但因为该属性的存在，只会使得组件仅有一次才会被放入更新队列。
   */
  this._dirty = true;

  /**
   * 组件上下文属性
   * @public
   * @type {object}
   */
  this.context = context;

  /**
   * @public
   * @type {object}
   */
  this.props = props;

  /**
   * @public
   * @type {object}
   */
  this.state = this.state || {};

  this._renderCallbacks = [];
}

/**
 * 给 Component 类的构造函数的原型上添加若干个方法
 */
extend(Component.prototype, {
  /**
   * this 指向调用的组件
   * 用来更新state树数据
   * state即可以是json，也可以是function
   * 执行 enqueueRender 函数,将组件存入缓存队列，异步调用 render 组件
   * @param {*} state 新的state
   * @param {*} callback 更新后的回调函数
   */
  setState(state, callback) {
    if (!this.prevState) this.prevState = this.state;
    this.state = extend(
      extend({}, this.state),
      typeof state === "function" ? state(this.state, this.props) : state
    );
    if (callback) this._renderCallbacks.push(callback);
    enqueueRender(this);
  },

  /**
   * 与React的forceUpdate相同，立刻同步重新渲染组件
   * @param {*} callback
   */
  forceUpdate(callback) {
    if (callback) this._renderCallbacks.push(callback);
    renderComponent(this, FORCE_RENDER);
  },

  /**
   * 返回组件的渲染内容的虚拟dom，此处函数体为空
   */
  render() {}
});
