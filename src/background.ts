import type { Message } from "./type";

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    console.log("Receive message in background = ", message);
    if (message.action === "listTags") {
      chrome.tabs.query({}, function (tabs) {
        const tabWithoutCurrent = tabs.filter(
          (tab) => tab.id !== sender.tab?.id
        );
        sendResponse({ tabs: tabWithoutCurrent });
      });
      return true;
    }
    if (message.action === "getTabMarkdown") {
      console.log("Receive getTabMarkdown in background");
      chrome.tabs.sendMessage(
        message.tabId!,
        { action: "produceMarkdown" },
        function (response: { markdown: string } | undefined) {
          sendResponse({ markdown: response?.markdown || "" });
        }
      );
      return true; // 异步
    }
  }
);
