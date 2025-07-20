import React, { useEffect, useState } from "react";
import type { Message } from "./type";
import { createRoot } from "react-dom/client";
import TurndownService from "turndown";
const turndownService = new TurndownService();

let needFixReactPosition = false;

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
  const url = window.location.href;
  if (!url.includes("chatgpt.com")) {
    return;
  }

  //await make sure mountReact is executed after textarea is found
  await addListenerInFirstTextArea();

  mountReact();
}

async function addListenerInFirstTextArea() {
  let textarea: HTMLElement | null = null;
  let count = 20;

  while (!textarea && count > 0) {
    textarea = document.getElementById("prompt-textarea");
    if (textarea) {
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "@") {
          if (needFixReactPosition) {
            fixReactPosition();
          }
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

  bodyClone
    .querySelectorAll("img[src^='data:image']")
    .forEach((el) => el.remove());

  return bodyClone.innerHTML;
}

function initTabListener() {
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      if (message.action === "produceMarkdown") {
        const cleanBody = getCleanBody();
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

let container: HTMLElement | undefined = undefined;
let reactMount: HTMLElement | undefined = undefined;

function fixReactPosition() {
  if (!container || !reactMount) {
    return;
  }
  const rect = container.getBoundingClientRect();
  const distanceToBottom = window.innerHeight - rect.bottom;

  if (distanceToBottom < 200) {
    reactMount.style.top = "";
    reactMount.style.bottom = `${container.offsetHeight - 5}px`;

    needFixReactPosition = false;
  }
}

function mountReact() {
  // allow mountReact to be called multiple times
  if (document.getElementById("tab-mention-react-root")) {
    return;
  }
  const thread_bottom = document.getElementById("thread-bottom");
  container = thread_bottom?.children[0]?.children[0] as
    | HTMLElement
    | undefined;
  if (!container) {
    return;
  }
  container.style.position = "relative";
  reactMount = document.createElement("div");
  reactMount.id = "tab-mention-react-root";
  container.appendChild(reactMount);
  const reactRoot = createRoot(reactMount);

  //check textarea if in center
  const rect = container.getBoundingClientRect();
  const distanceToBottom = window.innerHeight - rect.bottom;

  if (distanceToBottom < 200) {
    reactMount.style.bottom = `${container.offsetHeight - 5}px`;
  } else {
    reactMount.style.top = `${container.offsetHeight - 5}px`;
    needFixReactPosition = true;
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
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      className="p-1 flex gap-1 items-center cursor-pointer hover:bg-gray-100 rounded-lg"
    >
      <img src={tab.favIconUrl} alt="" className="w-4 h-4" />
      <p className="max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
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
    // unbind old listener
    if (lastTextarea && lastListener) {
      lastTextarea.removeEventListener("keydown", lastListener);
    }
    // bind new listener
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

// remountreact when url change
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
