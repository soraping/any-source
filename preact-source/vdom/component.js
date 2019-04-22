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

  // 返回组件的真实实例dom
  applyRef(component.__ref, component);
}

/**
 * 渲染组件，及调用生命周期的钩子函数
 * @param {import('../component').Component} component 待渲染的组件
 * @param {number} [renderMode] render mode, see constants.js for available options.
 * @param {boolean} [mountAll] Whether or not to immediately mount all components
 * @param {boolean} [isChild] ?
 * @private
 */
export function renderComponent(component, renderMode, mountAll, isChild) {
  if (component._disable) return;

  // 最新的状态属性
  let props = component.props,
    state = component.state,
    context = component.context,
    // 组件上一个状态组件实例属性
    previousProps = component.prevProps || props,
    previousState = component.prevState || state,
    previousContext = component.prevContext || context,
    // 如果有真实dom存在，则是更新，没有则是第一次渲染
    isUpdate = component.base,
    // 从缓存中取出上一次暄软或者是组件回收之前同类型的组件实例
    nextBase = component.nextBase,
    initialBase = isUpdate || nextBase,
    // 组件实例中的_component属性表示的组件的子组件
    // 仅仅只有当组件返回的是组件时(也就是当前组件为高阶组件)，才会存在
    initialChildComponent = component._component,
    // 变量skip用来标志是否需要跳过更新的过程
    skip = false,
    snapshot = previousContext,
    rendered,
    inst,
    cbase;

  // 生命周期静态属性 getDerivedStateFromProps
  if (component.constructor.getDerivedStateFromProps) {
    state = extend(
      extend({}, state),
      component.constructor.getDerivedStateFromProps(props, state)
    );
    component.state = state;
  }

  /**
   * 如果 component.base 存在，则isUpdate字段为true，那就说明组件渲染之前是有真实dom的，属性更新操作
   * 首先要将组件中原来的 props，state，context这三个属性都换成 previousProps、previousState、previousContext
   * 为什么要换成之前的状态属性，因为在 shouldComponentUpdate componentWillUpdate 这两个生命周期中，组件的状态还是之前的
   *
   * 如果renderMode不是强制刷新，且component.shouldComponentUpdate函数返回值为false时，
   * 则表示要跳过此次刷新过程，更新标志skip为true
   *
   * 如果component.shouldComponentUpdate不存在获取返回的是ture，则判断执行 component.componentWillUpdate 函数
   *
   * 最后，组件实例的props、state、context替换成最新的状态
   *
   */
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

  // 组件实例中的prevProps、prevState、prevContext的属性全部设置为null
  component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
  // 状态锁 只有_dirty为false才会被放入更新队列，然后_dirty会被置为true，这样组件实例就不会被多次放入更新队列
  component._dirty = false;

  /**
   * 组件更新，首先执行组件实例的render方法，就是react组件类中的render函数
   *
   */
  if (!skip) {
    // 执行render函数的返回值rendered则是组件实例对应的虚拟dom元素(VNode)
    rendered = component.render(props, state, context);

    /**
     * 存在 component.getChildContext 函数
     * 执行 component.getChildContext 函数，返回子组件的context
     * 子组件的 context 属性会覆盖父组件的context属性
     */
    if (component.getChildContext) {
      context = extend(extend({}, context), component.getChildContext());
    }

    /**
     * 在组件更新获取当前组件实例更新前，获取dom更新前的状态
     */
    if (isUpdate && component.getSnapshotBeforeUpdate) {
      snapshot = component.getSnapshotBeforeUpdate(
        previousProps,
        previousState
      );
    }

    // childComponent 返回虚拟dom的类型，没错，后面又要判断这个类型了
    let childComponent = rendered && rendered.nodeName,
      toUnmount,
      base;

    /**
     * 如果这个组件的类型是一个function，则说明是高阶组件
     */
    if (typeof childComponent === "function") {
      // 获取虚拟dom的属性以及默认属性
      let childProps = getNodeProps(rendered);
      // 初始化子组件值 component._component 存在
      inst = initialChildComponent;

      /**
       * 子组件值存在，且子组件的构造函数指向了 rendered && rendered.nodeName 的高阶函数
       * 并且key值也是相同的
       */
      if (
        inst &&
        inst.constructor === childComponent &&
        childProps.key == inst.__key
      ) {
        // 同步的方式递归更新子组件的状态属性
        setComponentProps(inst, childProps, SYNC_RENDER, context, false);
      } else {
        toUnmount = inst;
        // 创建子组件实例
        component._component = inst = createComponent(
          childComponent,
          childProps,
          context
        );
        // 子组件之前渲染的实例
        inst.nextBase = inst.nextBase || nextBase;
        // 子组件所对应的父组件
        inst._parentComponent = component;
        // 不渲染，只为设置实例的属性
        setComponentProps(inst, childProps, NO_RENDER, context, false);
        // 递归调用，同步 render
        renderComponent(inst, SYNC_RENDER, mountAll, true);
      }
      // 组件的所对应的真实dom
      base = inst.base;
    } else {
      // nodename 不是 function类型
      // initialBase来自于initialBase = isUpdate || nextBase
      // initialBase等于isUpdate
      // nextBase = component.nextBase
      // 即，cbase 就是上次组件渲染的内容
      // 如果组件实例存在缓存 nextBase
      cbase = initialBase;

      // component._component，缓存中子组件，用来存储之后需要卸载的组件
      toUnmount = initialChildComponent;
      if (toUnmount) {
        // cbase对应的是之前的组件的dom节点
        // component._component = null的目的就是切断之前组件间的父子关系
        cbase = component._component = null;
      }

      /**
       * initialBase 存在且 renderMode 方式为同步渲染
       */
      if (initialBase || renderMode === SYNC_RENDER) {
        if (cbase) cbase._component = null;
        /**
         * 调用diff方法，第一个参数，之前渲染的真实dom
         * rendered 就是 需要渲染的虚拟dom
         * context 上下文属性
         * mountAll || !isUpdate 是否更新
         * 缓存中nextBase 上次渲染的dom节点的父节点
         * componentRoot 为true表示的是当前diff是以组件中render函数的渲染内容的形式调用，也可以说当前的渲染内容是属于组件类型的
         *
         * 返回diff本次渲染后的真实dom节点
         */
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

    /**
     * 之前存在的nextBase，渲染之前dom存在，且渲染后的dom与它不同，且子组件也不同
     */
    if (initialBase && base !== initialBase && inst !== initialChildComponent) {
      // 父节点
      let baseParent = initialBase.parentNode;
      // 父节点存在且新渲染的dom和这个父节点不同
      if (baseParent && base !== baseParent) {
        // 父级的DOM元素中将之前的DOM节点替换成当前对应渲染的DOM节点
        baseParent.replaceChild(base, initialBase);
        // 子组件不存在
        if (!toUnmount) {
          // 缓存中子组件字段设置为null
          initialBase._component = null;
          // 回收组件
          recollectNodeTree(initialBase, false);
        }
      }
    }

    if (toUnmount) {
      // 卸载组件
      unmountComponent(toUnmount);
    }

    // base属性指向新渲染的dom
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
    // 生命周期 component.componentDidUpdate 函数调用
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
  // 变量c就是原真实dom由哪个组件渲染的，就是原组件的缓存（组件过大会不会造成内存溢出呢）
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
