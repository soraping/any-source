// render modes

// 不渲染
export const NO_RENDER = 0;
// react.render 其实就是同步
export const SYNC_RENDER = 1;
// forceUpdate 强制刷新渲染
export const FORCE_RENDER = 2;
// 异步渲染
export const ASYNC_RENDER = 3;

// 在节点中添加的属性
export const ATTR_KEY = "__preactattr_";

// 用于识别那些样式不用自动添加px的正则
export const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;
