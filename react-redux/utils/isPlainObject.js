/**
 * 和redux的工具方法一致，判断当前对象是否是纯对象
 * 一般用来判断action
 * () => {
 *    type: string,
 *    payload: {}
 * }
 * @param {*} obj
 */
export default function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null) return false;

  let proto = Object.getPrototypeOf(obj);
  if (proto === null) return true;

  let baseProto = proto;
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto);
  }

  return proto === baseProto;
}
