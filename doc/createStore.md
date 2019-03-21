> **`createStore` 它创建一个 `Redux store`， 来以存放应用中所有的 state，应用中应有且仅有一个 store。**

### `createStore.js` 骨架

```js
/**
 *
 * @param {*} reducer combineReducers返回的reducer
 * @param {*} preloadedState 可选参数，用于设置 state 初始状态。
 * @param {*} enhancer
 */
export default function createStore(reducer, preloadedState, enhancer) {
  /**** 参数校验 ****/

  /**** 变量重命名 ****/

  /**** getState方法 ****/
  function getState() {}

  /**** subscribe方法 ****/
  function subscribe(listener) {}

  /**** dispatch方法 ****/
  function dispatch(action) {}

  /**** replaceReducer ****/
  function replaceReducer(nextReducer) {}

  /**** observable方法 ****/
  function observable() {}

  // store被创建后，自动分发一个'INIT' action。渲染出初始化的state树。
  dispatch({ type: ActionTypes.INIT });

  /**** store职责 ****/
  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  };
}
```

> 参数校验

```js
/***** 参数校验阶段 *****/

// preloadedState和enhancer不能同时为function
if (
  (typeof preloadedState === "function" && typeof enhancer === "function") ||
  (typeof enhancer === "function" && typeof arguments[3] === "function")
) {
  throw new Error(
    "It looks like you are passing several store enhancers to " +
      "createStore(). This is not supported. Instead, compose them " +
      "together to a single function."
  );
}

/**
 * preloadedState是一个函数，没有enhancer参数时，preloadedState赋值给enhancer
 */
if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
  enhancer = preloadedState;
  preloadedState = undefined;
}

// enhancer存在且必须是一个function
if (typeof enhancer !== "undefined") {
  if (typeof enhancer !== "function") {
    throw new Error("Expected the enhancer to be a function.");
  }

  /**
   * 此种情况创建的store如下
   * const store = createStore(rootReducer, applyMiddleware(...middlewares))
   * 或者  createStore(reducer,preState,applyMiddleware(thunk))
   * 由此可见 enhancer 为 applyMiddleware 执行时返回的高阶函数，具体解读可以查看 applyMiddleware 源码解析
   */
  return enhancer(createStore)(reducer, preloadedState);
}

if (typeof reducer !== "function") {
  throw new Error("Expected the reducer to be a function.");
}
```

> 变量命名

```js
// 保存了当前的reducer函数，该reducer函数可以被动态替换掉
let currentReducer = reducer;
// 保存了当前的state数据
let currentState = preloadedState;
// 保存了当前注册的函数列表
let currentListeners = [];
// 保存下一个监听函数列表
let nextListeners = currentListeners;
// 是否正在dispatch一个action
let isDispatching = false;
```

> getState 方法

```js
/**
 * 获取当前state树，以获取当前状态
 */
function getState() {
  // dispatch 方法未触发 action 前，无法获取当前 state 树
  if (isDispatching) {
    throw new Error(
      "You may not call store.getState() while the reducer is executing. " +
        "The reducer has already received the state as an argument. " +
        "Pass it down from the top reducer instead of reading it from the store."
    );
  }
  return currentState;
}
```

> subscribe 方法

设置监听器：

```js
// 设置监听器
let listener = store.subscribe(() => {
  // 监听器的回调方法
  console.log("listener");
});

// 取消监听
listener.unsubscribe();
```

> dispatch 方法

`dispatch` 接收 `action` 对象为参数，这个对象是通过 `isPlainObject()` 方法判断的纯正对象，分发 action。这是触发 state 变化的惟一途径。

`action` 对象标准格式

```js
{
    type: 'ACTION_TYPE',
    text: 'action data'
}
```

`action creator` 格式：

```js
function test(value) {
  return {
    type: "ACTION_TYPE",
    value
  };
}
```

> replaceReducer

```js
/**
 * 替换 `store` 当前用来计算 `state` 的 `reducer`
 * 适用场景
 * @param {*} nextReducer 新的reducer
 */
function replaceReducer(nextReducer) {
  if (typeof nextReducer !== "function") {
    throw new Error("Expected the nextReducer to be a function.");
  }
  // 函数副作用，替换了当前使用的 currentReducer
  currentReducer = nextReducer;
  dispatch({ type: ActionTypes.REPLACE });
}
```

> observable 方法

一个简易的 observable 实现，用的太少，只看了实现，可以在平常的代码试用

```js
/**
 * 一个及其简单的 observable 实现，可以学习
 * source$ = store.observable()
 * source$.subscribe({
 *    next: (state) => {
 *        console.log(state);
 *    }
 * })
 *
 */
function observable() {
  // 首先将 subscribe 方法引用赋值于 outerSubscribe变量
  const outerSubscribe = subscribe;
  return {
    /**
     * 订阅方法
     * @param {*} observer 订阅者
     * observer 包含一个next方法，该方法参数传递当前 state 树
     */
    subscribe(observer) {
      if (typeof observer !== "object" || observer === null) {
        throw new TypeError("Expected the observer to be an object.");
      }

      function observeState() {
        if (observer.next) {
          observer.next(getState());
        }
      }

      observeState();
      // 提供退订方法
      const unsubscribe = outerSubscribe(observeState);
      return { unsubscribe };
    },

    [$$observable]() {
      return this;
    }
  };
}
```
