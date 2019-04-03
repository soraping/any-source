> `h` 函数为我们创建了 `vnode` ，那么，`render` 函数就是将这个 `vnode` 输出成真实的 `dom`

```js
// render.js

import { diff } from "./vdom/diff";

/**
 * Render JSX into a `parent` Element.
 * @param {import('./vnode').VNode} vnode          h 函数生成的虚拟dom
 * @param {import('./dom').PreactElement} parent   该虚拟 dom 生成的真实 dom 将要挂载的父节点
 * @param {import('./dom').PreactElement} [merge]  待更新的真实dom，首次渲染则为null
 */
export function render(vnode, parent, merge) {
  return diff(merge, vnode, {}, false, parent, false);
}
```

这个 `render` 方法内部调用了一个 `diff` 方法，没错，就是传说中的 `diff` 算法，真正的核心内容开始了。

首先看下 `diff` 函数的签名:

```js
function diff(dom: Element & ElementCSSInlineStyle & PreactElementExtensions, vnode: () => void, context: any, mountAll: boolean, parent: Element, componentRoot: boolean): Element & ElementCSSInlineStyle & PreactElementExtensions
```

- `dom: Element & ElementCSSInlineStyle & PreactElementExtensions`

这个参数我理解的就是 `diff` 方法待渲染的虚拟 dom 所对应的未更新的真实 dom，所谓更新，就是当某个组件中有个数值有更新了，触发 `render` 函数，将包含新数值的虚拟 dom 更新到页面上，替换已经存在的旧 dom。这个参数就是已经存在页面上的旧 dom。
它会有两种状态，一个是虚拟 dom 首次渲染，那这个参数就是 `null`，

这里的 dom 其实就是当前的 vnode 所对应的之前未更新的真实 dom。那么就有两种可能: 第一就是 null 或者是上面例子的 contaienr(就是 render 函数对应的第三个参数)，其本质都是首次渲染，第二种就是 vnode 的对应的未更新的真实 dom，那么对应的就是渲染刷新界面。

- `vnode: () => void`

需要渲染的虚拟 dom

- `context: any`

当前上下文对象

- `mountAll: boolean`

- `parent: Element`

该虚拟 dom 生成的真实 dom 将要挂载的父节点

- `componentRoot: boolean`

```js
// diff.js

/**
 * 将虚拟dom创建或者更新真实dom，渲染至页面
 * @param {import('../dom').PreactElement} dom 待更新的旧真实dom，首次渲染则为null
 * @param {import('../vnode').VNode} vnode 目标虚拟dom
 * @param {object} context 上下文属性
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {Element} parent 虚拟 dom 挂载的父级节点
 * @param {boolean} componentRoot ?
 * @returns {import('../dom').PreactElement} 返回真实 dom
 * @private
 */
export function diff(dom, vnode, context, mountAll, parent, componentRoot) {
  // diffLevel为 0 时表示第一次进入diff函数
  if (!diffLevel++) {
    // 第一次 diff 会判定当前的DOM树是否为SVG
    isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

    // 首次渲染设置标志位
    hydrating = dom != null && !(ATTR_KEY in dom);
  }

  // 更新 真实dom 或返回新的 真实dom
  let ret = idiff(dom, vnode, context, mountAll, componentRoot);

  // 将渲染的真实 dom 挂载到父类节点上
  if (parent && ret.parentNode !== parent) parent.appendChild(ret);

  // diffLevel回减到0说明已经要结束diff的调用 ，当diff结束了之后，触发钩子函数
  if (!--diffLevel) {
    // diff 结束，将标志位设置为false
    hydrating = false;
    // 触发 componentDidMount
    if (!componentRoot) flushMounts();
  }

  return ret;
}
```

从源码中可以看到，在`diff`方法中有一个`idff`的方法，这个方法就是根据虚拟 dom，返回真实 dom：

```JS
function idiff(dom: Element & ElementCSSInlineStyle & PreactElementExtensions, vnode: () => void, context: any, mountAll: boolean, componentRoot?: boolean): Element & ElementCSSInlineStyle & PreactElementExtensions
```

