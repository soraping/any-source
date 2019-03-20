import $$observable from "symbol-observable";

import ActionTypes from "./utils/actionTypes";
import isPlainObject from "./utils/isPlainObject";

/**
 *
 * @param {Function} reducer 纯函数，接收两个参数，分别是当前的 state 树和要处理的 action，返回新的 state 树。
 *
 * @param {any} [preloadedState] 参数是可选的, 用于设置 state 初始状态。
 *
 * @param {Function} [enhancer] 是一个组合 store creator 的高阶函数，返回一个新的强化过的 store creator。
 * 这与 middleware 相似，它也允许你通过复合函数改变 store 接口
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
export default function createStore(reducer, preloadedState, enhancer) {
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
     * 由此可见 enhancer 为 applyMiddleware 执行时返回的高阶函数
     * 此后就进入了 applyMiddleware 模块内部的逻辑
     */
    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== "function") {
    throw new Error("Expected the reducer to be a function.");
  }

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

  /**
   *
   */
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * 返回当前state树，以获取当前状态
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

  /**
   *
   * @param {*} listener
   */
  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error("Expected the listener to be a function.");
    }

    if (isDispatching) {
      throw new Error(
        "You may not call store.subscribe() while the reducer is executing. " +
          "If you would like to be notified after the store has been updated, subscribe from a " +
          "component and invoke store.getState() in the callback to access the latest state. " +
          "See https://redux.js.org/api-reference/store#subscribe(listener) for more details."
      );
    }

    let isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      if (isDispatching) {
        throw new Error(
          "You may not unsubscribe from a store listener while the reducer is executing. " +
            "See https://redux.js.org/api-reference/store#subscribe(listener) for more details."
        );
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      const index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   *  核心方法
   *  触发action的函数：每次触发一个action，currentListeners中的所有函数都要执行一遍
   */
  function dispatch(action) {
    // 通过 isPlainObject方法判断的对象，具体实现可以查看 utils 工具函数中对这个方法的解释
    if (!isPlainObject(action)) {
      throw new Error(
        "Actions must be plain objects. " +
          "Use custom middleware for async actions."
      );
    }
    // action对象按照一定的格式，必须包含type字段
    if (typeof action.type === "undefined") {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          "Have you misspelled a constant?"
      );
    }

    if (isDispatching) {
      throw new Error("Reducers may not dispatch actions.");
    }

    // isDispatching 等待currentReducer的返回值之后，设置状态为false
    try {
      isDispatching = true;
      // reducer函数经过action后返回新的state树
      // 注意，这里的 state 是整个应用的 state 树
      currentState = currentReducer(currentState, action);
    } finally {
      // reducer函数执行完成后，将isDispatching恢复成false，方便下次action的触发
      isDispatching = false;
    }

    const listeners = (currentListeners = nextListeners);
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      listener();
    }

    return action;
  }

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

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  function observable() {
    const outerSubscribe = subscribe;
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
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
        const unsubscribe = outerSubscribe(observeState);
        return { unsubscribe };
      },

      [$$observable]() {
        return this;
      }
    };
  }

  /**
   * store对象创建的时候，内部会主动调用dispatch({ type: ActionTypes.INIT })来对内部状态进行初始化。
   * 同时，reducer就会被调用进行初始化。
   */
  dispatch({ type: ActionTypes.INIT });

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  };
}
