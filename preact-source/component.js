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
   * 用来更新state树数据
   * @param {*} state
   * @param {*} callback
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
