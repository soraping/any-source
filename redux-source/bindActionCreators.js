/**
 * 函数式的高级写法
 * @param {*} actionCreator
 * @param {*} dispatch
 */
// const bindActionCreator = (actionCreator, dispatch) => (...args) => dispatch(actionCreator.apply(this, args));

/**
 * 这个函数的主要作用就是返回一个函数，当我们调用返回的这个函数的时候，
 * 就会自动的dispatch对应的action
 * @param {*} actionCreator
 * @param {*} dispatch
 */
function bindActionCreator(actionCreator, dispatch) {
  return function() {
    return dispatch(actionCreator.apply(this, arguments));
  };
}

/**
 * bindActionCreators是redux提供的一个辅助方法，
 * 能够让我们以方法的形式来调用action。同时，自动dispatch对应的action。
 * @param {Function or Object} actionCreators
 * @param {Function} dispatch
 */
export default function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === "function") {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== "object" || actionCreators === null) {
    throw new Error(
      `bindActionCreators expected an object or a function, instead received ${
        actionCreators === null ? "null" : typeof actionCreators
      }. ` +
        `Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?`
    );
  }

  const boundActionCreators = {};
  for (const key in actionCreators) {
    // 单个action生成方法
    const actionCreator = actionCreators[key];
    if (typeof actionCreator === "function") {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