`idiff` 方法的参数基本上和 `diff` 方法一致，它是 `diff` 的内部实现，代码略长，可以分为一下部分逐一阅读：

- vnode 为 null 或者 boolean

```js
// 虚拟dom为null和boolean，就赋值空字符
if (vnode == null || typeof vnode === "boolean") vnode = "";
```

- vnode 为字符类型

```js
if (typeof vnode === "string" || typeof vnode === "number") {
  /**
   * 当原始 dom 存在，且是一个文本类型，存在splitText方法属性，且拥有父类节点(文本类型的节点)
   * <p>hello</p>
   * 这个dom中，文本类型的值就是 hello ，而它的父类节点是 p 标签
   */
  if (
    dom &&
    dom.splitText !== undefined &&
    dom.parentNode &&
    (!dom._component || componentRoot)
  ) {
    // 这是文本类型的比对，如果不同，则将新的文本值，覆盖到原始dom上
    if (dom.nodeValue != vnode) {
      dom.nodeValue = vnode;
    }
  } else {
    // 不是文本节点或旧dom不存在，替换之前的节点，回收之前的节点
    out = document.createTextNode(vnode);
    if (dom) {
      // 原始 dom 存在，且存在父节点，则基于父节点，
      if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
      recollectNodeTree(dom, true);
    }
  }
  // preact 创建的dom，都会有这个属性
  out[ATTR_KEY] = true;

  // 输出文本类型的dom
  return out;
}
```

字符类型的处理比较简单，主要判断是否是文本类型，首先看下 h 函数的参数及所创建的虚拟 dom：

```js
// h函数
h('div', {id: 'div1'}, '文本类型值')

// 虚拟dom
{
    "nodeName": "div",
    "children": ["文本类型值"],
    "key": "",
    "attributes": {
        "id": "div1"
    }
}
```

**要说明一下，`idiff`，是一个递归的调用，就是通过遍历 children 来递归处理子元素，这些子元素也是一个个虚拟`dom`，即使这个子元素仅仅是一个字符串，它也是一个虚拟 dom（vnode）。**

那么，当 `vnode = '文本类型值'` 时，那么就是进入到了条件语句中处理，第一次渲染时，原 dom 不存在，那么就直接创建新节点：

```js
document.createTextNode(vnode);
```

如果原 dom 存在时，`dom.splitText !== undefined && dom.parentNode` ，这些字段都会为`true`，将进行文本类型比对：

```js
if (dom.nodeValue != vnode) {
  dom.nodeValue = vnode;
}
```

