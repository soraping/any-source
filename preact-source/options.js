/**
 * 扩展 preact 功能，主要用于兼容 react
 * @property {boolean} [syncComponentUpdates] 是否同步刷新组件
 * @property {(vnode: VNode) => void} [vnode] 用于扩展 vnode 实例
 * @property {(component: Component) => void} [afterMount] 钩子函数，在组件 mounted 之后执行，类似于 componentDidMount
 * @property {(component: Component) => void} [afterUpdate] 钩子函数，类似于 componentDidUpdate
 * @property {(component: Component) => void} [beforeUnmount] 钩子函数，在组件销毁之前，componentWillUnMount
 * @property {(rerender: function) => void} [debounceRendering] Hook invoked whenever a rerender is requested. Can be used to debounce rerenders.
 * @property {(event: Event) => Event | void} [event] Hook invoked before any Preact event listeners. The return value (if any) replaces the native browser event given to event listeners
 */
const options = {};

export default options;
