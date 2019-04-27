### component 组件

在 `diff` 代码中有一段：

```js
/**
 * 当 vnodeName 是 function 类型
 */
let vnodeName = vnode.nodeName;
if (typeof vnodeName === "function") {
  return buildComponentFromVNode(dom, vnode, context, mountAll);
}
```

什么情况下才会触发这个分支呢？

```jsx
// PFC
const HelloDOM = (
  <div id="foo" name="bar">
    hello react
  </div>
);

const PageDOM = (
  <div>
    <h1>preact源码</h1>
    <HelloDOM />
    <span di="footer">前端进行时</span>
  </div>
);
```

babel 转义后：

```js
const HelloDOM = Preact.h(
  "div",
  {
    id: "foo",
    name: "bar"
  },
  "hello react"
);

// 页面
const PageDOM = h(
  "div",
  null,
  h("h1", null, "preact源码"),
  h(HelloDOM, null),
  h("span", { id: "footer" }, "前端进行时")
);
```

可以看下 `babel` 转义后的代码，`HelloDOM` ，直接被当作参数传入到 `h` 函数中，对应的虚拟 dom 就是：

```js
{
  nodeName: 'div',
  children:
   [{
       nodeName: 'h1',
       children: ['preact源码'],
       attributes: undefined,
       key: undefined },
    {
       nodeName: HelloDOM,
       children: [],
       attributes: undefined,
       key: undefined },
    {
       nodeName: 'span',
       children: ['前端进行时'],
       attributes: { id: "footer" },
       key: undefined } ],
  attributes: undefined,
  key: undefined
}
```

看下虚拟 dom 的结构，其中，`nodeName === HelloDOM` 时，那它的类型就是一个 `function`，那我们就来看下这个 `buildComponentFromVNode` 方法的具体实现吧！

### `buildComponentFromVNode`

```js
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
```

`buildComponentFromVNode` 这个方法的实际含义就是将一个虚拟 dom 创建成一个真实的 `dom`，上面代码的注释已经很清楚了，流程下来就能理清楚这个方法的意思。

`let c = dom && dom._component` 首先从这个原真实 dom 的缓存中获取原组件实例信息。
`isDirectOwner = c && dom._componentConstructor === vnode.nodeName` ，这个变量判断原 dom 节点对应的组件类型与虚拟 dom 的元素类型是否相同。

接着是一段循环：

```js
while (c && !isOwner && (c = c._parentComponent)) {
  isOwner = c.constructor === vnode.nodeName;
}
```

如果原组件存在，`isOwner` 和现在的虚拟 dom 的 `nodeName` 不一致，则获取这个原组件的缓存上的 `_parentComponent` 属性，这是缓存的父组件数据。循环体是对 `isOwner` 重新赋值，依据是 原组件的父组件的构造器指向 `vnode.nodeName` 一致时，`isOwner` 就为 `ture`，跳出循环，可以看出，这是一个寻找 `vnode.nodeName` 实例的故事。

理解这个循环之前，要注意注意 `typeof vnode.nodeName === 'function'`,那么 `vnode.nodeName` 即是一个 `function` ,也是一个 `HOC` :

```js
HOC => component => DOM;
```

`HOC` 返回一个组件 `component` ，然后 在通过 `component` 渲染成真实 `dom`，`dom._component` 指向的是渲染该 dom 的原组件实例，如果，这个组件的实例的构造器指向 `vnode.nodeName` ，那说明原 `dom` 节点的类型与虚拟 dom 是一致的，如果没有指向的情况：

```js
dom._component.constructor === vnode.nodeName;
```

上面的方程不成立时，那就有出现了这个循环的必要了，在这个原组件属性 `_parentComponent` 上，寻找 `vnode.nodeName` 的实例。

`vnode.nodeName` 实例是否存在的条件分支：

```js
if (c && isOwner && (!mountAll || c._component)) {
    setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
    dom = c.base;
}else{
    ...
}
```

- `vnode.nodeName` 实例存在

