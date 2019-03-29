### babel 解析 jsx

写 `react` 的文件名是以 `jsx` 为后缀，通过 `babel` 解析后可以拥有 `preact` 的 api 执行生成虚拟 dom，下面看下流程代码：

```JSX
// jsx
const HelloDOM = (<div id="foo" name="bar">hello react</div>)
```

`babel` 转义后:

```js
// react
const HelloDOM = React.createElement(
  "div",
  {
    id: "foo",
    name: "bar"
  },
  "hello react"
);

// preact
const HelloDOM = preact.h(
  "div",
  {
    id: "foo",
    name: "bar"
  },
  "hello react"
);
```

多组件嵌套的情况：

```jsx
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
// 嵌套组件转义后
const PageDOM = h(
  "div",
  null,
  h("h1", null, "preact源码"),
  h(HelloJSX, null),
  h("span", { id: "footer" }, "前端进行时")
);
```

`preact` 中的 `h` 和 `react` 的 `createElement` 是对等的，都是生成虚拟 dom 的方法。

### h()/createElement() 方法生成 virtual DOM （vnode）

```js
/**
 * vnode.js
 * Virtual DOM Node
 * 虚拟 dom 的结构，通过h /（createElement()）方法会返回这个类的实例
 * {
        nodeName:"div",//标签名或者函数（自定义组件）
        children:[],   //子组件组成的数组，每一项也是一个vnode
        key:"",        //key
        attributes:{}  //jsx的属性
    }
 */
export const VNode = function VNode() {};
```

这个文件定义了一个 `VNode` 类，所谓的虚拟 dom，都是它的实例，h 函数的返回值就是这个类的实例。

下面看下 h 函数的源码：

```js
import { VNode } from "./vnode";
import options from "./options";

// 将从第3位起的参数收集起来(其实就是一堆 h 方法的执行函数)
const stack = [];

// 定义一个初始子组件空数组
const EMPTY_CHILDREN = [];

/**
 * 虚拟dom生成方法
 * `<div id="foo" name="bar">Hello!</div>`
 * `h('div', { id: 'foo', name : 'bar' }, 'Hello!');`
 *
 * @param {*} nodeName       元素标签名 例如: `div`, `a`, `span`, etc.
 * @param {*} attributes     jsx上面的属性
 * @param {*} [rest]         剩下的参数都是子组件
 * @return    VNode实例
 */
export function h(nodeName, attributes) {
  let children = EMPTY_CHILDREN,
    lastSimple,
    child,
    simple,
    i;
  // 遍历h函数的参数，从第三个参数开始就是子组件
  for (i = arguments.length; i-- > 2; ) {
    // 将从第3位起的参数收集起来(其实就是一堆 h方法的执行函数)
    stack.push(arguments[i]);
  }
  // jsx属性存在
  if (attributes && attributes.children != null) {
    // 挂载了children属性，也把这个children属性值压在stack数组内，之后再删除这个children属性
    if (!stack.length) stack.push(attributes.children);
    delete attributes.children;
  }
  // 遍历子组件
  while (stack.length) {
    // 取出子组件数组中最后一个元素，且处理子组件如果返回的是数组的情况
    if ((child = stack.pop()) && child.pop !== undefined) {
      for (i = child.length; i--; ) stack.push(child[i]);
    } else {
      /**
       * h函数会根据子组件的不同类型进行封装
       * - bool 返回 null
       * - null 返回 ""
       * - number 返回 String(number)
       * child 就是 h 函数从第3个起的参数
       */
      if (typeof child === "boolean") child = null;

      // 如果 nodeName 是一个简单元素标签，不是一个嵌套组件的 h 函数
      if ((simple = typeof nodeName !== "function")) {
        if (child == null) child = "";
        else if (typeof child === "number") child = String(child);
        // 如果这个 参数 不是一个简单类型的，设置标志位值
        else if (typeof child !== "string") simple = false;
      }

      // 将各种情况的child存进children中
      if (simple && lastSimple) {
        children[children.length - 1] += child;
      } else if (children === EMPTY_CHILDREN) {
        children = [child];
      } else {
        children.push(child);
      }

      lastSimple = simple;
    }
  }

  /**
   * 输出虚拟dom，VNode实例对象
   */
  let p = new VNode();
  // 标签或者 h 执行函数
  p.nodeName = nodeName;
  // 子组件组成的数组，每一项也是一个vnode
  p.children = children;
  // jsx 属性
  p.attributes = attributes == null ? undefined : attributes;
  // 组件唯一key
  p.key = attributes == null ? undefined : attributes.key;

  // 对最终生成的虚拟DOM进行扩展，如果扩展 options 对象 vnode 值不为 undefined，options的vnode方法会处理这个实例对象
  if (options.vnode !== undefined) options.vnode(p);

  return p;
}
```
