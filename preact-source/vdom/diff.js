import { ATTR_KEY } from "../constants";
import { isSameNodeType, isNamedNode } from "./index";
import { buildComponentFromVNode } from "./component";
import { createNode, setAccessor } from "../dom/index";
import { unmountComponent } from "./component";
import options from "../options";
import { applyRef } from "../util";
import { removeNode } from "../dom/index";

/**
 * Queue of components that have been mounted and are awaiting componentDidMount
 * @type {Array<import('../component').Component>}
 */
// 用于收集那些等待被调用componentDidMount回调的组件
export const mounts = [];

/**
 * 记录递归层次
 * 这个值很奇怪，我发现代码里根本没有做多层次的递归调用，只有0和1，曾一度怀疑我看代码是不是老眼昏花了。
 * 在 diff 方法中，这个变量只做了一次增，一次减
 */
export let diffLevel = 0;

// 判定挂载的父类DOM树是否为SVG
let isSvgMode = false;

/**
 * 一个全局的标志位，在diff方法中，这个标志位如果要为 true ,就必须更新的真实dom必须存在且这个dom并不是preact创建的
 * hydrating = dom != null && !(ATTR_KEY in dom);
 * ATTR_KEY 对应常量 __preactattr_，只要 preact 创建的 dom，都会包含这个属性
 * 这个属性用来存储 props 等缓存信息
 */
let hydrating = false;

/**
 * 批量触发componentDidMount与afterMount
 */
export function flushMounts() {
  let c;
  while ((c = mounts.shift())) {
    if (options.afterMount) options.afterMount(c);
    if (c.componentDidMount) c.componentDidMount();
  }
}

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

/**
 * Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing.
 * @param {import('../dom').PreactElement} dom A DOM node to mutate into the shape of a `vnode`
 * @param {import('../vnode').VNode} vnode A VNode (with descendants forming a tree) representing the desired DOM structure
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {boolean} [componentRoot] ?
 * @private
 */
function idiff(dom, vnode, context, mountAll, componentRoot) {
  // 定义一个输出变量，将原始dom赋值给它（如果没有更新，直接就输出了）
  let out = dom,
    prevSvgMode = isSvgMode;

  // 虚拟dom为null和boolean，就赋值空字符
  if (vnode == null || typeof vnode === "boolean") vnode = "";

  // 为字符传和数字类型时，转换成文本节点
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
      // 不是文本节点，替换之前的节点，回收之前的节点
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

  /**
   * VNode 是一个组件类型，就是h函数的执行结果
   * {
 	    nodeName:"div",//标签名或者函数（自定义组件）节点的类型， div span p ...
        children:[],   //子组件组成的数组，每一项也是一个vnode
        key:"",        //key
        attributes:{}  //jsx的属性
   * }
   */
  let vnodeName = vnode.nodeName;
  if (typeof vnodeName === "function") {
    return buildComponentFromVNode(dom, vnode, context, mountAll);
  }

  // svg的处理
  isSvgMode =
    vnodeName === "svg"
      ? true
      : vnodeName === "foreignObject"
      ? false
      : isSvgMode;

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

  /**
   * 开始处理子元素
   * fc 真实dom的第一个子元素
   * props 通过preact创建的真实dom中的属性[ATTR_KEY]的值
   * vchildren 虚拟dom中的子元素数组
   */
  let fc = out.firstChild,
    props = out[ATTR_KEY],
    vchildren = vnode.children;

  // props 处理逻辑
  if (props == null) {
    props = out[ATTR_KEY] = {};
    // 将真实dom中的一些属性也追加到props数组中
    for (let a = out.attributes, i = a.length; i--; )
      props[a[i].name] = a[i].value;
  }

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

  // 将props和atrributes从VNode中应用到DOM元素
  diffAttributes(out, vnode.attributes, props);

  // 恢复之前的SVG模式
  isSvgMode = prevSvgMode;

  return out;
}

