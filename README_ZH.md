# MentionTab

**让 ChatGPT 阅读打开的网页.**

MentionTab 让 ChatGPT 访问你当前正在浏览的网页内容 —— 包括私有页面、需要登录的站点，甚至社交媒体评论。  
它是完全开源的，不需要订阅，始终以隐私优先为理念构建。

---

## 🚀 下载使用

你可以通过以下两种方式获取插件并安装：

- ✅ 推荐访问 [mentiontab.site](https://mentiontab.site) 下载最新版本
- 或前往 [GitHub Releases](https://github.com/mileswangs/mentiontab/releases/latest) 页面

下载后解压缩，并在 Chrome 开发者模式中加载即可：

1. 打开 `chrome://extensions`
2. 开启右上角的 **开发者模式**
3. 点击「加载已解压的扩展程序」，选择解压后的文件夹

---

## 🧑‍💻 开发调试

如果你希望自行开发或调试：

1. 克隆本项目
2. 安装依赖：
   ```bash
   pnpm install
   ```
3. 启动开发构建：

   bash

   CopyEdit

   `pnpm run watch`

4. 打开 `chrome://extensions`
5. 加载项目根目录下的 `dist/` 文件夹作为扩展
