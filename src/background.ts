import type { Message } from "./type";

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    if (message.action === "listTags") {
      chrome.tabs.query({}, function (tabs) {
        console.log("Receive tabs in background = ", tabs);
        sendResponse(tabs);
      });
      return true;
    }
    if (message.action === "getMarkdown") {
      chrome.tabs.sendMessage(
        message.tabId!,
        { action: "getBodyMarkdown" },
        function (response: { markdown: string }) {
          console.log(
            "Receive markdownBody in background = ",
            response.markdown
          );
          sendResponse({ markdown: response.markdown });
        }
      );
      return true; // 异步
    }
  }
);
