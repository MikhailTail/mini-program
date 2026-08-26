import { useLaunch } from "@tarojs/taro";
import "./app.css";

function App(props) {
  useLaunch(() => {
    console.log("App launched.");
  });
  return props.children;
}

export default App;
