import React, { useEffect, useState } from "react";
import type { Message } from "./type";
import { createRoot } from "react-dom/client";
import TurndownService from "turndown";
const turndownService = new TurndownService();

declare global {
  interface Window {
    openTabs?: () => void;
    stopRenderTabs?: () => void;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function InitContentScript() {
  console.log("Content script loaded!");
  //1. add tab listener
  initTabListener();

  //2. check if gpt
  const url = window.location.href;
  if (!url.includes("chatgpt.com")) {
    return;
  }
  //3. find textarea
  const textarea = await findTextArea();
  if (!textarea) {
    return;
  }

  //4. init gpt prompt text area
  addGptTextAreaListener(textarea);

  //5. mount react
  mountReact();
}

async function findTextArea() {
  let gptPromptTextArea: HTMLElement | null = null;

  const MAX_RETRY = 10;
  let retryCount = 0;

  while (!gptPromptTextArea && retryCount < MAX_RETRY) {
    retryCount++;
    gptPromptTextArea = document.getElementById("prompt-textarea");
    await sleep(200);
  }

  return gptPromptTextArea;
}

function addGptTextAreaListener(gptPromptTextArea: HTMLElement) {
  gptPromptTextArea.addEventListener("keydown", (event) => {
    if (event.key === "@") {
      window.openTabs?.();
    }
  });
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

function initTabListener() {
  console.log("Init message listener");
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      console.log("Receive message in content script = ", message);
      if (message.action === "produceMarkdown") {
        const cleanBody = getCleanBody();
        console.log(" produceMarkdown in content script");
        const markdown = turndownService.turndown(cleanBody);
        sendResponse({ markdown });
        return true;
      }
    }
  );
}

function mountReact() {
  const thread_bottom = document.getElementById("thread-bottom");
  const container = thread_bottom?.children[0]?.children[0] as
    | HTMLElement
    | undefined;
  if (!container) {
    return;
  }
  container.style.position = "relative";
  const reactMount = document.createElement("div");
  reactMount.id = "tab-mention-react-root";
  container.appendChild(reactMount);
  console.log("container = ", container);
  const reactRoot = createRoot(reactMount);

  //check textarea if in center
  const rect = container.getBoundingClientRect();
  const distanceToBottom = window.innerHeight - rect.bottom;
  if (distanceToBottom < 200) {
    reactMount.style.bottom = `${container.offsetHeight + 20}px`;
  } else {
    reactMount.style.top = `${container.offsetHeight + 20}px`;
  }

  reactMount.style.position = "absolute";
  reactMount.style.left = `220px`;
  reactMount.style.zIndex = "10000";
  reactRoot.render(<TagsUI />);
}

function TagsUI() {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);

  const stopRenderTabs = () => {
    setIsOpen(false);
  };
  useEffect(() => {
    window.openTabs = () => {
      chrome.runtime.sendMessage(
        { action: "listTags" } as Message,
        function (response: { tabs: chrome.tabs.Tab[] }) {
          setTabs(response.tabs);
          setIsOpen(true);
        }
      );
    };
    window.stopRenderTabs = stopRenderTabs;

    document.addEventListener("click", stopRenderTabs);
    return () => {
      window.openTabs = undefined;
      window.stopRenderTabs = undefined;
      document.removeEventListener("click", stopRenderTabs);
    };
  }, []);
  if (!isOpen) {
    return null;
  }
  return (
    <>
      <h1>Tags</h1>
      <ul>
        {tabs.map((tab) => (
          <TagItem tab={tab} key={tab.id} stopRenderTabs={stopRenderTabs} />
        ))}
      </ul>
    </>
  );
}

function TagItem({
  tab,
  stopRenderTabs,
}: {
  tab: chrome.tabs.Tab;
  stopRenderTabs: () => void;
}) {
  console.log("render tag item");
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Receive tag click");
    chrome.runtime.sendMessage(
      { action: "getTabMarkdown", tabId: tab.id } as Message,
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

InitContentScript();
