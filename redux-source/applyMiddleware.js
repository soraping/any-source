import compose from "./compose";

/**
 * 中间件模块，当createStore方法有enhancer参数时，实现中间件模块
 *
 * @param  {...any} middlewares
 */
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args);
    let dispatch = () => {
      throw new Error(
        "Dispatching while constructing your middleware is not allowed. " +
          "Other middleware would not be applied to this dispatch."
      );
    };
    // 这是一个简易的 store 对象，关键是在中间件内部，会用到这个dispatch和state
    const middlewareAPI = {
      getState: store.getState,
      // 传入一个初始 dispatch
      dispatch: (...args) => dispatch(...args)
    };
    const chain = middlewares.map(middleware => middleware(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    return {
      ...store,
      dispatch
    };
  };
}
