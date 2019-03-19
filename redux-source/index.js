import createStore from "./createStore";
import combineReducers from "./combineReducers";
import bindActionCreators from "./bindActionCreators";
import applyMiddleware from "./applyMiddleware";
import compose from "./compose";
import warning from "./utils/warning";
import __DO_NOT_USE__ActionTypes from "./utils/actionTypes";

/**
 * 定义了一个空方法 isCrushed()，
 * 主要是验证在非生产环境下 Redux 是否被压缩（因为在生产环境下，空方法会被kill的，那么 (isCrushed.name !== 'isCrushed') 就是 true），
 * 如果被压缩会给开发者一个 warn 提示）。
 */
function isCrushed() {}

if (
  process.env.NODE_ENV !== "production" &&
  typeof isCrushed.name === "string" &&
  isCrushed.name !== "isCrushed"
) {
  warning(
    'You are currently using minified code outside of NODE_ENV === "production". ' +
      "This means that you are running a slower development build of Redux. " +
      "You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify " +
      "or setting mode to production in webpack (https://webpack.js.org/concepts/mode/) " +
      "to ensure you have the correct code for your production build."
  );
}

export {
  createStore,
  combineReducers,
  bindActionCreators,
  applyMiddleware,
  compose,
  __DO_NOT_USE__ActionTypes
};
