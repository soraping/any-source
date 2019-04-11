import {
  SYNC_RENDER,
  NO_RENDER,
  FORCE_RENDER,
  ASYNC_RENDER,
  ATTR_KEY
} from "../constants";
import options from "../options";
import { extend, applyRef } from "../util";
import { enqueueRender } from "../render-queue";
import { getNodeProps } from "./index";
import {
  diff,
  mounts,
  diffLevel,
  flushMounts,
  recollectNodeTree,
  removeChildren
} from "./diff";
import { createComponent, recyclerComponents } from "./component-recycler";
import { removeNode } from "../dom/index";

/**
 * 为组件实例对象添加 props 属性
 * @param {import('../component').Component} component 目标组件
 * @param {object} props 新的组件
 * @param {number} renderMode Render options - specifies how to re-render the component
 * @param {object} context The new context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 */
export function setComponentProps(
  component,
  props,
  renderMode,
  context,
  mountAll
) {
  // 首先判断组件状态是否可用
  if (component._disable) return;
  // 状态锁，先把组件设置为不可用，等待更新完后再设置为可用
  component._disable = true;
  // ref 属性
  component.__ref = props.ref;
  // 组件唯一键值
  component.__key = props.key;
  // 移除这两个属性
  delete props.ref;
  delete props.key;

  // getDerivedStateFromProps 静态方法
  if (typeof component.constructor.getDerivedStateFromProps === "undefined") {
    if (!component.base || mountAll) {
      if (component.componentWillMount) component.componentWillMount();
    } else if (component.componentWillReceiveProps) {
      component.componentWillReceiveProps(props, context);
    }
  }

  // context比对
  if (context && context !== component.context) {
    if (!component.prevContext) component.prevContext = component.context;
    component.context = context;
  }

  // 属性比对
  if (!component.prevProps) component.prevProps = component.props;
  component.props = props;
  // 设置为可用
  component._disable = false;

  // render 模式
  if (renderMode !== NO_RENDER) {
    if (
      renderMode === SYNC_RENDER ||
      options.syncComponentUpdates !== false ||
      !component.base
    ) {
      renderComponent(component, SYNC_RENDER, mountAll);
    } else {
      enqueueRender(component);
    }
  }

  applyRef(component.__ref, component);
}

/**
 * 渲染组件，及调用生命周期的钩子函数
 * High-Order Components into account.
 * @param {import('../component').Component} component The component to render
 * @param {number} [renderMode] render mode, see constants.js for available options.
 * @param {boolean} [mountAll] Whether or not to immediately mount all components
 * @param {boolean} [isChild] ?
 * @private
 */
export function renderComponent(component, renderMode, mountAll, isChild) {
  if (component._disable) return;

  let props = component.props,
    state = component.state,
    context = component.context,
    previousProps = component.prevProps || props,
    previousState = component.prevState || state,
    previousContext = component.prevContext || context,
    isUpdate = component.base,
    nextBase = component.nextBase,
    initialBase = isUpdate || nextBase,
    initialChildComponent = component._component,
    skip = false,
    snapshot = previousContext,
    rendered,
    inst,
    cbase;

  if (component.constructor.getDerivedStateFromProps) {
    state = extend(
      extend({}, state),
      component.constructor.getDerivedStateFromProps(props, state)
    );
    component.state = state;
  }

  // if updating
  if (isUpdate) {
    component.props = previousProps;
    component.state = previousState;
    component.context = previousContext;
    if (
      renderMode !== FORCE_RENDER &&
      component.shouldComponentUpdate &&
      component.shouldComponentUpdate(props, state, context) === false
    ) {
      skip = true;
    } else if (component.componentWillUpdate) {
      component.componentWillUpdate(props, state, context);
    }
    component.props = props;
    component.state = state;
    component.context = context;
  }

  component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
  component._dirty = false;

  if (!skip) {
    rendered = component.render(props, state, context);

    // context to pass to the child, can be updated via (grand-)parent component
    if (component.getChildContext) {
      context = extend(extend({}, context), component.getChildContext());
    }

    if (isUpdate && component.getSnapshotBeforeUpdate) {
      snapshot = component.getSnapshotBeforeUpdate(
        previousProps,
        previousState
      );
    }

    let childComponent = rendered && rendered.nodeName,
      toUnmount,
      base;

    if (typeof childComponent === "function") {
      // set up high order component link

      let childProps = getNodeProps(rendered);
      inst = initialChildComponent;

      if (
        inst &&
        inst.constructor === childComponent &&
        childProps.key == inst.__key
      ) {
        setComponentProps(inst, childProps, SYNC_RENDER, context, false);
      } else {
        toUnmount = inst;

        component._component = inst = createComponent(
          childComponent,
          childProps,
          context
        );
        inst.nextBase = inst.nextBase || nextBase;
        inst._parentComponent = component;
        setComponentProps(inst, childProps, NO_RENDER, context, false);
        renderComponent(inst, SYNC_RENDER, mountAll, true);
      }

      base = inst.base;
    } else {
      cbase = initialBase;

      // destroy high order component link
      toUnmount = initialChildComponent;
      if (toUnmount) {
        cbase = component._component = null;
      }

      if (initialBase || renderMode === SYNC_RENDER) {
        if (cbase) cbase._component = null;
        base = diff(
          cbase,
          rendered,
          context,
          mountAll || !isUpdate,
          initialBase && initialBase.parentNode,
          true
        );
      }
    }

    if (initialBase && base !== initialBase && inst !== initialChildComponent) {
      let baseParent = initialBase.parentNode;
      if (baseParent && base !== baseParent) {
        baseParent.replaceChild(base, initialBase);

        if (!toUnmount) {
          initialBase._component = null;
          recollectNodeTree(initialBase, false);
        }
      }
    }

    if (toUnmount) {
      unmountComponent(toUnmount);
    }

    component.base = base;
    if (base && !isChild) {
      let componentRef = component,
        t = component;
      while ((t = t._parentComponent)) {
        (componentRef = t).base = base;
      }
      base._component = componentRef;
      base._componentConstructor = componentRef.constructor;
    }
  }

  if (!isUpdate || mountAll) {
    mounts.push(component);
  } else if (!skip) {
    // Ensure that pending componentDidMount() hooks of child components
    // are called before the componentDidUpdate() hook in the parent.
    // Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
    // flushMounts();

    if (component.componentDidUpdate) {
      component.componentDidUpdate(previousProps, previousState, snapshot);
    }
    if (options.afterUpdate) options.afterUpdate(component);
  }

  while (component._renderCallbacks.length)
    component._renderCallbacks.pop().call(component);

  if (!diffLevel && !isChild) flushMounts();
}

