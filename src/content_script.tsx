import React from "react";
import type { Message } from "./type";
import { createRoot } from "react-dom/client";
import TurndownService from "turndown";
console.log("Content script loaded!");
const turndownService = new TurndownService();

// Listen for text selection events
document.addEventListener("mouseup", function () {
  const selectedText = window.getSelection()?.toString();

  // Only proceed if there's actually text selected
  if (selectedText && selectedText.trim().length > 0) {
    // Send the selected text to the background script
    chrome.runtime.sendMessage(
      { action: "listTags" } as Message,
      function (response: chrome.tabs.Tab[]) {
        console.log("Receive tabs = ", response);
        renderSidebar(response);
      }
    );
  }
});

function getCleanBody() {
  const bodyClone = document.body.cloneNode(true) as HTMLElement;
  bodyClone
    .querySelectorAll(
      "script, style, link, noscript, template, meta, iframe, svg, canvas, font"
    )
    .forEach((el) => el.remove());
  return bodyClone.innerHTML;
}

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    if (message.action === "getBodyMarkdown") {
      const cleanBody = getCleanBody();
      const markdown = turndownService.turndown(cleanBody);
      sendResponse({ markdown });
      return true;
    }
  }
);

let root: ReturnType<typeof createRoot> | null = null;

function renderSidebar(tabs: chrome.tabs.Tab[]) {
  let container = document.getElementById("tab-sidebar-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "tab-sidebar-root";
    document.body.appendChild(container);
  }
  if (!root) {
    root = createRoot(container);
  }
  root.render(
    <div style={{ position: "fixed", bottom: 0, right: 0 }}>
      <TagsUI tabs={tabs} />
    </div>
  );
}

function TagsUI({ tabs }: { tabs: chrome.tabs.Tab[] }) {
  return (
    <div>
      <h1>Tags</h1>
      <ul>
        {tabs.map((tab) => (
          <TagItem tab={tab} key={tab.id} />
        ))}
      </ul>
    </div>
  );
}

function TagItem({ tab }: { tab: chrome.tabs.Tab }) {
  const handleClick = () => {
    chrome.runtime.sendMessage(
      { action: "getMarkdown", tabId: tab.id } as Message,
      function (response: { markdown: string }) {
        console.log("Receive markdown = ", response.markdown);
      }
    );
  };
  return (
    <li key={tab.id} onClick={handleClick}>
      {tab.title}
    </li>
  );
}
