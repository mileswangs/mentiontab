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

  const url = window.location.href;
  if (!url.includes("chatgpt.com")) {
    return;
  }

  //await 保证mountReact在textarea找到之后再执行
  await addListenerInFirstTextArea();

  mountReact();
}

async function addListenerInFirstTextArea() {
  let textarea: HTMLElement | null = null;
  let count = 20;

  while (!textarea && count > 0) {
    textarea = document.getElementById("prompt-textarea");
    if (textarea) {
      console.log("Find textarea", textarea);
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "@") {
          window.openTabs?.();
        } else {
          window.stopRenderTabs?.();
        }
      });
      break;
    }
    await sleep(100);
    count--;
  }
}

function addTextToGptPromptTextArea(text: string) {
  const gptPromptTextArea = document.getElementById("prompt-textarea");
  if (!gptPromptTextArea) {
    return;
  }
  const p = document.createElement("p");
  p.textContent = text;
  gptPromptTextArea.appendChild(p);
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
        const markdownSingleNewline = markdown.replace(
          /(\r\n|\n|\r){2,}/g,
          "\n"
        );
        sendResponse({ markdown: markdownSingleNewline });
        return true;
      }
    }
  );
}

initTabListener();

function mountReact() {
  //确保mountReact能被重复执行
  if (document.getElementById("tab-mention-react-root")) {
    return;
  }
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
  const reactRoot = createRoot(reactMount);

  //check textarea if in center
  const rect = container.getBoundingClientRect();
  const distanceToBottom = window.innerHeight - rect.bottom;
  if (distanceToBottom < 200) {
    reactMount.style.bottom = `${container.offsetHeight - 5}px`;
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
      <ul className="shadow-long p-2 rounded-xl bg-white">
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
  console.log("tab icon", tab.favIconUrl);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Receive tag click");
    chrome.runtime.sendMessage(
      { action: "getTabMarkdown", tabId: tab.id } as Message,
      function (response: { markdown: string }) {
        addTextToGptPromptTextArea(response.markdown);
        stopRenderTabs();
      }
    );
  };
  return (
    <li
      key={tab.id}
      onClick={handleClick}
      className="p-1 flex gap-1 cursor-pointer hover:bg-gray-100 rounded-lg"
    >
      <img src={tab.favIconUrl} alt="" className="w-4 h-4" />
      <p className="overflow-hidden text-ellipsis whitespace-nowrap">
        {tab.title}
      </p>
    </li>
  );
}

// keep prompt textarea listener when rerender
let lastTextarea: HTMLElement | null = null;
let lastListener: ((event: KeyboardEvent) => void) | null = null;

function bindKeyListenerToCurrentTextArea() {
  const textarea = document.getElementById("prompt-textarea");
  if (textarea && textarea !== lastTextarea) {
    // 解绑旧的
    if (lastTextarea && lastListener) {
      lastTextarea.removeEventListener("keydown", lastListener);
    }
    // 绑定新的
    const listener = (event: KeyboardEvent) => {
      if (event.key === "@") {
        window.openTabs?.();
      } else {
        window.stopRenderTabs?.();
      }
    };
    textarea.addEventListener("keydown", listener);
    lastTextarea = textarea;
    lastListener = listener;
  }
}

function observeTextAreaChanges() {
  const url = window.location.href;
  if (!url.includes("chatgpt.com")) {
    return;
  }
  const observer = new MutationObserver(bindKeyListenerToCurrentTextArea);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  bindKeyListenerToCurrentTextArea();
}

observeTextAreaChanges();

// reload content script when url change
function listenUrlChange(callback: () => void) {
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback();
    }
  }, 500);
}

listenUrlChange(() => {
  const url = window.location.href;
  if (!url.includes("chatgpt.com")) {
    return;
  }
  mountReact();
});

InitContentScript();
