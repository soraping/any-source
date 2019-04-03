/**
 * Virtual DOM Node
 * 虚拟 dom 的结构，通过h /（createElement()）方法会返回这个类的实例
 * {
        nodeName:"div",//标签名或者函数（自定义组件）
        children:[],   //子组件组成的数组，每一项也是一个vnode
        key:"",        //key
        attributes:{}  //jsx的属性
    }
    拥有子组件的嵌套类型：
    {
        nodeName:"div",//标签名或者函数（自定义组件）
        children:[
            {
                nodeName:"div",
                children:[],
                key:"",        
                attributes:{}
            }
        ],   
        key:"",        //key
        attributes:{}  //jsx的属性
    }

    

    nodeName存在三种情况：
    - 文本类型，<p>hello</p>，其中 hello 就是文本类型
    - 字符串，普通标签类型 就是div,span,p等等的html标签
    - function，当嵌套组件时，h(HelloJSX, null)，这个函数执行后的虚拟dom
        {
            nodeName: "function",
            children: [],
            key: '',
            attributes: {}
        }

 */
export const VNode = function VNode() {};
