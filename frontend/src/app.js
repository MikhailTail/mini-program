import { useLaunch } from "@tarojs/taro";
import Taro from "@tarojs/taro";
import "./app.css";

// 云开发环境 ID：克隆后请在微信开发者工具「云开发控制台」创建环境并填写
// 留空则跳过云初始化，答题记录/报告仅保存在本地，云函数相关功能不可用
const CLOUD_ENV_ID = ""; // TODO: 填入你的云开发环境 ID，如 "cloud1-xxxxxxx"

function App(props) {
  useLaunch(() => {
    if (Taro.cloud && process.env.TARO_ENV === "weapp" && CLOUD_ENV_ID) {
      Taro.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      });
      console.log("Cloud initialized:", CLOUD_ENV_ID);
    }
    console.log("App launched.");
  });
  return props.children;
}

export default App;