那就直接给这个实例添加 `props` 属性，调用 `setComponentProps` 方法，最后生成的这个 dom 就是这个实例 `c` 上缓存的属性 `base` 值。这是原 dom 的类型和虚拟 dom 的类型没有变化的情况。

- `vnode.nodeName` 实例不存在，说明修改过或者不存在

```js
if (originalComponent && !isDirectOwner) {
  unmountComponent(originalComponent);
  dom = oldDom = null;
}
```

如果原 dom 实例对象存在且组件实例的类型与虚拟 dom 不一致，则调用 `unmountComponent` 移除旧的 dom 并回收这个组件。

```js
c = createComponent(vnode.nodeName, props, context);
```

创建了一个新的组件实例，如果旧 dom 存在，则赋值 `c.nextBase = dom` ，这个属性就是为了能基于此 DOM 元素进行渲染，从缓存中读取。

```js
setComponentProps(c, props, SYNC_RENDER, context, mountAll);
```

为之前生成的组件实例添加属性，并执行 `renderComponent` 方法渲染组件。

`dom = c.base` 给 dom 赋值，组件实例 `c` 的属性 `base` 值，这个值会在 `renderComponent` 方法里设置，后面会讲，这个属性值就是为了缓存这个组件的真实 dom。

### `createComponent`

```js
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
      // nextBase 属性记录的是该组件渲染之前的真实dom
      inst.nextBase = recyclerComponents[i].nextBase;
      // 在组件回收站中删除这个组件
      recyclerComponents.splice(i, 1);
      return inst;
    }
  }
  // 返回这个组件实例
  return inst;
}
```

这个`createComponent` 方法接收三个参数：

- Ctor `vnode.nodeName`，是一个函数（PFC 无状态组件）或者类
- props 组件的属性
- context 组件的上下文环境

```js
if (Ctor.prototype && Ctor.prototype.render) {
    ...
}else{
    ...
}
```

什么情况下 `Ctor` 的原型上存在 `render` 方法呢？

```jsx
class App extends Preact.Component {
  constructor(props, context) {
    super(props, context);
  }
  render() {
    return <div>render</div>;
  }
}
```

如上，继承 `Preact.Component` 这个父类，那这个 app 类的实例就存在了 `render` 方法。

```js
inst = new Ctor(props, context);
Component.call(inst, props, context);
```

定义 `inst` 为 `Ctor` 组件实例，传入参数`props`,`context`， `inst` 实例对象是存在 `render` 方法的，但是不一定存在 `props`和`context`的属性， 如果没有给父级构造函数 super 传入`props`和`context`，那么 inst 中的`props`和`context`的属性为 undefined，通过强制调用 `Component.call(inst, props, context)`可以给`inst`中`props`、`context`进行初始化赋值。

如果 `Ctor` 不存在 `render` 方法，那就要给他添加 `render` 方法，怎么处理呢？

首先初始化一个空组件实例对象 `inst = new Component(props, context)`，这个实例对象虽然有 `render` 方法，但是和我们传入的无状态组件没有任何联系，处理方法是执行这个语句： `inst.constructor = Ctor`。如果没有这句话，那 `inst.constructor` 指向的是 `Component` 这个类，对它重新赋值，就是改变了这个实例对象 `inst` 构造器的值指向了无状态组件 `Ctor` ，即，一个高阶函数。
最后重新实现 `render` 方法：

```js
inst.render = function(props, state, context) {
  return this.constructor(props, context);
};
```

这个 `this` 指向实例对象 `inst` ，执行 `this.constructor` 方法，其实就是执行 `Ctor` 这个函数方法，这个方法传入两个参数 `props`和`context`， 这个方法返回的就是一个虚拟 dom，到此为止，也解释了无状态组件如何生成组件实例，也同时拥有`render`方法。

组件实例 `inst` 已经生成了，接着从组件回收池 `recyclerComponents` 中是否存在这个组件实例：

```js
if (recyclerComponents[i].constructor === Ctor) {
  // ...
}
```

`recyclerComponents` 这个队列中存放的都是一些回收的组件实例，其实就是上面生成的 `inst`。上面的 `if` 语句就是判断回收池中有没有组件 `Ctor` 的实例。
如果存在这样的实例：