/**
 * 虚拟dom子组件的深层diff方法
 * @param {*} dom 虚拟dom所定义的真实dom
 * @param {*} vchildren diff的虚拟子元素
 * @param {*} context 环境上下文
 * @param {*} mountAll
 * @param {*} isHydrating 是否由preact创建
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
  let originalChildren = dom.childNodes,
    children = [],
    keyed = {},
    keyedLen = 0,
    min = 0,
    len = originalChildren.length,
    childrenLen = 0,
    vlen = vchildren ? vchildren.length : 0,
    j,
    c,
    f,
    vchild,
    child;

  // Build up a map of keyed children and an Array of unkeyed children:
  if (len !== 0) {
    for (let i = 0; i < len; i++) {
      let child = originalChildren[i],
        props = child[ATTR_KEY],
        key =
          vlen && props
            ? child._component
              ? child._component.__key
              : props.key
            : null;
      if (key != null) {
        keyedLen++;
        keyed[key] = child;
      } else if (
        props ||
        (child.splitText !== undefined
          ? isHydrating
            ? child.nodeValue.trim()
            : true
          : isHydrating)
      ) {
        children[childrenLen++] = child;
      }
    }
  }

  if (vlen !== 0) {
    for (let i = 0; i < vlen; i++) {
      vchild = vchildren[i];
      child = null;

      // attempt to find a node based on key matching
      let key = vchild.key;
      if (key != null) {
        if (keyedLen && keyed[key] !== undefined) {
          child = keyed[key];
          keyed[key] = undefined;
          keyedLen--;
        }
      }
      // attempt to pluck a node of the same type from the existing children
      else if (min < childrenLen) {
        for (j = min; j < childrenLen; j++) {
          if (
            children[j] !== undefined &&
            isSameNodeType((c = children[j]), vchild, isHydrating)
          ) {
            child = c;
            children[j] = undefined;
            if (j === childrenLen - 1) childrenLen--;
            if (j === min) min++;
            break;
          }
        }
      }

      // morph the matched/found/created DOM child to match vchild (deep)
      child = idiff(child, vchild, context, mountAll);

      f = originalChildren[i];
      if (child && child !== dom && child !== f) {
        if (f == null) {
          dom.appendChild(child);
        } else if (child === f.nextSibling) {
          removeNode(f);
        } else {
          dom.insertBefore(child, f);
        }
      }
    }
  }

  // remove unused keyed children:
  if (keyedLen) {
    for (let i in keyed)
      if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
  }

  // remove orphaned unkeyed children:
  while (min <= childrenLen) {
    if ((child = children[childrenLen--]) !== undefined)
      recollectNodeTree(child, false);
  }
}

/**
 * 递归地回收(或者卸载)节点及其后代节点
 * @param {*} node
 * @param {*} unmountOnly 如果为`true`,仅仅触发卸载的生命周期，跳过删除
 */
export function recollectNodeTree(node, unmountOnly) {
  let component = node._component;
  if (component) {
    // if node is owned by a Component, unmount that component (ends up recursing back here)
    unmountComponent(component);
  } else {
    // 如果 preact 创建的组件，且设置了 ref，且 ref是一个function时，在卸载的时候，需要传一个null作为参数作为回调。
    if (node[ATTR_KEY] != null) applyRef(node[ATTR_KEY].ref, null);
    // 如果不是 preact 创建的组件，或者 设置了删除字段，则调用删除节点方法
    if (unmountOnly === false || node[ATTR_KEY] == null) {
      // 从父节点中将该子节点删除
      removeNode(node);
    }
    // 递归删除子节点
    removeChildren(node);
  }
}

/**
 * 回收/卸载所有的子元素
 * 在方法内部使用 recollectNodeTree(node, true);
 * 递归调用
 * 注意，这里使用 .lastChild而不是使用 .firstChild，是因为访问节点的代价更低。（工匠精神哈！）
 * @param {*} node
 */
export function removeChildren(node) {
  node = node.lastChild;
  while (node) {
    let next = node.previousSibling;
    recollectNodeTree(node, true);
    node = next;
  }
}

/**
 *
 * @param {*} dom 已经通过diff之后的真实dom
 * @param {*} attrs 虚拟dom中的属性值
 * @param {*} old 通过preact创建的真实dom中，属性[ATTR_KEY]中保存的值和真实dom中已有属性值的组合
 */
function diffAttributes(dom, attrs, old) {
  let name;

  // remove attributes no longer present on the vnode by setting them to undefined
  for (name in old) {
    if (!(attrs && attrs[name] != null) && old[name] != null) {
      setAccessor(dom, name, old[name], (old[name] = undefined), isSvgMode);
    }
  }

  // add new & update changed attributes
  for (name in attrs) {
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
