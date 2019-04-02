import { IS_NON_DIMENSIONAL } from "../constants";
import { applyRef } from "../util";
import options from "../options";

/**
 * A DOM event listener
 * @typedef {(e: Event) => void} EventListner
 */

/**
 * A mapping of event types to event listeners
 * @typedef {Object.<string, EventListener>} EventListenerMap
 */

/**
 * Properties Preact adds to elements it creates
 * @typedef PreactElementExtensions
 * @property {string} [normalizedNodeName] A normalized node name to use in diffing
 * @property {EventListenerMap} [_listeners] A map of event listeners added by components to this DOM node
 * @property {import('../component').Component} [_component] The component that rendered this DOM node
 * @property {function} [_componentConstructor] The constructor of the component that rendered this DOM node
 */

/**
 * A DOM element that has been extended with Preact properties
 * @typedef {Element & ElementCSSInlineStyle & PreactElementExtensions} PreactElement
 */

/**
 * 创建一个节点，并在这个节点上追加一个属性 normalizedNodeName
 * 可见，通过preact创建的节点都会存在一个额外的属性 normalizedNodeName ，类似于常量 ATTR_KEY
 * @param {*} nodeName
 * @param {*} isSvg
 */
export function createNode(nodeName, isSvg) {
  /** @type {PreactElement} */
  let node = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", nodeName)
    : document.createElement(nodeName);
  node.normalizedNodeName = nodeName;
  return node;
}

/**
 * 从父节点删除该节点
 * @param {*} node
 */
export function removeNode(node) {
  let parentNode = node.parentNode;
  if (parentNode) parentNode.removeChild(node);
}

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
