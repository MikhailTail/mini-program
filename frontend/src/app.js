import { useLaunch } from "@tarojs/taro";
import Taro from "@tarojs/taro";
import "./app.css";

// 云开发环境 ID：与微信开发者工具「云开发控制台」中的环境一致
const CLOUD_ENV_ID = "cloud1-d6grdd4538578bec7";

function App(props) {
  useLaunch(() => {
    if (Taro.cloud && process.env.TARO_ENV === "weapp") {
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
