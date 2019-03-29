import { h, h as createElement } from "./h";
import { cloneElement } from "./clone-element";
import { Component } from "./component";
import { render } from "./render";
import { rerender } from "./render-queue";
import options from "./options";

function createRef() {
  return {};
}

export default {
  // h 方法 和 createElement 是同一个方法
  h,
  createElement,
  cloneElement,
  createRef,
  Component,
  render,
  rerender,
  options
};

export {
  h,
  createElement,
  cloneElement,
  createRef,
  Component,
  render,
  rerender,
  options
};