```js
inst.nextBase = recyclerComponents[i].nextBase;
recyclerComponents.splice(i, 1);
return inst;
```

给组件实例对象 `inst` 的 `nextBase`（nextBase 属性记录的是该组件之前渲染的真实 dom）属性赋值，从回收池中的实例对象中取，然后移除回收池中的元素。

### setComponentProps

生成了组件实例之后，就考虑给这个实例添加传入的 `props` 属性了。

```js
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
```

`setComponentProps` 方法接收 5 个参数：

- component 目标组件实例，就是上面说的 `inst` 对象；
- props 需要添加的属性;
- renderMode render 模式 同步还是异步;
- context 上下文环境；
- mountAll 组件相关

`component._disable` 属性是判断组件是否可用，状态锁，在设置组件属性之前，设置为不可用，组件设置之后，再将这个状态锁设置为可用。执行生命周期 `componentWillMount` 这个钩子函数。

```js
// context比对
if (context && context !== component.context) {
  if (!component.prevContext) component.prevContext = component.context;
  component.context = context;
}

// 属性比对
if (!component.prevProps) component.prevProps = component.props;
component.props = props;
```

每个组件实例都有四个状态属性：

- prevContext：前一个 `context` 属性状态
- context：传入的新 `context` 属性状态
- prevProps：前一个 `props` 属性状态
- props：传入的新 `props` 属性状态

判断每个组件是否有前一个属性状态字段，有则更新为新的对应的属性值，没有则追加字段，设置的值就是传入的属性值。

属性值已经更新完毕了，接下来就是将这个组件渲染出来了：

```js
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
```

渲染模式 `renderMode` 有四种：`NO_RENDER`（不渲染），`SYNC_RENDER`（同步渲染），`ASYNC_RENDER`（异步渲染），`FORCE_RENDER`（强制渲染）。

上面代码中判断了 `renderMode` 是否是 `SYNC_RENDER` ，如果是同步渲染，则直接调用了 `renderComponent` 方法，如果是异步渲染，则会调用 `enqueueRender` 这个方法。

首先来看下 `enqueueRender` 是如何实现异步渲染的：

```js
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
```

异步渲染其实就是延时渲染，在代码内部，做了一个缓冲区 `items` ，它是一个数组，其中就是一个个待渲染的组件队列。只要调用了 `enqueueRender` 这个方法的组件实例，都会将这个组件实例 `push` 到这个队列中进行排队，然后逐一取出，依次调用 `renderComponent` 方法。

**在将组件 `push` 到队列之前，系统做了依次判断，就是判断 `component._dirty` 这个组件实例对象属性 `_dirty` 是否为 `false` ，不成立则立即将这个属性赋值为 `true`，这样做就是为了防止一个组件多次 `render` 而设置的一把锁，这种写法还是非常值得学习的。**

### renderComponent

### unmountComponent

```js
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
    // nextBase 属性记录的是该组件之前渲染的真实dom
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
```

移除并回收组件，`preact` 之所以快速，就是因为大量使用了缓存空间，这个方法就缓存了移除组件的实例对象，这是一个双刃剑，如果组件特别多特别大的情况下，内存消耗将是一个很大的问题。

在上文 `createComponent` 方法中就使用了 `recyclerComponents` 这个数组内容，它缓存了销毁的组件实例，那为什么要缓存它呢，因为在这个组件实例对象上，追加了很多缓存属性：

- component.base 组件渲染前的真实 dom
- component.nextBase 如果存在真实 dom，则缓存这个 dom

```jsx
class App extends Component {
  render() {
    return <Child />;
  }
}
```

这个组件在 preact 中会有被处理为以下的数据结构：

```js
// App组件的实例
{
    base,       // 对应组件渲染的dom
    _component  // 指向Child组件
}

// Child组件实例
{
    base,              // 与App组件实例指向同一个dom
    _parentComponent   // 指向App组件
}

// 对应的dom节点，即前文中的base对象
{
    _component，    // 指向App组件，而不是Child组件
    _componentConstructor   // dom的元素名
}

```
