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

#### `buildComponentFromVNode`

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

#### `createComponent`

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
