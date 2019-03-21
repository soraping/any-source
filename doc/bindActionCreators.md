### `bindActionCreators` 使用

把一个 value 为不同 action creator 的对象，转成拥有同名 key 的对象。同时使用 dispatch 对每个 action creator 进行包装，以便可以直接调用它们。

```js
function test1(value) {
  return {
    type: "TEST_HAHA",
    value
  };
}

function test2(value) {
  return {
    type: "TEST_XIXI",
    value
  };
}

let actions = bindActionCreators(
  {
    test1,
    test2
  },
  store.dispatch
);

/**
 {
   test1: Function,
   test2: Function
}
*/
console.log(actions);

// 调用
store.dispatch({ type: "TEST_HAHA", value: "haha" });
```

`bindActionCreator` 函数用法：

```js
function bindActionCreator(actionCreator, dispatch) {
  return function() {
    return dispatch(actionCreator.apply(this, arguments));
  };
}
```

此函数的作用就是返回一个 `() => dispatch(action)` 的高阶函数，当触发 `action` 时，就会触发 `reducer` 更新 state 树

源码：

```js
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
```
