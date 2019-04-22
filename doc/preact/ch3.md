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

`let c = dom && dom._component` 首先从这个原真实 dom 的缓存中获取原组件信息。

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
