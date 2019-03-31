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
 */
export const VNode = function VNode() {};