/**
 *
 * @param {*} dom		旧真实dom
 * @param {*} vnode 	虚拟dom
 * @param {*} context	上下文
 * @param {*} mountAll
 */
export function buildComponentFromVNode(dom, vnode, context, mountAll) {
  // 取得附上真实DOM上的组件实例，注意：dom._component 属性缓存的是这个真实dom是由哪个虚拟dom渲染的。
  // 变量c就是原真实dom由哪个虚拟dom渲染的
  let c = dom && dom._component,
    originalComponent = c,
    oldDom = dom,
    // 判断原dom节点对应的组件类型与虚拟dom的元素类型是否相同
    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
    isOwner = isDirectOwner,
    // 获取虚拟dom节点的属性值
    props = getNodeProps(vnode);

  /**
   * while 循环 c 这个组件，首先将c上的	_parentComponent 属性赋值给c，条件不达，就再次赋值，一直往上找
   * _parentComponent属性缓存的就是该组件父类组件实例
   * {
   * 	_parentComponent: {
   * 		_parentComponent: {
   * 			_parentComponent: {
   * 				_parentComponent: {}
   * 			}
   * 		}
   * 	}
   * }
   */
  while (c && !isOwner && (c = c._parentComponent)) {
    // 如果组件类型变了，一直向上遍历；看类型是否相同，直到找到与之同类型的组件实例，让isOwner为true为止
    isOwner = c.constructor === vnode.nodeName;
  }

  if (c && isOwner && (!mountAll || c._component)) {
    setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
    dom = c.base;
  } else {
    // 当虚拟dom和原dom节点的元素类型不一致
    if (originalComponent && !isDirectOwner) {
      // 移除旧的dom元素
      unmountComponent(originalComponent);
      dom = oldDom = null;
    }
    /**
	 * 创建新的组件实例（typeof vnode.nodeName === function）
	 * 这个组件实例结构：
	 * {
	 * 		_dirty: true,
			context: {},
			props: {},
			state: {},
			_renderCallbacks: [],
			constructor: [Function: Ctor],
			render: [Function: doRender] }
			nextBase?: dom
	 * }
	 */
    c = createComponent(vnode.nodeName, props, context);
    if (dom && !c.nextBase) {
      // 对这个实例对象的 nextBase 重新赋值，将原dom赋值给这个属性
      // 这个属性就是为了能基于此DOM元素进行渲染，从缓存中读取
      c.nextBase = dom;
      // passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
      // 将 oldDom 销毁
      oldDom = null;
    }
    // 为这个刚生成的组件实例对象 c 添加 props 属性
    setComponentProps(c, props, SYNC_RENDER, context, mountAll);
    // 将这个组件实例对象的缓存 base 替换 dom 这个值
    dom = c.base;

    // 如果oldDom 和 dom 不是同一个，则对 oldDom 进行销毁和回收
    if (oldDom && dom !== oldDom) {
      oldDom._component = null;
      recollectNodeTree(oldDom, false);
    }
  }

  return dom;
}

/**
 * 移除这个组件并回收它
 * @param {import('../component').Component} component 组件
 * @private
 */
export function unmountComponent(component) {
  if (options.beforeUnmount) options.beforeUnmount(component);
  // 回溯这个组件渲染的实例dom
  let base = component.base;
  // 这个新增字段标示组件已经被禁用了
  component._disable = true;
  // 调用组件销毁钩子函数
  if (component.componentWillUnmount) component.componentWillUnmount();
  // 将缓存中的实例删除
  component.base = null;
  // 回溯组件的子组件
  let inner = component._component;
  // 存在则销毁
  if (inner) {
    // 递归销毁
    unmountComponent(inner);
  } else if (base) {
    // 如果base节点是preact创建，则调用ref函数，卸载传入null字段
    if (base[ATTR_KEY] != null) applyRef(base[ATTR_KEY].ref, null);
    // 将base节点缓存在nextBase属性中
    component.nextBase = base;
    // 将base节点从父节点中删除
    removeNode(base);
    // 保存这个组件，以后会用到的
    recyclerComponents.push(component);
    // 卸载base节点所有的子元素
    removeChildren(base);
  }
  // 组件__ref属性函数调用null
  applyRef(component.__ref, null);
}
