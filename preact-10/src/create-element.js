import options from './options';
import { assign } from './util';

/**
  * Create an virtual node (used for JSX)
  * @param {import('./internal').VNode["type"]} type The node name or Component
  * constructor for this virtual node
  * @param {object | null | undefined} [props] The properties of the virtual node
  * @param {Array<import('.').ComponentChildren>} [children] The children of the virtual node
  * @returns {import('./internal').VNode}
  */
export function createElement(type, props, children) {
	props = assign({}, props);

	if (arguments.length>3) {
		children = [children];
		for (let i=3; i<arguments.length; i++) {
			children.push(arguments[i]);
		}
	}
	if (children!=null) {
		props.children = children;
	}

	// "type" may be undefined during development. The check is needed so that
	// we can display a nice error message with our debug helpers
	if (type!=null && type.defaultProps!=null) {
		for (let i in type.defaultProps) {
			if (props[i]===undefined) props[i] = type.defaultProps[i];
		}
	}
	let ref = props.ref;
	let key = props.key;
	if (ref!=null) delete props.ref;
	if (key!=null) delete props.key;

	return createVNode(type, props, key, ref);
}

/**
 * Create a VNode (used internally by Preact)
 * @param {import('./internal').VNode["type"]} type The node name or Component
 * Constructor for this virtual node
 * @param {object | string | number | null} props The properites of this virtual node.
 * If this virtual node represents a text node, this is the text of the node (string or number).
 * @param {string | number | null} key The key for this virtual node, used when
 * diffing it against its children
 * @param {import('./internal').VNode["ref"]} ref The ref property that will
 * receive a reference to its created child
 * @returns {import('./internal').VNode}
 */
export function createVNode(type, props, key, ref) {
	// V8 seems to be better at detecting type shapes if the object is allocated from the same call site
	// Do not inline into createElement and coerceToVNode!
	const vnode = {
		type,
		props,
		key,
		ref,
		_children: null,
		_dom: null,
		_lastDomChild: null,
		_component: null
	};
	vnode._self = vnode;

	if (options.vnode) options.vnode(vnode);

	return vnode;
}

export function createRef() {
	return {};
}

export /* istanbul ignore next */ function Fragment() { }

/**
 * Coerce an untrusted value into a VNode
 * Specifically, this should be used anywhere a user could provide a boolean, string, or number where
 * a VNode or Component is desired instead
 * @param {boolean | string | number | import('./internal').VNode} possibleVNode A possible VNode
 * @returns {import('./internal').VNode | null}
 */
export function coerceToVNode(possibleVNode) {
	if (possibleVNode == null || typeof possibleVNode === 'boolean') return null;
	if (typeof possibleVNode === 'string' || typeof possibleVNode === 'number') {
		return createVNode(null, possibleVNode, null, null);
	}

	if (Array.isArray(possibleVNode)) {
		return createElement(Fragment, null, possibleVNode);
	}

	// Clone vnode if it has already been used. ceviche/#57
	if (possibleVNode._dom!=null || possibleVNode._component!=null) {
		let vnode = createVNode(possibleVNode.type, possibleVNode.props, possibleVNode.key, null);
		vnode._dom = possibleVNode._dom;
		return vnode;
	}

	return possibleVNode;
}
