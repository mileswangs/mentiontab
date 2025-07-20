import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  return (
    <>
      <div
        style={{
          width: "200px",
        }}
      >
        <h3>mentiontab is enabled ✅</h3>
        <p>click @ to mention tab</p>
      </div>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
