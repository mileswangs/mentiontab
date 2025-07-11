import React from "react";
import type { Message } from "./type";
import { createRoot } from "react-dom/client";
import TurndownService from "turndown";
const turndownService = new TurndownService();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Content script loaded!");
  initMessageListener();
  const url = window.location.href;
  if (!url.includes("chatgpt.com")) {
    return;
  }
  let gptPromptTextArea: HTMLElement | null = null;

  const MAX_RETRY = 10;
  let retryCount = 0;

  while (!gptPromptTextArea && retryCount < MAX_RETRY) {
    console.log("Retry count = ", retryCount);
    retryCount++;
    await sleep(200);
    gptPromptTextArea = getChatGptPromptTextArea();
    if (gptPromptTextArea) {
      console.log("Find gpt prompt textarea");
      initGptPromptTextArea(gptPromptTextArea);
    }
  }
}

function initGptPromptTextArea(gptPromptTextArea: HTMLElement) {
  const textAreaParent = gptPromptTextArea.parentElement!;
  textAreaParent.style.position = "relative";
  gptPromptTextArea.addEventListener("keydown", (event) => {
    if (event?.key === "@") {
      console.log("Receive @ key");
      chrome.runtime.sendMessage(
        { action: "listTags" } as Message,
        function (response: { tabs: chrome.tabs.Tab[] }) {
          renderTabs(response.tabs, textAreaParent);
        }
      );
    }
  });
}

function getChatGptPromptTextArea() {
  return document.getElementById("prompt-textarea");
}

function getCleanBody() {
  const bodyClone = document.body.cloneNode(true) as HTMLElement;
  bodyClone
    .querySelectorAll(
      "script, style, link, noscript, template, meta, iframe, svg, canvas, font"
    )
    .forEach((el) => el.remove());
  return bodyClone.innerHTML;
}

function initMessageListener() {
  console.log("Init message listener");
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      console.log("Receive message in content script = ", message);
      if (message.action === "getBodyMarkdown") {
        const cleanBody = getCleanBody();
        console.log("Receive getBodyMarkdown in content script");
        const markdown = turndownService.turndown(cleanBody);
        sendResponse({ markdown });
        return true;
      }
    }
  );
}

let reactMount: HTMLElement | null = null;
let reactRoot: ReturnType<typeof createRoot> | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;

function renderTabs(tabs: chrome.tabs.Tab[], container: HTMLElement) {
  if (!reactMount) {
    reactMount = document.createElement("div");
    reactMount.id = "tab-mention-react-root";
    document.body.appendChild(reactMount);
    reactRoot = createRoot(reactMount);
  }
  if (clickHandler) {
    document.removeEventListener("click", clickHandler, true);
  }
  const stopRenderTabs = () => {
    reactRoot?.unmount();
    reactMount?.remove();
    reactRoot = null;
    reactMount = null;
  };
  clickHandler = (e: MouseEvent) => {
    if (
      reactMount &&
      e.target instanceof Node &&
      !reactMount.contains(e.target)
    ) {
      stopRenderTabs();
      document.removeEventListener("click", clickHandler!, true);
      clickHandler = null;
    }
  };
  document.addEventListener("click", clickHandler, true);

  const containerRect = container.getBoundingClientRect();
  const bottomToInputTop = window.innerHeight - containerRect.top + 8;
  const tagsLeft = containerRect.left;
  reactRoot!.render(
    <div
      style={{
        position: "fixed",
        bottom: `${bottomToInputTop}px`,
        left: `${tagsLeft}px`,
        zIndex: 10000,
      }}
    >
      <TagsUI tabs={tabs} stopRenderTabs={stopRenderTabs} />
    </div>
  );
}

function TagsUI({
  tabs,
  stopRenderTabs,
}: {
  tabs: chrome.tabs.Tab[];
  stopRenderTabs: () => void;
}) {
  return (
    <div>
      <h1>Tags</h1>
      <ul>
        {tabs.map((tab) => (
          <TagItem tab={tab} key={tab.id} stopRenderTabs={stopRenderTabs} />
        ))}
      </ul>
    </div>
  );
}

function TagItem({
  tab,
  stopRenderTabs,
}: {
  tab: chrome.tabs.Tab;
  stopRenderTabs: () => void;
}) {
  const handleClick = () => {
    console.log("Receive tag click");
    chrome.runtime.sendMessage(
      { action: "getMarkdown", tabId: tab.id } as Message,
      function (response: { markdown: string }) {
        console.log("Receive markdown = ", response.markdown);
        stopRenderTabs();
      }
    );
  };
  return (
    <li key={tab.id} onClick={handleClick}>
      {tab.title}
    </li>
  );
}

main();