可以查看 [nodeValue](http://www.w3school.com.cn/jsref/prop_node_nodevalue.asp)，这个属性的含义。

```js
// preact 创建的dom，都会有这个属性
out[ATTR_KEY] = true;
```

- vnode 为 h 函数的子组件

```js
if (typeof vnodeName === "function") {
  // 返回构建的真实dom，在 component 文档中会解读这个方法
  return buildComponentFromVNode(dom, vnode, context, mountAll);
}
```

- vnode 为普通节点类型

```js
vnodeName = String(vnodeName);
// 原 dom 不存在或者 原dom存在但是虚拟dom的元素类型与之不通，则按照虚拟dom重新创建一个
if (!dom || !isNamedNode(dom, vnodeName)) {
  // 创建一个新的dom
  out = createNode(vnodeName, isSvgMode);
  /**
   * 原先dom已经存在于页面上的情况
   * 如果原先的dom节点中存在自元素，则将他们全部移到新元素中
   * 如果原先dom节点存在父类元素，则直接将原来的dom替换成新的元素，挂载在这个父类节点上
   */
  if (dom) {
    // 循环子元素，全部移到这个新元素下
    while (dom.firstChild) out.appendChild(dom.firstChild);
    // 替换旧dom，挂载在这个父类节点上
    if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
    // 递归地回收(或者卸载)节点及其后代节点
    // 在调用之前我们已经将其在父元素中进行替换，所以这里是不需要进行调用的函数removeNode再进行删除该节点的，所以第二个参数是true
    recollectNodeTree(dom, true);
  }
}
```

判断普通节点，如 `div`,`span`等等，首先要比较虚拟 dom 的 `nodeName` 属性值与真实 dom 的元素名是否相等，如果不等，则直接创建一个新的 dom

```js
out = createNode(vnodeName, isSvgMode);
```

创建新 dom 之后，如果原 dom 存在，则会做三个操作：

```js
while (dom.firstChild) out.appendChild(dom.firstChild);
```

循环遍历子元素，将这个子元素全部移到新创建的 dom 下

```js
if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
```

如果原 dom 有挂载的父节点，那就把新创建的 dom 挂载在这个父类节点下，记住，是替换原 dom

```js
recollectNodeTree(dom, true);
```

在调用之前我们已经将其在父元素中进行替换，所以这里是不需要进行调用的函数 removeNode 再进行删除该节点的，所以第二个参数是 true

- 子元素处理

```js
let fc = out.firstChild,
  props = out[ATTR_KEY],
  vchildren = vnode.children;

/**
 * 下面的这个条件语句，一一分解：
 * !hydrating: 是preact创建的
 * vchildren && vchildren.length === 1 虚拟dom中存在children字段，且不止一个
 * typeof vchildren[0] === "string" 第一个子组件类型为字符类型
 * fc != null && fc.splitText !== undefined && fc.nextSibling == null 文本类型，且无其他节点
 */
if (
  !hydrating &&
  vchildren &&
  vchildren.length === 1 &&
  typeof vchildren[0] === "string" &&
  fc != null &&
  fc.splitText !== undefined &&
  fc.nextSibling == null
) {
  // 文本类型值比对时，直接替换
  if (fc.nodeValue != vchildren[0]) {
    fc.nodeValue = vchildren[0];
  }
}
// 子节点存在且不为文本类型时，执行深层diff
else if ((vchildren && vchildren.length) || fc != null) {
  innerDiffNode(
    out,
    vchildren,
    context,
    mountAll,
    hydrating || props.dangerouslySetInnerHTML != null
  );
}
```

首先对虚拟 dom 中，`children` 属性值类型做分支处理：文本类型直接替换，非文本类型就会调用 `innerDiffNode` 方法，递归调用 `idff`

- 元素属性的 diff

```js
// props 处理逻辑
if (props == null) {
  props = out[ATTR_KEY] = {};
  // 将真实dom中的一些属性也追加到props数组中
  for (let a = out.attributes, i = a.length; i--; )
    props[a[i].name] = a[i].value;
}

// 将props和atrributes从VNode中应用到DOM元素
diffAttributes(out, vnode.attributes, props);
```

元素属性的 diff，首先要将虚拟 dom 中的 `attributes` 属性映射到 `props` 对象（旧真实 dom 的属性对象）上，接下来看下 `diffAttributes` 方法：

```js
/**
 * diff VNode和原页面dom之间的属性
 * @param {*} dom 已经通过diff之后的真实dom
 * @param {*} attrs 虚拟dom中的属性值
 * @param {*} old 通过preact创建的真实dom中，属性[ATTR_KEY]中保存的值和真实dom中已有属性值的组合
 */
function diffAttributes(dom, attrs, old) {
  let name;

  // 遍历真实dom中的所有属性，判断该属性是否在虚拟dom中也有，如果没有，则设置其为undefined
  for (name in old) {
    if (!(attrs && attrs[name] != null) && old[name] != null) {
      setAccessor(dom, name, old[name], (old[name] = undefined), isSvgMode);
    }
  }

  // 遍历虚拟dom中的属性
  for (name in attrs) {
    // 1.如果虚拟dom中的某个属性不是children或者innerHTML
    // 2.且该属性不在old dom中，那说明是虚拟dom新增的属性 或者 如果name是value或者checked属性(表单)，
    // 		attrs[name] 与 dom[name] 不同，或者不是value或者checked属性，则和old[name]属性不同，则将dom上的属性更新
    if (
      name !== "children" &&
      name !== "innerHTML" &&
      (!(name in old) ||
        attrs[name] !==
          (name === "value" || name === "checked" ? dom[name] : old[name]))
    ) {
      setAccessor(dom, name, old[name], (old[name] = attrs[name]), isSvgMode);
    }
  }
}
```

`diffAttributes` 方法做了两种遍历，第一块遍历旧的 dom 舒心，为判断原有 dom 中的属性在不在新的虚拟 dom 中，第二个是遍历虚拟 dom 中的属性在不在旧 dom 中，如果不在则说明是新增的属性，具体更新属性操作是 `setAccessor` 方法来处理的

```js
/**
 * dom中的属性更新
 * @param {*} node 目标dom
 * @param {*} name 属性名
 * @param {*} old  旧dom中属性名是name的值
 * @param {*} value 该属性当前要修改的值
 * @param {*} isSvg 是否svg
 */
export function setAccessor(node, name, old, value, isSvg) {
  // 样式
  if (name === "className") name = "class";
  // 忽略key
  if (name === "key") {
    // ignore
  } else if (name === "ref") {
    // 如果是ref 函数被改变了，则执行这两个函数
    // old(null)   在卸载的时候，需要传一个null作为参数作为回调。
    // value(node) 返回新的节点
    applyRef(old, null);
    applyRef(value, node);
  } else if (name === "class" && !isSvg) {
    // 样式，直接用class也是可以的
    node.className = value || "";
  } else if (name === "style") {
    // 一种是style值是字符传类型是，就表明传的是样式名
    if (!value || typeof value === "string" || typeof old === "string") {
      node.style.cssText = value || "";
    }
    // 另一种style为字面量时，则标示传的是样式属性的键值对
    if (value && typeof value === "object") {
      if (typeof old !== "string") {
        // 当就值里的属性不同是，先将样式属性依次值为空
        for (let i in old) if (!(i in value)) node.style[i] = "";
      }
      // 样式属性一一赋值
      for (let i in value) {
        node.style[i] =
          typeof value[i] === "number" && IS_NON_DIMENSIONAL.test(i) === false
            ? value[i] + "px"
            : value[i];
      }
    }
  } else if (name === "dangerouslySetInnerHTML") {
    // dangerouslySetInnerHTML属性设置
    if (value) node.innerHTML = value.__html || "";
    // 事件处理函数 onClick onBlur....
  } else if (name[0] == "o" && name[1] == "n") {
    // 如果事件名是 Capture 结尾，如 onClickCapture
    // useCapture 值为boolean，addEventListener第三个参数为true时，说明在捕获中执行事件
    let useCapture = name !== (name = name.replace(/Capture$/, ""));
    // 去掉头两个'on'字符，获取真实事件名
    name = name.toLowerCase().substring(2);
    // 如果新值存在则做事件监听，不存在，则移除旧dom的事件
    if (value) {
      if (!old) node.addEventListener(name, eventProxy, useCapture);
    } else {
      node.removeEventListener(name, eventProxy, useCapture);
    }
    // 在 eventProxy 会用到
    (node._listeners || (node._listeners = {}))[name] = value;
  } else if (name !== "list" && name !== "type" && !isSvg && name in node) {
    // 给dom自有属性赋值时，在ie或者火狐环境下可能会抛异常
    try {
      node[name] = value == null ? "" : value;
    } catch (e) {}
    if ((value == null || value === false) && name != "spellcheck")
      // 除了属性名为 spellcheck ，如果value值为空值，则直接删除这个属性
      // 属性是一个键值对，除了list,type，spellcheck这些特殊的
      node.removeAttribute(name);
  } else {
    // 最后处理svg
    let ns = isSvg && name !== (name = name.replace(/^xlink:?/, ""));
    // spellcheck is treated differently than all other boolean values and
    // should not be removed when the value is `false`. See:
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-spellcheck
    if (value == null || value === false) {
      if (ns)
        node.removeAttributeNS(
          "http://www.w3.org/1999/xlink",
          name.toLowerCase()
        );
      else node.removeAttribute(name);
    } else if (typeof value !== "function") {
      if (ns)
        node.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          name.toLowerCase(),
          value
        );
      else node.setAttribute(name, value);
    }
  }
}

/**
 * 简单的事件代理机制，相当的nb
 * 当这个函数被调用时，就可以触发对应的事件处理程序
 * @param {*} e
 */
function eventProxy(e) {
  return this._listeners[e.type]((options.event && options.event(e)) || e);
}
```
