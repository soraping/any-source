## 抽象语法树 (AST)

AST 在日常的开发中很难用到，是因为有人已经帮我们做了，例如 webpack 的 loader，babel 等等，都有现成的库可以用，所以，我们基本上都没有用到，但是，要想提高，就必须懂得 AST。

AST 的功能非常强大，可以说现代前端 javascript 的精髓就是 AST。

> 现在的前端已经进入了转换和编译的时代了。

### 从一个简单的函数说起

使用在线工具 [astexplorer](https://astexplorer.net/)

![ast](https://ws1.sinaimg.cn/large/e221b779gy1g24j9vs0dqj22xs126dl2.jpg)

左边是源函数，右边展示的是转换后的该函数的抽象树形结构，下面逐一分析字段：

```js
{
    "type": "Program",
    "body": [],
    "sourceType": "script"
}
```

抽象语法树是一个对象，该对象会有一个顶级的 `type` 属性 `Program` ，第二个属性是 `body` ，它是一个数组，该数组中存放的每一项都是一个对象，里面包含了所有的对于该语句的描述信息。

```bash
type:描述该语句的类型 --变量声明语句
kind：变量声明的关键字 -- var
declaration: 声明的内容数组，里面的每一项也是一个对象
    type: 描述该语句的类型
    id: 描述变量名称的对象
        type：定义
        name: 是变量的名字
    init: 初始化变量值得对象
        type: 类型
        value: 值 "is tree" 不带引号
        row: "\"is tree"\" 带引号
```

```js
function add(a, b) {
  return a + b;
}
```

转换这个函数，重点看下抽象语法树结构：

```js
{
  "type": "Program",
  "body": [
    {
      "type": "FunctionDeclaration",
      "id": {
        "type": "Identifier",
        "name": "add"
      },
      "params": [
        {
          "type": "Identifier",
          "name": "a"
        },
        {
          "type": "Identifier",
          "name": "b"
        }
      ],
      "body": {
        "type": "BlockStatement",
        "body": [
            {
                "type": "ReturnStatement",
                "argument": {
                    "type": "BinaryExpression",
                    "operator": "+",
                    "left": {
                        "type": "Identifier",
                        "name": "a"
                    },
                    "right": {
                        "type": "Identifier",
                        "name": "b"
                    }
                }
            }
        ]
      },
      "expression": false,
      "generator": false
    }
  ],
  "sourceType": "script"
}
```

分析这个树形结构，主要分析最顶层的 `body` 字段下的数据，首先这个函数是一个 `FunctionDeclaration` 对象，它有三个重要字段：

- id 函数名称

`type` 为 `Identifier` 字段是最基础的标志符，用来定义对象，`name` 为 `add`，就是这个函数的名字

```js
"id": {
        "type": "Identifier",
        "name": "add"
      }
```

- params 函数参数

```js
"params": [
        {
          "type": "Identifier",
          "name": "a"
        },
        {
          "type": "Identifier",
          "name": "b"
        }
      ]
```

- body 函数体

`type` 为 `BlockStatement` ，表示块状域，是一个函数体 `{return a + b}`

这个函数体树形结构中有个 `body` 字段，`type` 为 `ReturnStatement` ，表示 `return` 域，表示 `return a + b`

`type` 属性 `BinaryExpression` 表示二元运算表达式节点，`left` 和 `right` 表示运算符左右的两个表达式，`operator` 表示一个二元运算符

```js
"body": {
    "type": "BlockStatement",
    "body": [
        {
            "type": "ReturnStatement",
            "argument": {
                "type": "BinaryExpression",
                "operator": "+",
                "left": {
                    "type": "Identifier",
                    "name": "a"
                },
                "right": {
                    "type": "Identifier",
                    "name": "b"
                }
            }
        }
    ]
}
```

以上是一个最基础的抽象语法树，下面将利用对应的库来对它进行遍历，修改，并重新编译等操作。

### esprima、estraverse 和 escodegen 三个核心库

这三个库就是为了操作 ast 的，也是实现 `babel` 的核心库。

> `esprima` 将 js 代码转换成 AST

```js
let esprima = require("esprima");
let code = "function add(a,b){return a + b}";

/**
 * 通过 esprima 模块的 parseScript 方法将 JS 代码块转换成语法树，
 */
let tree = esprima.parseScript(code);

console.log(tree);
```

控制台打印：

```bash
Script {
  type: 'Program',
  body:
   [ FunctionDeclaration {
       type: 'FunctionDeclaration',
       id: [Object],
       params: [Array],
       body: [Object],
       generator: false,
       expression: false,
       async: false } ],
  sourceType: 'script' }
```

`esprima` 还有两个方法 `parseModule` 和 `tokenize`，`parseModule` 将 js 代码转换成一个模块，`tokenize` 就是按照一定的规则，例如 token 令牌（通常代表关键字，变量名，语法符号等），将代码分割为一个个的“串”，也就是语法单元）。涉及到词法解析的时候，常会用到 `tokenize`。

> `estraverse` 遍历和修改 AST

```js
let esprima = require("esprima");
let estraverse = require("estraverse");

let code = "function add(a,b){return a + b}";

let tree = esprima.parseScript(code);

// 遍历语法树 tree
estraverse.traverse(tree, {
  // 监听函数 进入阶段
  enter(node) {
    console.log("enter", node.type);
  },
  // 监听函数 离开阶段
  leave(node) {
    console.log("leave", node.type);
  }
});
```

控制台打印：

```bash
enter Program
enter FunctionDeclaration
enter Identifier
leave Identifier
enter Identifier
leave Identifier
enter Identifier
leave Identifier
enter BlockStatement
enter ReturnStatement
enter BinaryExpression
enter Identifier
leave Identifier
enter Identifier
leave Identifier
leave BinaryExpression
leave ReturnStatement
leave BlockStatement
leave FunctionDeclaration
leave Program
```

`estraverse` 模块的 `traverse` 方法能遍历 AST ，它有两个参数，第一个就是 AST，第二个参数是遍历的操作函数，遍历有两个阶段，一个是 `enter` 进入阶段，另一个是 `leave` 离开阶段，这两个监听函数都有一个参数，就是遍历的每个节点，上述代码中打印了每个节点的 `type` 属性，在真实操作中，会在这个 `enter` 阶段根据实际需要修改相应节点的值。

如，将加改成减，就会在 `enter` 阶段，根据 `node.type` 字段，逐一判断，然后修改：

```js
enter(node) {
    if (node.type == "FunctionDeclaration") {
      node.id.name = "sub";
    }
    if (node.type == "BinaryExpression") {
      node.operator = "-";
    }
  }
```

> `escodegen` 模块将 AST 转换成 js

```js
let esprima = require("esprima");
let estraverse = require("estraverse");
let escodegen = require("escodegen");

let code = "function add(a,b){return a + b}";

let tree = esprima.parseScript(code);

// 遍历语法树 tree
estraverse.traverse(tree, {
  // 将加改成减
  enter(node) {
    if (node.type == "FunctionDeclaration") {
      node.id.name = "sub";
    }
    if (node.type == "BinaryExpression") {
      node.operator = "-";
    }
  }
});

let result = escodegen.generate(tree);
```

控制台打印：

```bash
function sub(a, b) {
  return a - b;
}
```

`escodegen.generate` 这个方法就是将修改后的 AST 重新编译成了 js 代码。

### babel 的应用

学会了上面的三个核心库，接下来进入到了 `babel` 实战了，俗话说，没有一个 js 的问题是一个 `babel` 插件解决不了的，如果是就两个，写 `babel`插件已然成为了一个高阶前端必备的技能，下面就来写几个案例，熟悉 `babel` 插件的基本操作。

参考 [babel 插件手册](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md#toc-babel-types)

#### babel-core 和 babel-types 的应用

这两个库的就是上面三个核心库的一个应用，它里面做了很多操作封装，尤其是 `babel-types`，简直就是一个 `babel` 的 `lodash`，判断工具和替换工具，生成工具都能从里面找到。

先看一个箭头函数的例子：

```js
const babel = require("babel-core");
const types = require("babel-types");

let code = "let add = () => a + b";

// babel 转化采用的是访问者模式Visitor 对于某个对象或者一组对象，不同的访问者，产生的结果不同，执行操作也不同
let visitor = {
  ArrowFunctionExpression(path) {
    // 获取节点
    let node = path.node;
    // 获取函数参数
    let params = node.params;
    // 函数体
    let body = node.body;
    // 判断是否是代码块
    if (!types.isBlockStatement(body)) {
      // 添加返回域 return
      let returnStatement = types.returnStatement(body);
      // 添加 {}
      body = types.blockStatement([returnStatement]);
    }
    /**
     * 新生成的ast
     * { type: 'FunctionExpression',
        id: null,
        params: [],
        body: { type: 'BlockStatement', body: [ [Object] ], directives: [] },
        generator: false,
        async: false }
     */
    let func = types.functionExpression(null, params, body, false, false);
    // 整体替换新的语法树
    path.replaceWith(func);
  }
};

let arrowPlugin = { visitor };

let result = babel.transform(code, {
  plugins: [arrowPlugin]
});

console.log(result.code);
```

控制台打印：

```bash
let add = function () {
  return a + b;
};
```

看到这个结果，我们来对 `babel-core` 和 `babel-types` 做一个简单的总结。

`babel-core` 主要用来做转换操作，`babel.transform` 首先将原 js 转换成 ast，然后进行遍历，在通过 `visitor` 这个访问者，对特定的节点进行修改替换。

`babel-types` 这个库上个代码中用到了几个工具方法：

- `types.isBlockStatement` 方法判断是否是块状域

- `types.returnStatement` 设置返回域

- `types.blockStatement` 设置块状 {}

- `types.functionExpression` 生成 FunctionExpression ast
