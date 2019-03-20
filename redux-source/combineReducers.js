import ActionTypes from "./utils/actionTypes";
import warning from "./utils/warning";
import isPlainObject from "./utils/isPlainObject";

/**
 * 经过reducer，返回值不能为undefined
 * @param {*} key state树中对应的reducer键值
 * @param {*} action
 */
function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type;
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || "an action";

  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  );
}

/**
 *
 * @param {state} inputState 当前state树
 * @param {*} reducers
 * @param {*} action
 * @param {*} unexpectedKeyCache
 */
function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  const reducerKeys = Object.keys(reducers);
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? "preloadedState argument passed to createStore"
      : "previous state received by the reducer";

  if (reducerKeys.length === 0) {
    return (
      "Store does not have a valid reducer. Make sure the argument passed " +
      "to combineReducers is an object whose values are reducers."
    );
  }
  // state是不是纯对象
  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    );
  }
  // 过滤出state树中无法识别的，无定义reducer的key
  const unexpectedKeys = Object.keys(inputState).filter(
    // 判定条件：reducers中不存在 这个 key 且 unexpectedKeyCache变量中也不存在
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  );

  unexpectedKeys.forEach(key => {
    // 此处要注意下，这个地方是内部函数的一个副作用，在此处赋值，会对函数外的引用变量发生改变
    unexpectedKeyCache[key] = true;
  });

  if (action && action.type === ActionTypes.REPLACE) return;

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? "keys" : "key"} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    );
  }
}

/**
 * 确认reducer是否是合法的reducer，即返回的state是不是undefined，如果是undefined，则是非法reducer
 *
 * 1. 在初始化阶段,reducer 传入的 state 值是 undefined,此时,需要返回初始state,且初始state不能为undefined
 * 2. 当传入不认识的 actionType 时, reducer(state, {type}) 返回的不能是undefined
 * 3. redux/ 这个 namespace 下的action 不应该做处理,直接返回 currentState 就行 (谁运气这么差会去用这种actionType...)
 */
function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key];
    const initialState = reducer(undefined, { type: ActionTypes.INIT });

    if (typeof initialState === "undefined") {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      );
    }

    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === "undefined"
    ) {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${
            ActionTypes.INIT
          } or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      );
    }
  });
}

/**
 * 合并reducer
 * 接收参数：
 * {
 *    todo: (state, action) => {
 *        ...
 *        return state;
 *    },
 *    ...
 * }
 * @param {*} reducers
 *
 * 返回值是一个纯函数，接收当前 state树和action，这个纯函数返回更新后的 state 树
 * @return (state, action) => state
 */
export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i];

    if (process.env.NODE_ENV !== "production") {
      if (typeof reducers[key] === "undefined") {
        warning(`No reducer provided for key "${key}"`);
      }
    }
    // 把非function的reducer过滤掉，存入变量finalReducers
    if (typeof reducers[key] === "function") {
      finalReducers[key] = reducers[key];
    }
  }
  const finalReducerKeys = Object.keys(finalReducers);

  // 定义变量存储 state树中的无效key（reducer中不存在）
  let unexpectedKeyCache;
  if (process.env.NODE_ENV !== "production") {
    unexpectedKeyCache = {};
  }

  let shapeAssertionError;
  try {
    // 校验reducer是否合法
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }

  /**
   *  最终返回的函数，接收两个参数，在createStore方法中会调用，state为当前树，action为传递的操作
   *  @return state 经过 action 改变后的 state 树
   */
  return function combination(state = {}, action) {
    // 抛出不合法的 reducer 校验
    if (shapeAssertionError) {
      throw shapeAssertionError;
    }

    if (process.env.NODE_ENV !== "production") {
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      );
      if (warningMessage) {
        warning(warningMessage);
      }
    }
    // 是否有改变判定字段
    let hasChanged = false;
    const nextState = {};
    for (let i = 0; i < finalReducerKeys.length; i++) {
      // state树中的各个reducer对应的值
      const key = finalReducerKeys[i];
      // 单个reducer
      const reducer = finalReducers[key];
      // 此处是state树中对应的状态值，其key,就是reducers传入combineRefucers所对应各个reducer的key值
      const previousStateForKey = state[key];
      // 经过reducer，返回改变后的模块state值
      const nextStateForKey = reducer(previousStateForKey, action);
      // reducer的返回值不能为undefined
      if (typeof nextStateForKey === "undefined") {
        const errorMessage = getUndefinedStateErrorMessage(key, action);
        throw new Error(errorMessage);
      }
      // 找到对应的key值，把改变后的模块state重新赋值
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
