> `applyMiddleware` 是 `redux` 最核心的方法之一，`redux` 的扩展中间件--洋葱模型。这段代码不多，由于使用的是函数式编程，使得代码阅读起来比较困难，需要一层一层的拨开。总体看来，在函数式的加持下，代码精炼了很多。

### compose 组合方法

```js
/**
 * 从右至左来组合多个函数
 * 最右边的参数可以接收多个参数，因为它将为由此产生的函数提供签名
 *
 * 从右至左把接收到的函数合成后的最终函数
 * compose(f,g,h) 类似于 (...args) => f(g(h(...args)))
 *
 * @param  {...any} funcs
 */
export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
```

> 函数式 `reduce` 的列表操作

```js
/**
 * 函数签名
 * @param total         必选。第一次迭代时，时数据的第一个值, 之后就是计算结束后的返回值。
 * @param currentValue  必选。第一次迭代时，此值为数组的第二个值，之后依次往下推
 * @param currentIndex  可选 当前元素的索引
 * @param arr           可选 当前元素所属的数组对象。
 * @param initialValue  可选 传递给函数的初始值
 */
reduce(function(total, currentValue, [currentIndex], [arr]), [initialValue])
```

```js
// 这个方法按照上述函数签名推算，可以做一下分析：
funcs.reduce((a, b) => (...args) => a(b(...args)));

// reduce 只接收一个方法，a 计算返回值，b, 当前值
funcs.reduce(function(a, b) {
  return function(...args) {
    return a(b(...args));
  };
});
```

例如 `[f,g,h]` 操作，第一次迭代时，a,b 分别为 f,g ,迭代后，a 的值就为：

```js
a = function(...args) {
  return f(g(...args));
};
```

第二次迭代时，b 的值为数组中的 h，执行迭代后，a 的值也发生了变化：

```js
// 首先替换形参 b 替换成 h
function(...args){
    return a(h(...args))
}

// 其次替换形参 a ,a 函数执行，返回最终的值
a = function(...args){
    return f(g(h(...args)))
}

// 最后的结果：
return (...args) => f(g(h(...args)))

```

### applyMiddleware 中间件模块

`applyMiddleware` 源码

```js
/**
 * 从applyMiddleware方法可以看出，函数式编程
 *
 * @param  {...any} middlewares
 */
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    // 获取进入中间件前的 原始store
    const store = createStore(...args);

    let dispatch = () => {
      throw new Error(
        "Dispatching while constructing your middleware is not allowed. " +
          "Other middleware would not be applied to this dispatch."
      );
    };

    // 获取最原始的 store 的 getState 和 dispatch，封装于 middlewareAPI 对象
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    };
    const chain = middlewares.map(middleware => middleware(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    // 经过洋葱模型后，返回拥有中间件的 store
    return {
      ...store,
      dispatch
    };
  };
}
```

在 `createStore.js` 源码中有一段 `enhancer` 参数判定

```js
// enhancer存在且必须是一个function
if (typeof enhancer !== "undefined") {
  if (typeof enhancer !== "function") {
    throw new Error("Expected the enhancer to be a function.");
  }

  /**
   * 此种情况创建的store如下
   * const store = createStore(rootReducer, applyMiddleware(...middlewares))
   * 或者  createStore(reducer,preState,applyMiddleware(thunk))
   * 由此可见 enhancer 为 applyMiddleware 执行时返回的高阶函数
   * 此后就进入了 applyMiddleware 模块内部的逻辑
   */
  return enhancer(createStore)(reducer, preloadedState);
}
```

分解 `applyMiddleware` 高阶函数：

```js

// createStore函数enhancer形参对应的就是 applyMiddleware(...middlewares)执行后的高阶函数
enhancer == applyMiddleware(...middlewares)

// createStore函数中 enhancer 参数就是 applyMiddleware(...middlewares)执行后返回的高阶函数
enhancer(createStore) == applyMiddleware(...middlewares)(createStore) = (...args) => {}

// 当执行此方法时，args == [reducer, preloadedState]
enhancer(createStore)(reducer, preloadedState)

```

由此可见，applyMiddleware 是一个高阶函数，其函数签名如下：

```js
const applyMiddleware = (...middlewares) => createStore => (...args) => {};
```

**不管是否有 applyMiddleware，createStore 的结果都是输出一个 store 对象，而 applyMiddleware 则可以对 store 对象中的 dispatch 进行改造。**

### middleware 编写

`applyMiddleware` 基本流程已经讲完了，那么它的参数 `middlewares` 究竟是怎样的一个流程，看一下中间件函数签名：

```js
/**
 * {dispatch, getState} 是applyMiddleware中封装的middlewareAPI对象
 * next 上一个中间件的dispatch方法
 * action 实际派发的action对象
 */
const reduxMiddleware = ({ dispatch, getState }) => next => action => {};
```

以`redux-thunk`为例，可以深窥 `middleware` 的精髓：

```js
function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => next => action => {
    if (typeof action === "function") {
      return action(dispatch, getState, extraArgument);
    }

    return next(action);
  };
}

const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;
```

在 redux 中使用:

```js
createStore(reducers, applyMiddleware(thunk));
```

`redux-thunk` 源码就这么多，光看这个源码，内心已经很平常了，毕竟前面已经讲过了 `applyMiddleware`，一样的，函数式的纯函数，一层一层的扒。

```js

// redux-thunk 模块真正暴露出的方法其实是 createThunkMiddleware 的高阶函数。
const thunk = ({ dispatch, getState }) => next => action => {
    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument);
    }

    return next(action);
  };

// 其实这些变量就是 redux 中 applyMiddleware 中封装的对象 middlewareAPI
// dispatch 就是通过中间件一层层传递，getState就是当前state树
{ dispatch, getState } = middlewareAPI

```

applyMiddleware 中的代码段：

```js
const middlewareAPI = {
  getState: store.getState,
  dispatch: (...args) => dispatch(...args)
};
const chain = middlewares.map(middleware => middleware(middlewareAPI));
```

其中，`applyMiddleware` 会执行每个中间件，传入 middlewareAPI 变量

```js
// thunk 执行后

let middlewareFun = next => action => {
  if (typeof action === "function") {
    return action(dispatch, getState, extraArgument);
  }

  return next(action);
};
```

中间件执行后，`applyMiddleware` 又做了一个组合的操作

```js
// 将 store.dispatch 作为参数传递到中间件中
dispatch = compose(...chain)(store.dispatch);
```

看到这里，就可以看到，next 其实就是 dispatch 方法，结下来就是 thunk 中间的处理逻辑了。
