### 简述

`redux` 工作流

![原理图](https://ws1.sinaimg.cn/large/e221b779gy1g16zocmmyij20m80bljw3.jpg)

`redux` 源码目录结构

```bash
├── applyMiddleware.js
├── bindActionCreators.js
├── combineReducers.js
├── compose.js
├── createStore.js
├── index.js
└── utils
    ├── actionTypes.js
    ├── isPlainObject.js
    └── warning.js
```

通过源码目录可以看出 `redux` 的内容是非常少的，但其精髓却非常值得深挖。

#### 入口（index.js）

```js
function isCrushed() {}

if (
  process.env.NODE_ENV !== "production" &&
  typeof isCrushed.name === "string" &&
  isCrushed.name !== "isCrushed"
) {
  warning("...");
}
```

定义了一个空方法 `isCrushed()`，主要是验证在非生产环境下 Redux 是否被压缩（因为在生产环境下，空方法会被 kill 的，那么 (isCrushed.name !== 'isCrushed') 就是 true），如果被压缩会给开发者一个 warn 提示）。

```js
export {
  createStore,
  combineReducers,
  bindActionCreators,
  applyMiddleware,
  compose,
  __DO_NOT_USE__ActionTypes
};
```

入口文件暴露出这些个模块，`__DO_NOT_USE__ActionTypes` 定义了一些内置的几个 ActionTypes，就是让用户在自己的应用里 `do not use`，因为 `redux` 内部使用了。
