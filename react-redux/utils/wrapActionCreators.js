import { bindActionCreators } from "redux";

/**
 * 这个方法类似 redux-thunk ，它是一个高阶函数，返回值是一个高阶函数，接收的参数就是 action 的执行方法 dispatch
 * @param {*} actionCreators 生成 action 方法
 * let actionCreators = () => {
 *    type: string,
 *    payload: {}
 * }
 */
export default function wrapActionCreators(actionCreators) {
  return dispatch => bindActionCreators(actionCreators, dispatch);
}
